import React, { useState, useEffect, useMemo } from 'react';
import { supabase, uploadFile, uploadImage } from '../services/supabaseClient';
import { InsightSummary } from './InsightSummary';
import { Project, UnitPermission, UserProfile, ProjectPhoto, ProjectDocument, DocumentCategory, PhaseConfig, Task } from '../types';
import { DEFAULT_PHASES, getPhaseIcon, getPhaseColor } from '../constants';
import {
    LayoutGrid, Building2, Camera, FileText, MessageSquare, LogOut,
    CheckCircle2, Clock, Info, ShieldCheck, MapPin, TrendingUp,
    Download, Eye, Search, Filter, FolderOpen, X, Send, Plus, Image as ImageIcon,
    Layers, Grid, Zap, Droplets, PaintBucket, User, Activity, ListOrdered,
    Loader2, Save, Settings
} from 'lucide-react';

interface CustomerDashboardProps {
    project: Project;
    projects?: Project[];
    permission: UnitPermission;
    onLogout: () => void;
    onSelectProject?: (project: Project) => void;
    userProfile: UserProfile | null;
    session?: any;
}

const DOC_CATEGORIES: { id: DocumentCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'structural', label: 'Estrutural', icon: <Grid size={14} />, color: 'bg-stone-100 text-stone-700' },
    { id: 'architectural', label: 'Arquitetônico', icon: <Layers size={14} />, color: 'bg-blue-100 text-blue-700' },
    { id: 'electrical', label: 'Elétrico', icon: <Zap size={14} />, color: 'bg-amber-100 text-amber-700' },
    { id: 'hydraulic', label: 'Hidráulico', icon: <Droplets size={14} />, color: 'bg-cyan-100 text-cyan-700' },
    { id: 'finishing', label: 'Acabamentos', icon: <PaintBucket size={14} />, color: 'bg-purple-100 text-purple-700' },
    { id: 'others', label: 'Outros', icon: <FolderOpen size={14} />, color: 'bg-slate-100 text-slate-700' },
];

