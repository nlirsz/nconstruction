import React from 'react';
import { LayoutDashboard, CalendarDays, ClipboardCheck, Image as ImageIcon, Package, Settings, ArrowLeft, X, Calendar, Building, ChevronLeft, ChevronRight, NotebookPen, User, FolderOpen, FileJson, ListChecks, FileText } from 'lucide-react';
import { Project, UserProfile, Organization } from '../types';
import { APP_LOGO_URL } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  project: Project;
  onBack: () => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userProfile?: UserProfile | null;
  onOpenProfile: () => void;
  organization?: Organization | null;
  onOpenOrgSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  project,
  onBack,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  userProfile,
  onOpenProfile,
  organization,
  onOpenOrgSettings
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'gantt', label: 'Cronograma', icon: <CalendarDays size={18} /> },
    { id: 'execution', label: 'Execução', icon: <ListChecks size={18} /> },
    { id: 'units', label: 'Detalhamento', icon: <Building size={18} /> },
    { id: 'reports', label: 'Relatórios', icon: <FileText size={18} /> },
    { id: 'asbuilt', label: 'As-Built', icon: <FileJson size={18} /> },
    { id: 'documents', label: 'Documentos', icon: <FolderOpen size={18} /> },
    { id: 'notes', label: 'Notas & To-Do', icon: <NotebookPen size={18} /> },
    { id: 'calendar', label: 'Calendário', icon: <Calendar size={18} /> },
    { id: 'rdo', label: 'RDO (Diário)', icon: <ClipboardCheck size={18} /> },
    { id: 'gallery', label: 'Galeria', icon: <ImageIcon size={18} /> },
    { id: 'supplies', label: 'Suprimentos', icon: <Package size={18} /> },
  ];

  const getThemeClasses = (color: string) => {
    const map: Record<string, string> = {
      'blue': 'from-blue-600 to-slate-900',
      'emerald': 'from-emerald-600 to-slate-900',
      'violet': 'from-violet-600 to-slate-900',
      'orange': 'from-orange-600 to-slate-900',
      'yellow': 'from-yellow-500 to-slate-900',
      'rose': 'from-rose-600 to-slate-900',
      'slate': 'from-slate-600 to-slate-900',
    };
    return map[color] || map['blue'];
  };

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    onClose();
  };

  const displayLogo = organization?.logo_url || APP_LOGO_URL;
  const displayName = organization?.name || "nConstruction";

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-[140] xl:hidden backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div className={`
        bg-gradient-to-b ${getThemeClasses(project.themeColor)} text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-[150] print:hidden
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        xl:translate-x-0
        ${isCollapsed ? 'w-16' : 'w-60'}
      `}>

        <button
          onClick={onToggleCollapse}
          className="hidden xl:flex absolute -right-2.5 top-8 bg-white text-slate-600 rounded-full p-1 shadow-md hover:text-blue-600 transition-all border border-slate-100 z-50"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        <div className={`p-4 border-b border-white/10 relative flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
          <button onClick={onClose} className="absolute top-3 right-3 text-white/70 xl:hidden">
            <X size={18} />
          </button>

          <div className={`flex flex-col items-center ${isCollapsed ? 'mb-2' : 'mb-4'}`}>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg mb-1.5 shrink-0 overflow-hidden text-slate-900 relative group cursor-pointer" onClick={onOpenOrgSettings}>
              <img src={displayLogo} alt={displayName} className="w-full h-full object-contain p-0.5" />
              {!isCollapsed && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Settings size={14} className="text-white" />
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-1 cursor-pointer group" onClick={onOpenOrgSettings}>
                <span className="text-[10px] font-black text-white/80 tracking-widest uppercase text-center leading-tight group-hover:text-white transition-colors">{displayName}</span>
              </div>
            )}
          </div>

          {!isCollapsed ? (
            <div className="text-center md:text-left">
              <h1 className="text-sm font-black leading-tight tracking-tighter text-white truncate">{project.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-1.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'green' ? 'bg-green-400' : project.status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`}></div>
                <p className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">
                  {project.status === 'green' ? 'Operação OK' : 'Atenção'}
                </p>
              </div>
            </div>
          ) : (
            <div className={`w-2 h-2 rounded-full mt-1 ${project.status === 'green' ? 'bg-green-400' : project.status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`}></div>
          )}

          <button
            onClick={onBack}
            className={`flex items-center gap-2 text-[10px] font-black uppercase text-white/70 hover:text-white mt-4 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-all w-full justify-center border border-white/5 ${isCollapsed ? 'px-0' : 'px-2'}`}
          >
            <ArrowLeft size={12} />
            {!isCollapsed && "Trocar Obra"}
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <ul className="space-y-0.5 px-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-200 group relative ${activeTab === item.id
                    ? 'bg-white shadow-lg shadow-black/20 text-blue-600 xl:text-white xl:bg-white/15'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <div className={`${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                    {item.icon}
                  </div>
                  {!isCollapsed && <span className="uppercase tracking-tight truncate">{item.label}</span>}
                  {activeTab === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-white rounded-r-full shadow-[0_0_8px_white] xl:hidden" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-2 pb-2 border-t border-white/10">
          <button
            onClick={() => handleItemClick('settings')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-200 group relative ${activeTab === 'settings'
              ? 'bg-white shadow-lg shadow-black/20 text-blue-600 xl:text-white xl:bg-white/15'
              : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
          >
            <div className={`${activeTab === 'settings' ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
              <Settings size={18} />
            </div>
            {!isCollapsed && <span className="uppercase tracking-tight truncate">Configurações</span>}
            {activeTab === 'settings' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-white rounded-r-full shadow-[0_0_8px_white] xl:hidden" />
            )}
          </button>
        </div>

        <div className="p-3 border-t border-white/10 bg-black/10">
          <button
            onClick={onOpenProfile}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'} px-2 py-1.5 bg-black/20 rounded-lg w-full hover:bg-black/30 transition-colors group`}
          >
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] border border-white/10 shrink-0 overflow-hidden">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={14} />
              )}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden text-left min-w-0">
                <p className="text-[10px] font-black text-white truncate uppercase">{userProfile?.full_name?.split(' ')[0] || "User"}</p>
                <p className="text-[9px] text-white/50 truncate uppercase font-bold tracking-tighter">{userProfile?.role || 'Visitante'}</p>
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
};