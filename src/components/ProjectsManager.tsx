import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin, User, Search, X, Save, ArrowRight, Building2, Layout, Image as ImageIcon, Loader2, RotateCcw, Calendar, Settings, Users, Mail, Check, AlertCircle, Package, Clock, Activity, AlertTriangle, Briefcase, ChevronRight, ChevronDown, ChevronUp, FileText, Truck } from 'lucide-react';
import { Project, UserProfile, Organization, Task, TaskStatus, LogEntry, SupplyOrder } from '../types';
import { uploadImage, supabase } from '../services/supabaseClient';
import { APP_LOGO_URL } from '../constants';

interface ProjectsManagerProps {
  projects: Project[];
  tasks: Task[];
  currentUser?: any;
  organizations?: Organization[];
  currentOrganization?: Organization | null;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onSelectProject: (project: Project) => void;
  onRestoreDefaults?: () => void;
  onOpenProfile?: () => void;
  onRefresh?: () => void;
  onCreateOrganization?: () => void;
  userProfile?: UserProfile | null;
}

const INITIAL_FORM_STATE: Project = {
  id: '',
  name: '',
  address: '',
  progress: 0,
  budgetConsumed: 0,
  status: 'green',
  residentEngineer: '',
  imageUrl: APP_LOGO_URL,
  themeColor: 'blue',
  structure: {
    floors: 10,
    unitsPerFloor: 4
  }
};

const THEME_COLORS = [
  { name: 'Azul', value: 'blue', class: 'bg-blue-600' },
  { name: 'Verde', value: 'emerald', class: 'bg-emerald-600' },
  { name: 'Laranja', value: 'orange', class: 'bg-orange-600' },
  { name: 'Amarelo', value: 'yellow', class: 'bg-yellow-500' },
  { name: 'Roxo', value: 'violet', class: 'bg-violet-600' },
  { name: 'Rosa', value: 'rose', class: 'bg-rose-600' },
  { name: 'Cinza', value: 'slate', class: 'bg-slate-600' },
];

interface ProjectSummary {
    pendingSupplies: number;
    lastLog: LogEntry | null;
}