// Theme color mapping (same as Sidebar)
const THEME_COLORS: Record<string, { bg: string; text: string; gradient: string; ring: string; light: string; border: string; sidebar: string; dot: string }> = {
    blue: { bg: 'bg-blue-600', text: 'text-blue-600', gradient: 'from-blue-600 to-slate-900', ring: 'ring-blue-500/20', light: 'bg-blue-50', border: 'border-blue-500', sidebar: 'from-blue-700 via-blue-900 to-slate-900', dot: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', gradient: 'from-emerald-600 to-slate-900', ring: 'ring-emerald-500/20', light: 'bg-emerald-50', border: 'border-emerald-500', sidebar: 'from-emerald-700 via-emerald-900 to-slate-900', dot: 'bg-emerald-500' },
    violet: { bg: 'bg-violet-600', text: 'text-violet-600', gradient: 'from-violet-600 to-slate-900', ring: 'ring-violet-500/20', light: 'bg-violet-50', border: 'border-violet-500', sidebar: 'from-violet-700 via-violet-900 to-slate-900', dot: 'bg-violet-500' },
    orange: { bg: 'bg-orange-600', text: 'text-orange-600', gradient: 'from-orange-600 to-slate-900', ring: 'ring-orange-500/20', light: 'bg-orange-50', border: 'border-orange-500', sidebar: 'from-orange-700 via-orange-900 to-slate-900', dot: 'bg-orange-500' },
    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', gradient: 'from-yellow-500 to-slate-900', ring: 'ring-yellow-500/20', light: 'bg-yellow-50', border: 'border-yellow-500', sidebar: 'from-yellow-600 via-yellow-900 to-slate-900', dot: 'bg-yellow-500' },
    rose: { bg: 'bg-rose-600', text: 'text-rose-600', gradient: 'from-rose-600 to-slate-900', ring: 'ring-rose-500/20', light: 'bg-rose-50', border: 'border-rose-500', sidebar: 'from-rose-700 via-rose-900 to-slate-900', dot: 'bg-rose-500' },
    slate: { bg: 'bg-slate-600', text: 'text-slate-600', gradient: 'from-slate-600 to-slate-900', ring: 'ring-slate-500/20', light: 'bg-slate-50', border: 'border-slate-500', sidebar: 'from-slate-700 via-slate-800 to-slate-900', dot: 'bg-slate-500' },
};

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ project, projects = [], permission, onLogout, onSelectProject, userProfile, session }) => {
    const theme = THEME_COLORS[project.themeColor] || THEME_COLORS['blue'];

    const [activeTab, setActiveTab] = useState<'overview' | 'evolucao' | 'gallery' | 'common' | 'docs' | 'messages'>('overview');
    const [unitProgress, setUnitProgress] = useState<any>(null);
    const [commonProgress, setCommonProgress] = useState<any[]>([]);
    const [buildingProgress, setBuildingProgress] = useState<Record<string, { avg: number; count: number }>>({});
    const [buildingOverallPct, setBuildingOverallPct] = useState(0);
    const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [lightboxPhoto, setLightboxPhoto] = useState<ProjectPhoto | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Unit Tasks
    const [unitTasks, setUnitTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [galleryPhaseFilter, setGalleryPhaseFilter] = useState<string>('all');

    // Profile edit state
    const [showProfileEditor, setShowProfileEditor] = useState(false);
    const [editProfile, setEditProfile] = useState({ full_name: '', avatar_url: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Mural state
    const [notes, setNotes] = useState<any[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [showNewNoteForm, setShowNewNoteForm] = useState(false);
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

    // Unit name for filtering photos/docs
    const unitName = permission.unit?.name || '';

    // Active phases from project config or defaults
    const activePhases: PhaseConfig[] = useMemo(() => {
        return (project.phases && project.phases.length > 0) ? project.phases : DEFAULT_PHASES;
    }, [project.phases]);

    // Available phases for gallery photo filter (only phases that have photos)
    const galleryPhases = useMemo(() => {
        const phaseIds = new Set<string>();
        photos.forEach((p: any) => {
            if (p.phase_id) phaseIds.add(p.phase_id);
        });
        return activePhases.filter(phase => phaseIds.has(phase.id));
    }, [photos, activePhases]);

    useEffect(() => {
        fetchDashboardData();
        fetchUnitTasks();
    }, [project.id, permission.unit_id]);

    useEffect(() => {
        if (activeTab === 'gallery' && photos.length === 0) fetchPhotos();
        if (activeTab === 'evolucao' && photos.length === 0) fetchPhotos(); // Fetch to show some previews if needed, or just keep separate
        if (activeTab === 'docs' && documents.length === 0) fetchDocuments();
        if (activeTab === 'messages' && notes.length === 0) fetchNotes();
    }, [activeTab]);

    const fetchUnitTasks = async () => {
        setLoadingTasks(true);
        try {
            // 1. Fetch ALL unit names to use as a negative filter
            const { data: allUnits } = await supabase
                .from('project_units')
                .select('name')
                .eq('project_id', project.id);

            // 2. Fetch tasks linked to this unit in the DB
            const { data } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', project.id)
                .eq('linked_unit_id', permission.unit_id)
                .order('start', { ascending: true });

            if (data) {
                const currentUnitName = (permission.unit?.name || '').toLowerCase();

                // 3. Client-side safeguard filter
                const filteredTasks = data.filter(task => {
                    const taskName = task.name.toLowerCase();

                    // If task explicitly mentions MY unit, definitely keep it
                    if (taskName.includes(currentUnitName)) return true;

                    // Check if it mentions OTHER units
                    if (allUnits) {
                        const mentionsOtherUnit = allUnits.some((u: any) => {
                            if (!u.name) return false;
                            const otherName = u.name.toLowerCase();

                            // Skip comparing against myself (already handled above, but for safety)
                            if (otherName === currentUnitName) return false;

                            // Skip generic/short names to avoid false positives (e.g. unit "A" in "Apartment")
                            if (otherName.length < 2) return false;

                            return taskName.includes(otherName);
                        });

                        // If it matches another unit's name but not mine, exclude it
                        if (mentionsOtherUnit) return false;
                    }

                    return true;
                });

                setUnitTasks(filteredTasks);
            }
        } catch (error) {
            console.error("Erro ao buscar cronograma da unidade:", error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Unit-specific progress
            const { data: unitData } = await supabase
                .from('unit_progress')
                .select('*')
                .eq('unit_id', permission.unit_id);

            if (unitData && unitData.length > 0) {
                const avg = Math.round(unitData.reduce((acc: number, curr: any) => acc + (curr.percentage || 0), 0) / unitData.length);
                setUnitProgress({ percentage: avg, phases: unitData });
            }

            // 2. Building-wide progress (ALL units, ALL phases)
            const { data: allProgress } = await supabase
                .from('unit_progress')
                .select('phase_id, percentage')
                .eq('project_id', project.id);

            if (allProgress && allProgress.length > 0) {
                // Per-phase averages (for sector grid)
                const phaseMap: Record<string, { total: number; count: number }> = {};
                allProgress.forEach((row: any) => {
                    if (!phaseMap[row.phase_id]) phaseMap[row.phase_id] = { total: 0, count: 0 };
                    phaseMap[row.phase_id].total += (row.percentage || 0);
                    phaseMap[row.phase_id].count += 1;
                });
                const result: Record<string, { avg: number; count: number }> = {};
                Object.entries(phaseMap).forEach(([phaseId, val]) => {
                    result[phaseId] = { avg: Math.round(val.total / val.count), count: val.count };
                });
                setBuildingProgress(result);

                // Simple overall average (matches staff ExecutionTab formula)
                const totalP = allProgress.reduce((acc: number, r: any) => acc + (r.percentage || 0), 0);
                setBuildingOverallPct(Math.round(totalP / allProgress.length));
            }

            // 3. Common areas
            if (permission.common_areas && permission.common_areas.length > 0) {
                const { data: commonUnits } = await supabase
                    .from('project_units')
                    .select('id, name, type, level:project_levels(label, level_type)')
                    .eq('project_id', project.id)
                    .in('type', ['common', 'garage']);

                const authorizedIds = (commonUnits || [])
                    .filter((u: any) => {
                        const levelType = u.level?.level_type;
                        return permission.common_areas.includes(levelType) ||
                            permission.common_areas.includes(u.type);
                    })
                    .map((u: any) => u.id);

                if (authorizedIds.length > 0) {
                    const { data: commonProg } = await supabase
                        .from('unit_progress')
                        .select('*, unit:project_units(name, type)')
                        .in('unit_id', authorizedIds);
                    setCommonProgress(commonProg || []);
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    // =========================================
    // PHOTOS: Fetch only for linked unit
    // =========================================
    const fetchPhotos = async () => {
        try {
            // 1. Official gallery photos that match the client's unit
            const { data: galleryData } = await supabase
                .from('project_photos')
                .select('*')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });

            // 2. Execution photos from unit_progress (specific to client's unit)
            const { data: execData } = await supabase
                .from('unit_progress')
                .select('phase_id, subtasks, unit_id, updated_at')
                .eq('project_id', project.id)
                .eq('unit_id', permission.unit_id);

            const executionPhotos: ProjectPhoto[] = [];
            execData?.forEach((row: any) => {
                if (row.subtasks) {
                    Object.entries(row.subtasks).forEach(([key, val]: [string, any]) => {
                        if (typeof val === 'object' && val.photos && Array.isArray(val.photos)) {
                            val.photos.forEach((p: any) => {
                                executionPhotos.push({
                                    id: `exec-${p.id || Math.random().toString(36)}`,
                                    project_id: project.id,
                                    url: p.url,
                                    description: p.description || `${key} - ${unitName}`,
                                    category: 'evolution' as any,
                                    location_label: unitName,
                                    created_at: p.created_at || row.updated_at || new Date().toISOString(),
                                    created_by: 'Execução',
                                    phase_id: row.phase_id
                                } as any);
                            });
                        }
                    });
                }
            });

            // Filter gallery photos: only those matching this unit's location label
            const unitLower = unitName.toLowerCase();
            const filteredGallery = (galleryData || []).filter((p: ProjectPhoto) => {
                const label = (p.location_label || '').toLowerCase();
                return label.includes(unitLower) || label === '' || label === 'geral';
            }).map((p: ProjectPhoto) => {
                // Try to infer phase_id from description for filtering
                const desc = (p.description || '').toLowerCase();
                const matchedPhase = activePhases.find(phase =>
                    desc.includes(phase.label.toLowerCase()) || desc.includes(phase.id.toLowerCase())
                );
                return matchedPhase ? { ...p, phase_id: matchedPhase.id } as any : p;
            });

            // Merge and deduplicate
            const allPhotos = [...filteredGallery, ...executionPhotos];
            const seen = new Set<string>();
            const unique = allPhotos.filter(p => {
                if (seen.has(p.url)) return false;
                seen.add(p.url);
                return true;
            });

            setPhotos(unique);
        } catch (error) {
            console.error("Erro ao carregar fotos:", error);
        }
    };

    // =========================================
    // DOCUMENTS: Filter by unit context
    // =========================================
    const fetchDocuments = async () => {
        try {
            const { data } = await supabase
                .from('project_documents')
                .select('*')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });

            // Filter: show only docs for this client's unit OR general docs
            const unitLower = unitName.toLowerCase();
            const filtered = (data || []).filter((d: any) => {
                const ctx = (d.context || '').toLowerCase();
                return ctx.includes(unitLower) || ctx === 'geral' || ctx === '' || ctx.includes('geral');
            });

            setDocuments(filtered);
        } catch (error) {
            console.error("Erro ao carregar documentos:", error);
        }
    };

    // =========================================
    // MURAL: Notes + Replies + New Note
    // =========================================
    const fetchNotes = async () => {
        setLoadingNotes(true);
        try {
            const { data, error } = await supabase
                .from('project_notes')
                .select('*, project_note_replies(*)')
                .eq('project_id', project.id)
                .eq('context', permission.unit_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const sortedNotes = (data || []).map((note: any) => ({
                ...note,
                project_note_replies: (note.project_note_replies || []).sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
            }));

            setNotes(sortedNotes);

            // Fetch profiles
            const userEmails = new Set<string>();
            sortedNotes.forEach((n: any) => {
                userEmails.add(n.created_by);
                n.project_note_replies.forEach((r: any) => userEmails.add(r.created_by));
            });

            if (userEmails.size > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('email', Array.from(userEmails));

                if (profilesData) {
                    const pMap: Record<string, UserProfile> = {};
                    profilesData.forEach((p: any) => pMap[p.email] = p);
                    setProfiles(pMap);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar notas:", error);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleAddReply = async (noteId: string) => {
        const text = replyText[noteId];
        if (!text?.trim() || !session?.user?.email) return;

        try {
            const { error } = await supabase
                .from('project_note_replies')
                .insert({
                    note_id: noteId,
                    content: text,
                    created_by: session.user.email
                });

            if (error) throw error;
            setReplyText(prev => ({ ...prev, [noteId]: '' }));
            fetchNotes();
        } catch (error) {
            console.error("Erro ao comentar:", error);
        }
    };

    const handleCreateNote = async () => {
        if (!newNoteContent.trim() || !session?.user?.email) return;

        try {
            const { error } = await supabase
                .from('project_notes')
                .insert({
                    project_id: project.id,
                    context: permission.unit_id,
                    title: newNoteTitle || null,
                    content: newNoteContent,
                    created_by: session.user.email,
                    priority: 'normal'
                });

            if (error) throw error;
            setNewNoteTitle('');
            setNewNoteContent('');
            setShowNewNoteForm(false);
            fetchNotes();
        } catch (error) {
            console.error("Erro ao criar nota:", error);
        }
    };

    // =========================================
    // Profile edit handlers
    // =========================================
    const handleOpenProfile = () => {
        setEditProfile({
            full_name: userProfile?.full_name || '',
            avatar_url: userProfile?.avatar_url || ''
        });
        setShowProfileEditor(true);
    };

    const handleSaveProfile = async () => {
        if (!session?.user?.id) return;
        setSavingProfile(true);
        try {
            await supabase.from('profiles').upsert({
                id: session.user.id,
                full_name: editProfile.full_name,
                avatar_url: editProfile.avatar_url,
                role: userProfile?.role || 'Cliente'
            });
            // Trigger parent refresh
            window.location.reload();
        } catch (e) {
            console.error('Erro ao salvar perfil:', e);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploadingAvatar(true);
        const file = e.target.files[0];
        const url = await uploadImage(file, 'avatars');
        if (url) setEditProfile(prev => ({ ...prev, avatar_url: url }));
        setUploadingAvatar(false);
    };

    // =========================================
    // Profile Edit Modal
    // =========================================
    const renderProfileEditor = () => {
        if (!showProfileEditor) return null;
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowProfileEditor(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <User size={18} className={theme.text} />
                            Editar Perfil
                        </h3>
                        <button onClick={() => setShowProfileEditor(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                                    {editProfile.avatar_url ? (
                                        <img src={editProfile.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <User size={40} />
                                        </div>
                                    )}
                                </div>
                                <label className={`absolute bottom-0 right-0 ${theme.bg} text-white p-2 rounded-full cursor-pointer hover:opacity-90 transition-colors shadow-sm`}>
                                    {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                </label>
                            </div>
                            <p className="mt-3 text-sm text-slate-500 font-medium">{session?.user?.email}</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nome Completo</label>
                                <input
                                    type="text"
                                    value={editProfile.full_name}
                                    onChange={e => setEditProfile(prev => ({ ...prev, full_name: e.target.value }))}
                                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 ${theme.ring} outline-none text-slate-800 bg-white`}
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3 justify-end">
                            <button onClick={() => setShowProfileEditor(false)} className="px-4 py-2.5 text-slate-500 font-bold hover:text-slate-700 text-sm">Cancelar</button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className={`px-6 py-2.5 ${theme.bg} text-white rounded-lg font-bold hover:opacity-90 shadow-sm flex items-center gap-2 text-sm disabled:opacity-70`}
                            >
                                {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // =========================================
    // TAB: OVERVIEW (Unit-specific only)
    // =========================================
    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Smart Monthly Report */}
            <InsightSummary project={project} onViewDetails={() => setActiveTab('gallery')} />

            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Building2 size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`${theme.bg} text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase`}>Minha Unidade</span>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{project.name}</span>
                        </div>
                        <h2 className="text-xl md:text-3xl font-black text-slate-900 leading-tight">
                            {unitName || 'Carregando...'}
                        </h2>
                        <div className="flex items-center gap-2 mt-2 text-slate-500">
                            <MapPin size={14} />
                            <span className="text-xs font-medium">{project.address}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status Geral</p>
                            <div className="relative w-16 h-16">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                                        strokeDasharray={`${(unitProgress?.percentage || 0) * 0.88} 88`}
                                        strokeLinecap="round" className="transition-all duration-1000" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-900">
                                    {unitProgress?.percentage || 0}%
                                </span>
                            </div>
                        </div>
                        <div className="h-12 w-px bg-slate-100"></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Previsão Entrega</p>
                            <p className="text-sm font-black text-slate-800">
                                {project.endDate ? (() => {
                                    const d = new Date(project.endDate + 'T12:00:00'); // Set midday to avoid timezone shifts
                                    if (project.deliveryFormat === 'semester') {
                                        return `${d.getMonth() < 6 ? '1º Semestre' : '2º Semestre'} de ${d.getFullYear()}`;
                                    }
                                    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                                    return `${month} de ${d.getFullYear()}`;
                                })() : 'Em definição'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Dual progress bars: Unit vs Building */}
                <div className="mt-8 space-y-4">
                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-xs font-black text-slate-600 uppercase flex items-center gap-1.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${theme.dot}`}></div>
                                Minha Unidade — {unitName}
                            </span>
                            <span className={`text-xs font-black ${theme.text}`}>{unitProgress?.percentage || 0}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                            <div
                                className={`h-full bg-gradient-to-r ${theme.gradient} transition-all duration-1000 ease-out rounded-full`}
                                style={{ width: `${unitProgress?.percentage || 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { tab: 'evolucao' as const, icon: <Activity size={20} />, label: 'Evolução Obra', desc: 'Progresso do prédio', color: 'bg-indigo-50 text-indigo-600' },
                    { tab: 'gallery' as const, icon: <Camera size={20} />, label: 'Galeria Fotos', desc: 'Registros da obra', color: 'bg-blue-50 text-blue-600' },
                    { tab: 'docs' as const, icon: <FileText size={20} />, label: 'Documentos', desc: 'Manuais e plantas', color: 'bg-emerald-50 text-emerald-600' },
                    { tab: 'messages' as const, icon: <MessageSquare size={20} />, label: 'Mural Notas', desc: 'Fale conosco', color: 'bg-amber-50 text-amber-600' },
                ].map(card => (
                    <div key={card.tab} onClick={() => setActiveTab(card.tab)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${card.color}`}>
                            {card.icon}
                        </div>
                        <h4 className="text-xs font-black text-slate-800 uppercase mb-1">{card.label}</h4>
                        <p className="text-[10px] text-slate-500">{card.desc}</p>
                    </div>
                ))}
            </div>

            {/* FRENTES ATIVAS DA UNIDADE */}
            {unitProgress?.phases && unitProgress.phases.length > 0 && activePhases.length > 0 && (
                <section className="bg-white rounded-xl p-3 md:p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
                        <ListOrdered size={12} className={theme.text} />
                        <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Frentes da Minha Unidade</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 md:gap-3">
                        {activePhases.map((phase) => {
                            const unitPhase = unitProgress?.phases?.find((p: any) => p.phase_id === phase.id);
                            const pct = unitPhase?.percentage ?? 0;
                            const isComplete = pct >= 100;
                            const isInProgress = pct > 0 && pct < 100;

                            return (
                                <div
                                    key={phase.id}
                                    className={`bg-white rounded-lg border p-2 transition-all flex flex-col min-h-[100px] group ${isComplete ? 'border-emerald-100' : isInProgress ? `${theme.border} shadow-sm` : 'border-slate-100 opacity-60'}`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className={`p-1 rounded text-white ${getPhaseColor(phase.color)} shadow-sm`}>
                                            {getPhaseIcon(phase.icon, 10)}
                                        </div>
                                        <span className="text-[9px] font-black text-slate-300 uppercase">{phase.code}</span>
                                    </div>
                                    <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-tight mb-1 truncate leading-tight">{phase.label}</h4>
                                    <div className="flex-1 overflow-hidden">
                                        {isComplete ? (
                                            <div className="flex items-center gap-1 text-emerald-600">
                                                <CheckCircle2 size={8} />
                                                <span className="text-[9px] font-black uppercase">Fim</span>
                                            </div>
                                        ) : isInProgress ? (
                                            <div className="flex items-center justify-between">
                                                <div className={`flex items-center gap-1 ${theme.text}`}>
                                                    <Activity size={8} />
                                                    <span className="text-[9px] font-black uppercase">Ativo</span>
                                                </div>
                                                <span className={`text-[10px] font-black ${theme.text}`}>{pct}%</span>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Espera</span>
                                        )}
                                    </div>
                                    <div className="mt-1.5 pt-1.5 border-t border-slate-50 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Progresso</span>
                                        <span className="text-[9px] font-black text-slate-500">{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* CALENDÁRIO DE ATIVIDADES DA UNIDADE */}
            <section className="bg-white rounded-xl p-3 md:p-4 border border-slate-200 shadow-sm mt-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
                    <Clock size={12} className={theme.text} />
                    <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Calendário de Atividades</h3>
                </div>

                {loadingTasks ? (
                    <div className="flex justify-center p-4"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
                ) : unitTasks.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                        <p className="text-xs font-bold uppercase">Nenhuma atividade agendada</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {unitTasks.map((task) => {
                            const phase = activePhases.find(p => p.id === task.linked_phase_id);
                            const startDate = new Date(task.start).toLocaleDateString('pt-BR');
                            const endDate = new Date(task.end).toLocaleDateString('pt-BR');
                            const isCompleted = task.progress >= 100;
                            const isLate = !isCompleted && new Date(task.end) < new Date();

                            return (
                                <div key={task.id} className="bg-white p-3 rounded-lg border border-slate-100 flex gap-3 items-center group hover:border-slate-200 transition-colors">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${phase ? getPhaseColor(phase.color) : 'bg-slate-400'}`}>
                                        {phase ? getPhaseIcon(phase.icon, 14) : <Activity size={14} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-slate-800 uppercase truncate leading-tight">{task.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                                {startDate} - {endDate}
                                            </span>
                                            {isLate && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded uppercase">Atrasado</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {isCompleted ? (
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Concluído</span>
                                        ) : (
                                            <span className={`text-[9px] font-black ${theme.text} bg-slate-50 px-2 py-0.5 rounded uppercase`}>{task.progress}%</span>
                                        )}
                                        {task.linked_subtasks && task.linked_subtasks.length > 0 && (
                                            <span className="text-[8px] font-bold text-slate-400">{task.linked_subtasks.length} subitens</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );

    // =========================================
    // TAB: ÁREAS COMUNS
    // =========================================
    const renderCommonAreas = () => {
        const grouped = new Map<string, { name: string; phases: any[] }>();
        commonProgress.forEach((p: any) => {
            const uName = p.unit?.name || 'Área';
            if (!grouped.has(p.unit_id)) {
                grouped.set(p.unit_id, { name: uName, phases: [] });
            }
            grouped.get(p.unit_id)!.phases.push(p);
        });

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Áreas Comuns</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 leading-relaxed">Progresso das áreas compartilhadas</p>
                </header>

                {grouped.size === 0 ? (
                    <div className="h-[40vh] flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-dashed border-slate-200">
                        <Building2 size={48} className="text-slate-200 mb-4" />
                        <h3 className="text-sm font-black text-slate-800 uppercase">Nenhuma Área Disponível</h3>
                        <p className="text-xs text-slate-500 max-w-xs mt-2">As áreas comuns serão exibidas aqui conforme o progresso da obra avançar.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from(grouped.entries()).map(([unitId, data]) => {
                            const avg = data.phases.length > 0
                                ? Math.round(data.phases.reduce((acc: number, p: any) => acc + (p.percentage || 0), 0) / data.phases.length)
                                : 0;

                            return (
                                <div key={unitId} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{data.name}</h4>
                                        <span className="text-xs font-black text-blue-600">{avg}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700" style={{ width: `${avg}%` }} />
                                    </div>
                                    <div className="space-y-2">
                                        {data.phases.map((phase: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between text-[10px]">
                                                <span className="font-bold text-slate-600 uppercase truncate">{phase.phase_id?.replace(/_/g, ' ')}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${phase.percentage || 0}%` }} />
                                                    </div>
                                                    <span className="font-black text-slate-800 w-8 text-right">{phase.percentage || 0}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // =========================================
    // TAB: EVOLUÇÃO (Building-wide progress)
    // =========================================
    const renderEvolution = () => {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Evolução da Obra</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 leading-relaxed">Status geral do empreendimento</p>
                </header>

                {/* Building-wide progress bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
                    <div className="flex items-center justify-between mb-3 text-sm md:text-base">
                        <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-emerald-600" />
                            <span className="font-black text-slate-700 text-[10px] md:text-xs uppercase tracking-widest">Evolução Geral do Prédio</span>
                        </div>
                        <span className="text-xl font-black text-slate-800">{buildingOverallPct}%</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                            style={{ width: `${buildingOverallPct}%` }}
                        />
                    </div>
                </div>

                {/* Building-wide Frentes Ativas */}
                {activePhases.length > 0 && (
                    <section className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                            <ListOrdered size={14} className={theme.text} />
                            <h3 className="font-black text-slate-700 text-[10px] md:text-xs uppercase tracking-widest">Frentes Ativas do Prédio</h3>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                            {activePhases.map((phase) => {
                                const pct = buildingProgress[phase.id]?.avg ?? 0;
                                const isComplete = pct >= 100;
                                const isInProgress = pct > 0 && pct < 100;
                                return (
                                    <div key={phase.id} className={`bg-white rounded-xl border p-3 md:p-4 transition-all flex flex-col min-h-[110px] group ${isComplete ? 'border-emerald-100' : isInProgress ? `${theme.border} shadow-sm` : 'border-slate-100 opacity-60'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className={`p-1.5 rounded-lg text-white ${getPhaseColor(phase.color)} shadow-sm`}>{getPhaseIcon(phase.icon, 12)}</div>
                                            <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase">{phase.code}</span>
                                        </div>
                                        <h4 className="font-black text-slate-800 text-[10px] md:text-xs uppercase tracking-tight mb-2 truncate leading-tight">{phase.label}</h4>
                                        <div className="flex-1 overflow-hidden">
                                            {isComplete ? (
                                                <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={10} /><span className="text-[10px] font-black uppercase">Fim</span></div>
                                            ) : isInProgress ? (
                                                <div className="flex items-center justify-between">
                                                    <div className={`flex items-center gap-1 ${theme.text}`}><Activity size={10} /><span className="text-[10px] font-black uppercase tracking-tight">Ativo</span></div>
                                                    <span className={`text-[10px] md:text-xs font-black ${theme.text}`}>{pct}%</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Espera</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        );
    };

    // =========================================
    // TAB: GALERIA (Filterable photos)
    // =========================================
    const renderGallery = () => {
        const filteredPhotos = photos.filter(p => {
            // Text search
            if (searchTerm && !p.description?.toLowerCase().includes(searchTerm.toLowerCase()) && !p.location_label?.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            // Phase filter
            if (galleryPhaseFilter !== 'all') {
                const photoPhase = (p as any).phase_id;
                if (!photoPhase || photoPhase !== galleryPhaseFilter) return false;
            }
            return true;
        });

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Galeria de Fotos</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 leading-relaxed">Registros visuais do projeto</p>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar fotos..."
                                className={`pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full outline-none focus:ring-2 ${theme.ring}`}
                            />
                        </div>
                    </div>

                    {/* Phase/Sector Filter */}
                    {galleryPhases.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter size={12} className="text-slate-400 shrink-0" />
                            <button
                                onClick={() => setGalleryPhaseFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${galleryPhaseFilter === 'all'
                                    ? `${theme.bg} text-white shadow-sm`
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                            >
                                Todos
                            </button>
                            {galleryPhases.map(phase => (
                                <button
                                    key={phase.id}
                                    onClick={() => setGalleryPhaseFilter(phase.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${galleryPhaseFilter === phase.id
                                        ? `${getPhaseColor(phase.color)} text-white shadow-sm`
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {getPhaseIcon(phase.icon, 10)}
                                    {phase.label}
                                </button>
                            ))}
                        </div>
                    )}
                </header>

                {filteredPhotos.length === 0 ? (
                    <div className="h-[30vh] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Camera size={40} className="text-slate-200 mb-4" />
                        <h3 className="text-xs font-black text-slate-800 uppercase">Sem fotos encontradas</h3>
                        <p className="text-[10px] text-slate-500 max-w-[200px] mt-2 leading-relaxed">Novos registros serão exibidos conforme forem postados.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        {filteredPhotos.map(photo => {
                            const photoPhase = activePhases.find(ph => ph.id === (photo as any).phase_id);
                            return (
                                <div
                                    key={photo.id}
                                    onClick={() => setLightboxPhoto(photo)}
                                    className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-slate-100 shadow-sm hover:shadow-lg transition-all"
                                >
                                    <img src={photo.url} alt={photo.description} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                                    {photoPhase && (
                                        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black text-white uppercase ${getPhaseColor(photoPhase.color)} shadow-sm`}>
                                            {photoPhase.label}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                        <p className="text-[9px] font-black text-white uppercase truncate">{photo.description || 'Ocorrência'}</p>
                                        <p className="text-[8px] text-white/70 font-bold">{new Date(photo.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {lightboxPhoto && (() => {
                    const lbPhase = activePhases.find(ph => ph.id === (lightboxPhoto as any).phase_id);
                    return (
                        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 md:p-8" onClick={() => setLightboxPhoto(null)}>
                            <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors" onClick={() => setLightboxPhoto(null)}>
                                <X size={24} />
                            </button>
                            <img
                                src={lightboxPhoto.url}
                                alt={lightboxPhoto.description}
                                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            />
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl text-center border border-white/10 w-auto max-w-[90vw]">
                                <p className="text-xs font-black text-white uppercase tracking-wide">{lightboxPhoto.description}</p>
                                {lbPhase && (
                                    <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded text-[9px] font-black text-white uppercase ${getPhaseColor(lbPhase.color)}`}>
                                        {lbPhase.label}
                                    </span>
                                )}
                                <p className="text-[10px] text-white/50 font-bold mt-1.5 uppercase tracking-widest">
                                    {lightboxPhoto.location_label && `${lightboxPhoto.location_label} • `}
                                    {new Date(lightboxPhoto.created_at).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };

    // =========================================
    // TAB: DOCUMENTOS (Filtrados por Unidade)
    // =========================================
    const renderDocuments = () => {
        const filteredDocs = documents.filter(d =>
            !searchTerm || d.title?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const grouped = new Map<string, ProjectDocument[]>();
        filteredDocs.forEach(doc => {
            const cat = doc.category || 'others';
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat)!.push(doc);
        });

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Documentos</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Documentos da unidade {unitName}</p>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar documentos..."
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold w-full sm:w-64 outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </header>

                {grouped.size === 0 ? (
                    <div className="h-[40vh] flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-dashed border-slate-200">
                        <FolderOpen size={48} className="text-slate-200 mb-4" />
                        <h3 className="text-sm font-black text-slate-800 uppercase">Nenhum Documento Disponível</h3>
                        <p className="text-xs text-slate-500 max-w-xs mt-2">Os documentos da sua unidade serão exibidos aqui conforme disponibilizados pela equipe.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Array.from(grouped.entries()).map(([catId, docs]) => {
                            const catInfo = DOC_CATEGORIES.find(c => c.id === catId) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
                            return (
                                <section key={catId}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${catInfo.color}`}>
                                            {catInfo.label}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">{docs.length} arquivo(s)</span>
                                    </div>
                                    <div className="space-y-2">
                                        {docs.map(doc => (
                                            <div key={doc.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group">
                                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                    <FileText size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-slate-800 truncate">{doc.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">
                                                        {doc.file_type?.toUpperCase()} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {doc.file_url && (
                                                        <>
                                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Visualizar"
                                                            >
                                                                <Eye size={16} />
                                                            </a>
                                                            <a href={doc.file_url} download
                                                                className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                                                title="Download"
                                                            >
                                                                <Download size={16} />
                                                            </a>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // =========================================
    // TAB: MURAL (Com criação de notas + respostas)
    // =========================================
    const renderMessages = () => {
        const currentEmail = session?.user?.email;

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Mural de Notas</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 leading-relaxed">Converse com a equipe da obra</p>
                    </div>
                    <button
                        onClick={() => setShowNewNoteForm(true)}
                        className={`bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 w-full md:w-auto`}
                    >
                        <Plus size={16} /> Nova Mensagem
                    </button>
                </header>

                {/* New note form */}
                {showNewNoteForm && (
                    <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-900 uppercase">Nova Mensagem</h4>
                            <button onClick={() => setShowNewNoteForm(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Assunto (opcional)"
                            value={newNoteTitle}
                            onChange={e => setNewNoteTitle(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <textarea
                            placeholder="Escreva sua mensagem..."
                            value={newNoteContent}
                            onChange={e => setNewNoteContent(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowNewNoteForm(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateNote}
                                disabled={!newNoteContent.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                <Send size={14} /> Enviar
                            </button>
                        </div>
                    </div>
                )}

                {loadingNotes ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando mural...</p>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <MessageSquare size={24} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase">Nada por aqui ainda</h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">
                            Clique em "Nova Mensagem" para iniciar uma conversa com a equipe da obra.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {notes.map((note: any) => {
                            const creator = profiles[note.created_by] || { full_name: note.created_by?.split('@')[0], avatar_url: '' };
                            const isMyNote = note.created_by === currentEmail;

                            return (
                                <article key={note.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                    <header className="p-5 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-200 rounded-xl overflow-hidden border-2 border-white shadow-sm">
                                                {creator.avatar_url ? (
                                                    <img src={creator.avatar_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className={`w-full h-full flex items-center justify-center text-white font-black text-xs ${isMyNote ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                                                        {(creator.full_name || 'U')[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{creator.full_name}</h4>
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${isMyNote ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {isMyNote ? 'Você' : 'Equipe'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                                                    <Clock size={10} />
                                                    <span className="text-[10px] font-bold">{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {note.priority === 'high' && (
                                            <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase">
                                                <Info size={12} /> Importante
                                            </div>
                                        )}
                                    </header>

                                    <div className="p-5 space-y-3">
                                        {note.title && (
                                            <h3 className="text-lg font-black text-slate-900 leading-tight">{note.title}</h3>
                                        )}
                                        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {note.content}
                                        </div>
                                        {note.attachments && note.attachments.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                {note.attachments.map((url: string, idx: number) => (
                                                    <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-100 group/img">
                                                        <img src={url} className="w-full h-full object-cover" />
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase gap-2">
                                                            <ImageIcon size={16} /> Ver Foto
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <footer className="bg-slate-50/30 border-t border-slate-50 p-5">
                                        <div className="flex items-center gap-4 mb-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <MessageSquare size={12} /> {note.project_note_replies?.length || 0} Comentários
                                            </span>
                                            <div className="h-px bg-slate-100 flex-1"></div>
                                        </div>

                                        <div className="space-y-4">
                                            {note.project_note_replies?.map((reply: any) => {
                                                const rUser = profiles[reply.created_by] || { full_name: reply.created_by?.split('@')[0], avatar_url: '' };
                                                const isMe = reply.created_by === currentEmail;

                                                return (
                                                    <div key={reply.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                        <div className={`w-8 h-8 rounded-full bg-slate-200 border border-white shrink-0 overflow-hidden ${isMe ? 'ring-2 ring-blue-100' : ''}`}>
                                                            {rUser.avatar_url ? (
                                                                <img src={rUser.avatar_url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[10px] bg-slate-300 text-white font-bold">
                                                                    {(rUser.full_name || 'U')[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className={`max-w-[85%] ${isMe ? 'items-end flex flex-col' : ''}`}>
                                                            <div className={`p-3 rounded-2xl text-[13px] ${isMe ? 'bg-blue-600 text-white rounded-tr-sm shadow-sm shadow-blue-200' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm shadow-slate-50'}`}>
                                                                {reply.content}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                                                {new Date(reply.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Reply input */}
                                        <div className="flex gap-2 mt-6">
                                            <input
                                                type="text"
                                                placeholder="Adicione um comentário ou dúvida..."
                                                value={replyText[note.id] || ''}
                                                onChange={e => setReplyText({ ...replyText, [note.id]: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && handleAddReply(note.id)}
                                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                                            />
                                            <button
                                                onClick={() => handleAddReply(note.id)}
                                                className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </footer>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // =========================================
    // SIDEBAR TABS
    // =========================================
    const tabs = [
        { id: 'overview' as const, icon: <LayoutGrid size={18} />, label: 'Início' },
        { id: 'evolucao' as const, icon: <Activity size={18} />, label: 'Evolução' },
        { id: 'gallery' as const, icon: <Camera size={18} />, label: 'Galeria' },
        { id: 'common' as const, icon: <TrendingUp size={18} />, label: 'Comuns' },
        { id: 'docs' as const, icon: <FileText size={18} />, label: 'Planos' },
        { id: 'messages' as const, icon: <MessageSquare size={18} />, label: 'Mural' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* HEADER MOBILE (Fixed simplified) */}
            <div className={`md:hidden p-3 flex items-center justify-between sticky top-0 z-[100] bg-gradient-to-r ${theme.sidebar} shadow-md border-b border-white/10`}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shadow-sm relative shrink-0">
                        {project.imageUrl ? (
                            <img src={project.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                <Building2 size={14} className="text-white/80" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-[14px] font-black text-white leading-none truncate">{project.name}</h1>
                                {projects.length > 1 && onSelectProject && (
                                    <select
                                        className="bg-white/10 text-white text-[9px] font-bold px-1 py-0.5 rounded border border-white/20 outline-none focus:bg-white/20"
                                        value={project.id}
                                        onChange={(e) => {
                                            const p = projects.find(proj => proj.id === e.target.value);
                                            if (p) onSelectProject(p);
                                        }}
                                    >
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id} className="text-slate-900 bg-white">{p.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-tight">{unitName || 'Minha Unidade'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handleOpenProfile} className="p-1.5 text-white/50 hover:text-white">
                            <User size={16} />
                        </button>
                        <button onClick={onLogout} className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* MOBILE BOTTOM TAB BAR */}
            <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-[100] flex items-center justify-around px-1 pb-safe-offset-2 pt-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]`}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-all relative ${activeTab === tab.id ? theme.text : 'text-slate-400'}`}
                    >
                        <div className={`transition-all duration-300 ${activeTab === tab.id ? 'scale-110 -translate-y-0.5' : 'scale-100'}`}>
                            {React.cloneElement(tab.icon as React.ReactElement, { size: 18 })}
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${activeTab === tab.id ? 'opacity-100' : 'opacity-70'}`}>
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full ${theme.bg}`} />
                        )}
                    </button>
                ))}
            </div>

            {/* SIDEBAR DESKTOP */}
            <aside className={`hidden md:flex w-72 bg-gradient-to-b ${theme.sidebar} flex-col h-screen sticky top-0`}>
                {/* Hero header with building image */}
                <div className="relative overflow-hidden">
                    {project.imageUrl ? (
                        <img src={project.imageUrl} className="w-full h-40 object-cover" />
                    ) : (
                        <div className={`w-full h-40 bg-gradient-to-br ${theme.sidebar} flex items-center justify-center`}>
                            <Building2 size={64} className="text-white/10" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`${theme.bg}/90 backdrop-blur-sm text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider`}>
                                Área do Cliente
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-white font-black text-lg leading-tight tracking-tight truncate">{project.name}</h2>
                            {projects.length > 1 && onSelectProject && (
                                <select
                                    className="bg-white/10 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/20 outline-none focus:bg-white/20 cursor-pointer"
                                    value={project.id}
                                    onChange={(e) => {
                                        const p = projects.find(proj => proj.id === e.target.value);
                                        if (p) onSelectProject(p);
                                    }}
                                >
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id} className="text-slate-900 bg-white">{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {project.address && (
                            <div className="flex items-center gap-1 mt-1.5 text-white/50">
                                <MapPin size={10} />
                                <span className="text-[9px] font-bold truncate">{project.address}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress mini-bar */}
                <div className="px-5 py-3 border-b border-white/5">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Progresso da Unidade</span>
                        <span className={`text-[10px] font-black ${theme.text}`}>{unitProgress?.percentage || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full transition-all duration-700`} style={{ width: `${unitProgress?.percentage || 0}%` }} />
                    </div>
                </div>

                <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? `${theme.bg} text-white shadow-lg` : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {tab.icon}
                            <span className="text-xs font-black uppercase tracking-wider">{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="px-4 py-4 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-3 cursor-pointer group" onClick={handleOpenProfile}>
                        <div className={`w-9 h-9 rounded-xl ${theme.bg} flex items-center justify-center text-[11px] font-black text-white shadow-lg overflow-hidden`}>
                            {userProfile?.avatar_url ? (
                                <img src={userProfile.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                userProfile?.full_name?.[0] || 'U'
                            )}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-[11px] font-black text-white truncate group-hover:underline">{userProfile?.full_name || 'Usuário'}</span>
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{permission.role === 'client' ? 'Proprietário' : 'Arquiteto'}</span>
                        </div>
                        <Settings size={14} className="text-white/30 group-hover:text-white/60 transition-colors" />
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-white/5 rounded-xl transition-colors">
                        <LogOut size={16} />
                        <span className="text-[10px] font-black uppercase">Sair</span>
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 p-4 md:p-8 xl:p-12 max-w-[1200px] mx-auto w-full mb-16 md:mb-0">
                {loading && activeTab === 'overview' ? (
                    <div className="flex items-center justify-center h-[60vh]">
                        <div className={`w-8 h-8 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin`}></div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'evolucao' && renderEvolution()}
                        {activeTab === 'gallery' && renderGallery()}
                        {activeTab === 'common' && renderCommonAreas()}
                        {activeTab === 'docs' && renderDocuments()}
                        {activeTab === 'messages' && renderMessages()}
                    </>
                )}
            </main>
            {renderProfileEditor()}
        </div>
    );
};