interface DashboardDetails {
    orders: SupplyOrder[];
    logs: LogEntry[];
    loading: boolean;
}

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({ 
  projects, 
  tasks,
  currentUser,
  organizations = [],
  currentOrganization,
  onAddProject, 
  onUpdateProject, 
  onDeleteProject, 
  onSelectProject,
  onRestoreDefaults,
  onOpenProfile,
  onRefresh,
  onCreateOrganization,
  userProfile
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'structure'>('info');
  const [formData, setFormData] = useState<Project>(INITIAL_FORM_STATE);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeOrgId, setActiveOrgId] = useState<string>('all');

  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  const [projectSummaries, setProjectSummaries] = useState<Record<string, ProjectSummary>>({});
  const [expandedDashboardId, setExpandedDashboardId] = useState<string | null>(null);
  const [dashboardDetails, setDashboardDetails] = useState<Record<string, DashboardDetails>>({});

  useEffect(() => {
    if (currentUser?.email) {
      fetchInvites();
    }
  }, [currentUser]);

  useEffect(() => {
      const fetchSummaries = async () => {
          if (projects.length === 0) return;
          const projectIds = projects.map(p => p.id);
          
          try {
              const { data: supplyData } = await supabase
                  .from('supply_orders')
                  .select('project_id')
                  .neq('status', 'delivered')
                  .in('project_id', projectIds);
              
              const supplyCounts: Record<string, number> = {};
              supplyData?.forEach((s: any) => {
                  supplyCounts[s.project_id] = (supplyCounts[s.project_id] || 0) + 1;
              });

              const { data: logData } = await supabase
                  .from('project_logs')
                  .select('project_id, title, date, user_name')
                  .in('project_id', projectIds)
                  .order('date', { ascending: false })
                  .limit(100); 

              const lastLogs: Record<string, LogEntry> = {};
              logData?.forEach((l: any) => {
                  if (!lastLogs[l.project_id]) {
                      lastLogs[l.project_id] = l;
                  }
              });

              const summaries: Record<string, ProjectSummary> = {};
              projectIds.forEach(pid => {
                  summaries[pid] = {
                      pendingSupplies: supplyCounts[pid] || 0,
                      lastLog: lastLogs[pid] || null
                  };
              });
              setProjectSummaries(summaries);

          } catch (err) {
              console.error("Error fetching summaries:", err);
          }
      };

      fetchSummaries();
  }, [projects]);

  useEffect(() => {
      if (currentOrganization && activeOrgId === 'all') {
          setActiveOrgId(currentOrganization.id);
      }
  }, [currentOrganization]);

  const fetchInvites = async () => {
    if (!currentUser?.email) return;
    const { data } = await supabase
        .from('project_invites')
        .select('*, project:projects(name, resident_engineer, image_url)')
        .eq('email', currentUser.email)
        .eq('status', 'pending');
        
    if (data) setPendingInvites(data);
  };

  const handleToggleDashboard = async (projectId: string) => {
      if (expandedDashboardId === projectId) {
          setExpandedDashboardId(null);
          return;
      }

      setExpandedDashboardId(projectId);

      if (!dashboardDetails[projectId]) {
          setDashboardDetails(prev => ({ ...prev, [projectId]: { orders: [], logs: [], loading: true } }));
          
          try {
              const [ordersRes, logsRes] = await Promise.all([
                  supabase.from('supply_orders').select('*').eq('project_id', projectId).neq('status', 'delivered').order('created_at', { ascending: true }).limit(5),
                  supabase.from('project_logs').select('*').eq('project_id', projectId).order('date', { ascending: false }).limit(5)
              ]);

              setDashboardDetails(prev => ({
                  ...prev,
                  [projectId]: {
                      orders: ordersRes.data || [],
                      logs: logsRes.data || [],
                      loading: false
                  }
              }));
          } catch (err) {
              setDashboardDetails(prev => ({ ...prev, [projectId]: { ...prev[projectId], loading: false } }));
          }
      }
  };

  const handleAcceptInvite = async (invite: any) => {
    if (!currentUser) return;
    setProcessingInviteId(invite.id);
    try {
        const { error: memberError } = await supabase.from('project_members').insert({ project_id: invite.project_id, user_id: currentUser.id, role: invite.role });
        if (!memberError) {
            await supabase.from('project_invites').delete().eq('id', invite.id);
            setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
            if (onRefresh) await onRefresh(); 
        }
    } catch (error) { console.error(error); } finally { setProcessingInviteId(null); }
  };

  const handleDeclineInvite = async (id: string) => {
      if(!window.confirm("Recusar convite?")) return;
      await supabase.from('project_invites').delete().eq('id', id);
      setPendingInvites(prev => prev.filter(i => i.id !== id));
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setModalTab('info');
    setFormData({ ...INITIAL_FORM_STATE });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setIsEditing(true);
    setFormData(project);
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(window.confirm('Excluir esta obra?')) { onDeleteProject(id); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) onUpdateProject(formData);
    else onAddProject(formData);
    setIsModalOpen(false);
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      const url = await uploadImage(e.target.files[0], 'projects');
      if (url) setFormData({ ...formData, imageUrl: url });
      setUploading(false);
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = activeOrgId === 'all' || p.organization_id === activeOrgId;
    return matchesSearch && matchesOrg;
  });

  const calculateStatus = (progress: number, budget: number): 'green' | 'yellow' | 'red' => {
    const diff = budget - progress;
    if (diff > 20) return 'red';
    if (diff > 10) return 'yellow';
    return 'green';
  };

  const getButtonClasses = (theme: string) => {
    const map: Record<string, string> = {
      'blue': 'bg-blue-600 text-white',
      'orange': 'bg-orange-600 text-white',
      'yellow': 'bg-yellow-500 text-white',
      'emerald': 'bg-emerald-600 text-white',
      'violet': 'bg-violet-600 text-white',
      'rose': 'bg-rose-600 text-white',
      'slate': 'bg-slate-600 text-white',
    };
    return map[theme] || map['blue'];
  };

  const getOrgName = (orgId?: string) => organizations.find(o => o.id === orgId)?.name || 'Sem Empresa';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 md:px-8 shadow-sm">
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md shrink-0 overflow-hidden p-1">
                      <img src={APP_LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                    <h1 className="text-base font-black text-slate-800 tracking-tight">nConstruction</h1>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Gestão de Portfólio</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 md:hidden">
                    <button onClick={onOpenProfile} className="w-7 h-7 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full object-cover" /> : <User size={14} className="m-auto mt-1" />}
                    </button>
                    <button onClick={handleOpenAdd} className="bg-slate-900 text-white p-1.5 rounded-lg"><Plus size={16} /></button>
                </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto items-center">
                <div className="relative flex-1 md:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder="Filtrar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <button onClick={handleOpenAdd} className="hidden md:flex bg-slate-900 text-white px-4 py-1.5 rounded-lg font-bold text-xs items-center gap-2 transition-all hover:bg-slate-800"><Plus size={14} /> Nova Obra</button>
            </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-4 md:px-8">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button onClick={() => setActiveOrgId('all')} className={`px-4 py-3 text-[10px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${activeOrgId === 'all' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400'}`}>Todos</button>
              {organizations.map(org => (
                  <button key={org.id} onClick={() => setActiveOrgId(org.id)} className={`px-4 py-3 text-[10px] font-black uppercase border-b-2 transition-colors whitespace-nowrap ${activeOrgId === org.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>{org.name}</button>
              ))}
              <button onClick={onCreateOrganization} className="ml-4 px-3 py-1 text-[9px] font-black uppercase text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100">Nova Empresa</button>
          </div>
      </div>

      <main className="flex-1 px-4 py-6 md:px-8 w-full animate-in fade-in duration-500 max-w-[1600px] mx-auto">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200 mt-4 flex flex-col items-center justify-center">
            <Building2 size={32} className="text-slate-200 mb-4" />
            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Nenhuma obra cadastrada</h3>
            <button onClick={handleOpenAdd} className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Criar Primeiro Projeto</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProjects.map((project) => {
                const displayStatus = calculateStatus(project.progress, project.budgetConsumed);
                return (
                    <div key={project.id} className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col">
                        <div className="relative h-44 overflow-hidden shrink-0 bg-slate-100">
                            <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            
                            <div className="absolute bottom-3 left-4 right-4">
                                <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-widest mb-1.5 ${displayStatus === 'green' ? 'bg-emerald-500 text-white' : displayStatus === 'yellow' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>{displayStatus === 'green' ? 'Estável' : 'Alerta'}</span>
                                <h3 className="font-black text-base text-white leading-tight truncate">{project.name}</h3>
                                <p className="text-[10px] text-white/70 flex items-center gap-1 mt-1"><MapPin size={10} /> {project.address.split(',')[0]}</p>
                            </div>

                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => handleOpenEdit(e, project)} className="p-1.5 bg-white/90 text-slate-700 rounded-lg shadow-sm"><Edit2 size={14} /></button>
                                <button onClick={(e) => handleDelete(e, project.id)} className="p-1.5 bg-white/90 text-red-500 rounded-lg shadow-sm"><Trash2 size={14} /></button>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex flex-col">
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Progresso</span>
                                <span className="text-lg font-black text-slate-800">{project.progress}%</span>
                            </div>
                            <button onClick={() => onSelectProject({...project, status: displayStatus})} className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${getButtonClasses(project.themeColor)}`}>
                                Gerenciar
                            </button>
                        </div>
                    </div>
                );
                })}
            </div>

            <div className="mt-12 space-y-4">
                <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-200">
                    <Activity size={18} className="text-blue-600" />
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Dashboards de Acompanhamento</h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredProjects.map(project => {
                        const summary = projectSummaries[project.id];
                        const isExpanded = expandedDashboardId === project.id;
                        const details = dashboardDetails[project.id];

                        return (
                            <div key={`dash-${project.id}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all">
                                <div className="flex flex-col md:flex-row">
                                    <div className="p-5 md:w-60 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 flex flex-col justify-center">
                                        <h3 className="font-black text-xs text-slate-800 uppercase tracking-tight mb-1">{project.name}</h3>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{getOrgName(project.organization_id)}</p>
                                    </div>

                                    <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                                        <div className="flex items-center gap-3">
                                            <Clock size={16} className="text-slate-300" />
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cronograma</span>
                                                <span className="font-black text-xs text-slate-700">Verificando tarefas...</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Package size={16} className="text-slate-300" />
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Suprimentos</span>
                                                <span className="font-black text-xs text-slate-700">{summary?.pendingSupplies || 0} Pendentes</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Briefcase size={16} className="text-blue-500" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Último Log</span>
                                                    <span className="font-bold text-xs text-slate-700 truncate">{summary?.lastLog?.title || '--'}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleToggleDashboard(project.id)}
                                                className={`ml-4 p-1.5 rounded-lg border transition-colors ${isExpanded ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-300 border-slate-200'}`}
                                            >
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2">
                                        {!details || details.loading ? (
                                            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-300" size={20} /></div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white rounded-lg border border-slate-200 p-3 h-48 flex flex-col">
                                                    <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 px-1">Logística Pendente</h4>
                                                    <div className="flex-1 overflow-y-auto space-y-2 px-1">
                                                        {details.orders.map(o => (
                                                            <div key={o.id} className="text-[10px] font-bold text-slate-600 p-2 bg-slate-50 rounded border border-slate-100 flex justify-between">
                                                                <span className="truncate">{o.title}</span>
                                                                <span className="text-[8px] uppercase px-1.5 bg-white border border-slate-200 rounded">{o.priority}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-slate-200 p-3 h-48 flex flex-col">
                                                    <h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 px-1">Ações Recentes</h4>
                                                    <div className="flex-1 overflow-y-auto space-y-2 px-1">
                                                        {details.logs.map(l => (
                                                            <div key={l.id} className="text-[10px] text-slate-500 border-l-2 border-blue-500 pl-3 py-1">
                                                                <p className="font-bold text-slate-700 leading-none mb-1">{l.title}</p>
                                                                <p className="text-[9px]">{new Date(l.date).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
          </>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">{isEditing ? 'Editar Projeto' : 'Nova Obra'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Nome da Obra</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Endereço</label><input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Início</label>
                        <input type="date" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Cor</label>
                        <select value={formData.themeColor} onChange={e => setFormData({...formData, themeColor: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white">
                            {THEME_COLORS.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-400">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg font-black text-[10px] uppercase shadow-md">{isEditing ? 'Salvar' : 'Criar'}</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};