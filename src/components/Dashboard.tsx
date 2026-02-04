import React, { useMemo, useEffect, useState } from 'react';
import {
    Activity, AlertTriangle, Package, Sun, Clock,
    CheckCircle2, ArrowRight, Briefcase, HardHat, Target,
    History, X, ListOrdered, User, ChevronRight, Zap, Building2, MapPin,
    LayoutGrid
} from 'lucide-react';
import { Project, Task, TaskStatus, LogEntry, Note, SupplyOrder, PhaseConfig } from '../types';
import { supabase } from '../services/supabaseClient';
import { fetchWeatherForecast, WeatherData } from '../services/weatherService';
import { DEFAULT_PHASES, getPhaseIcon, getPhaseColor } from '../constants';

interface DashboardProps {
    project: Project;
    tasks: Task[];
    setActiveTab?: (tab: string) => void;
    onNavigateToExecution?: (unitId: string) => void;
}

interface PhaseDetailData {
    lastCompleted: string;
    activeFronts: { id: string; label: string; progress: number }[];
    completedFloors: { id: string; label: string; date: Date }[];
    pendingFloors: string[];
    completedCount: number;
    totalCount: number;
}

const isOverdue = (task: Task) => task.status !== TaskStatus.COMPLETED && new Date(task.end) < new Date();
const isTodayOrActive = (task: Task) => task.status === TaskStatus.IN_PROGRESS || (new Date(task.start) <= new Date() && new Date(task.end) >= new Date() && task.status !== TaskStatus.COMPLETED);

export const Dashboard: React.FC<DashboardProps> = ({ project, tasks, setActiveTab, onNavigateToExecution }) => {
    const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
    const [phaseProgress, setPhaseProgress] = useState<Record<string, PhaseDetailData>>({});
    const [selectedSectorPhase, setSelectedSectorPhase] = useState<PhaseConfig | null>(null);
    const [notes, setNotes] = useState<{ forMe: Note[], myPosts: Note[], general: Note[] }>({ forMe: [], myPosts: [], general: [] });
    const [recentSupplies, setRecentSupplies] = useState<SupplyOrder[]>([]);
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);

    const activePhases: PhaseConfig[] = useMemo(() => {
        return (project.phases && project.phases.length > 0) ? project.phases : DEFAULT_PHASES;
    }, [project.phases]);

    const phaseBottlenecks = useMemo(() => {
        const overdue = tasks.filter(isOverdue);
        const map: Record<string, boolean> = {};
        overdue.forEach(t => {
            if (t.linked_phase_id) map[t.linked_phase_id] = true;
        });
        return map;
    }, [tasks]);

    useEffect(() => {
        const initDashboard = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            await Promise.all([
                fetchExecutionFeed(),
                fetchPhaseStatus(),
                fetchNotes(user?.email || ''),
                fetchSupplies(),
                loadWeather()
            ]);
            setLoading(false);
        };
        initDashboard();
    }, [project.id]);

    const loadWeather = async () => {
        const data = await fetchWeatherForecast();
        setWeatherData(data);
    };

    const fetchExecutionFeed = async () => {
        const { data } = await supabase
            .from('project_logs')
            .select('*')
            .eq('project_id', project.id)
            .eq('category', 'unit')
            .order('date', { ascending: false })
            .limit(6);
        if (data) setRecentLogs(data);
    };

    const fetchPhaseStatus = async () => {
        const { data: levels } = await supabase
            .from('project_levels')
            .select('*, units:project_units(*)')
            .eq('project_id', project.id)
            .order('display_order', { ascending: true });

        const { data: progress } = await supabase
            .from('unit_progress')
            .select('*')
            .eq('project_id', project.id);

        if (!levels || !progress) return;

        const progressMap = new Map();
        progress.forEach((p: any) => {
            if (!progressMap.has(p.unit_id)) progressMap.set(p.unit_id, {});
            progressMap.get(p.unit_id)[p.phase_id] = {
                percentage: p.percentage,
                updated_at: p.updated_at
            };
        });

        const result: Record<string, PhaseDetailData> = {};

        activePhases.forEach(phase => {
            let totalApplicableFloors = 0;
            let completedFloorsCount = 0;
            const activeFronts: { id: string, label: string, progress: number }[] = [];
            const completedFloors: { id: string, label: string, date: Date }[] = [];
            const pendingFloors: string[] = [];

            for (const level of levels) {
                if (level.active_phases && level.active_phases.length > 0 && !level.active_phases.includes(phase.id)) continue;
                const units = level.units || [];
                if (units.length === 0) continue;
                totalApplicableFloors++;

                let floorTotalProgress = 0;
                let floorUnitCount = 0;
                let floorIs100 = true;
                let floorIs0 = true;
                let latestCompletionDate = new Date(0);

                units.forEach((u: any) => {
                    const unitData = progressMap.get(u.id)?.[phase.id];
                    const pct = unitData?.percentage || 0;
                    floorTotalProgress += pct;
                    floorUnitCount++;
                    if (pct < 100) floorIs100 = false;
                    if (pct > 0) floorIs0 = false;
                    if (pct === 100 && unitData?.updated_at) {
                        const d = new Date(unitData.updated_at);
                        if (d > latestCompletionDate) latestCompletionDate = d;
                    }
                });

                if (!floorIs0 && !floorIs100 && floorUnitCount > 0) {
                    activeFronts.push({ id: level.id, label: level.label, progress: Math.round(floorTotalProgress / floorUnitCount) });
                }
                if (floorIs100 && floorUnitCount > 0) {
                    completedFloorsCount++;
                    completedFloors.push({ id: level.id, label: level.label, date: latestCompletionDate });
                }
                if (floorIs0 && floorUnitCount > 0) pendingFloors.push(level.label);
            }

            completedFloors.sort((a, b) => b.date.getTime() - a.date.getTime());
            result[phase.id] = {
                lastCompleted: completedFloors.length > 0 ? completedFloors[0].label : "Início",
                activeFronts,
                completedFloors,
                pendingFloors,
                completedCount: completedFloorsCount,
                totalCount: totalApplicableFloors
            };
        });

        setPhaseProgress(result);
    };

    const fetchNotes = async (email: string) => {
        const { data } = await supabase.from('project_notes').select('*').eq('project_id', project.id).neq('status', 'completed').order('created_at', { ascending: false });
        if (data) setNotes({ forMe: data.filter((n: Note) => n.assigned_to === email), myPosts: data.filter((n: Note) => n.created_by === email), general: data.filter((n: Note) => !n.assigned_to) });
    };

    const fetchSupplies = async () => {
        const { data } = await supabase.from('supply_orders').select('*').eq('project_id', project.id).order('updated_at', { ascending: false }).limit(5);
        if (data) setRecentSupplies(data);
    };

    const delayedTasks = tasks.filter(isOverdue);
    const activeTasks = tasks.filter(isTodayOrActive);
    const upcomingTasks = tasks.filter(t => t.progress === 0 && !isOverdue(t) && new Date(t.start) <= new Date(Date.now() + 86400000 * 2));

    return (
        <div className="space-y-4 pb-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
                        <Briefcase size={16} />
                    </div>
                    <div>
                        <h1 className="text-sm md:text-base font-black text-slate-800 tracking-tight leading-none uppercase">Monitor de Produção</h1>
                        <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Status operacional da obra</p>
                    </div>
                </div>

                {weatherData && (
                    <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tempo</p>
                            <p className="text-[10px] text-blue-600 font-black uppercase leading-none">{weatherData.insights[0].split('.')[0]}</p>
                        </div>
                        <div className="text-sm font-black text-slate-700 flex items-center gap-1">
                            {weatherData.current.temperature}° <Sun className="text-orange-400" size={14} />
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
                    <ListOrdered size={12} className="text-blue-600" />
                    <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Frentes Ativas</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 md:gap-3">
                    {activePhases.map((phase) => {
                        const stats = phaseProgress[phase.id];
                        if (!stats) return null;

                        const isComplete = stats.completedCount === stats.totalCount && stats.totalCount > 0;
                        const isInProgress = stats.activeFronts.length > 0;
                        const hasBottleneck = phaseBottlenecks[phase.id];
                        const completionPct = stats.totalCount > 0 ? Math.round((stats.completedCount / stats.totalCount) * 100) : 0;

                        return (
                            <div
                                key={phase.id}
                                className={`bg-white rounded-lg border p-2 transition-all flex flex-col min-h-[100px] group cursor-pointer hover:shadow-md ${isComplete ? 'border-emerald-100' : isInProgress ? 'border-blue-500 shadow-sm' : 'border-slate-100 opacity-60'} ${hasBottleneck ? 'ring-1 ring-red-400' : ''}`}
                                onClick={() => setSelectedSectorPhase(phase)}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <div className={`p-1 rounded text-white ${getPhaseColor(phase.color)} shadow-sm`}>
                                        {getPhaseIcon(phase.icon, 10)}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black text-slate-300 uppercase">{phase.code}</span>
                                        {hasBottleneck && <AlertTriangle size={10} className="text-red-500 mt-0.5 animate-pulse" />}
                                    </div>
                                </div>

                                <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-tight mb-1 truncate leading-tight">
                                    {phase.label}
                                </h4>

                                <div className="flex-1 overflow-hidden">
                                    {isComplete ? (
                                        <div className="flex items-center gap-1 text-emerald-600">
                                            <CheckCircle2 size={8} />
                                            <span className="text-[9px] font-black uppercase">Fim</span>
                                        </div>
                                    ) : isInProgress ? (
                                        <div className="space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 text-blue-600">
                                                    <Activity size={8} />
                                                    <span className="text-[9px] font-black uppercase">Ativo</span>
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600">{completionPct}%</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-600 truncate leading-tight">
                                                {stats.activeFronts[0].label} ({stats.activeFronts[0].progress}%)
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Espera</span>
                                    )}
                                </div>

                                <div className="mt-1.5 pt-1.5 border-t border-slate-50 flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Progresso</span>
                                    <span className="text-[9px] font-black text-slate-500">{stats.completedCount}/{stats.totalCount}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* AGENDA DO DIA (NEW) */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:col-span-2 ring-2 ring-emerald-400 ring-offset-1">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2">
                                    <Target size={14} className="text-emerald-500" />
                                    <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-widest">Agenda de Hoje ({new Date().toLocaleDateString('pt-BR')})</h3>
                                </div>
                                {activeTasks.length > 0 && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 rounded-full">{activeTasks.length}</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar p-1">
                                {activeTasks.length === 0 ?
                                    <div className="col-span-1 md:col-span-2 py-4 flex flex-col items-center justify-center text-slate-400 gap-1 opacity-60">
                                        <CheckCircle2 size={16} />
                                        <p className="text-[10px] font-bold uppercase tracking-wide">Tudo em dia por hoje</p>
                                    </div>
                                    :
                                    activeTasks.map(t => {
                                        const level = project.structure?.levels?.find((l: any) => l.units.some((u: any) => u.id === t.linked_unit_id));
                                        const unit = level?.units.find((u: any) => u.id === t.linked_unit_id);
                                        const locationLabel = unit ? `${unit.name} • ${level.label}` : (level?.label || 'Geral');

                                        return (
                                            <div key={t.id} className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 flex justify-between items-center group cursor-pointer hover:bg-emerald-50 transition-colors" onClick={() => onNavigateToExecution?.(t.linked_unit_id)}>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${getPhaseColor(t.linked_phase_id ? activePhases.find(p => p.id === t.linked_phase_id)?.color : 'blue')}`} />
                                                        <p className="text-[10px] font-black text-emerald-900 truncate leading-tight uppercase">{t.name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600/70 uppercase truncate">
                                                        <span>{locationLabel}</span>
                                                        <span>•</span>
                                                        <span>Até {new Date(t.end).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 ml-2">
                                                    <span className="text-[8px] font-black bg-white text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200">
                                                        {t.progress}%
                                                    </span>
                                                    <ArrowRight size={10} className="text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                                                </div>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={12} className="text-red-500" />
                                    <h3 className="font-black text-slate-500 text-[10px] uppercase tracking-widest">Atrasos (Gantt)</h3>
                                </div>
                                {delayedTasks.length > 0 && <span className="text-[9px] font-black bg-red-500 text-white px-1.5 rounded-full">{delayedTasks.length}</span>}
                            </div>
                            <div className="space-y-1.5 max-h-[100px] overflow-y-auto no-scrollbar">
                                {delayedTasks.length === 0 ? <p className="text-[10px] text-slate-400 italic px-1 pt-2 text-center font-bold uppercase">Cronograma em dia</p> :
                                    delayedTasks.map(t => {
                                        const level = project.structure?.levels?.find((l: any) => l.units.some((u: any) => u.id === t.linked_unit_id));
                                        const unit = level?.units.find((u: any) => u.id === t.linked_unit_id);
                                        const locationLabel = unit ? `${unit.name} • ${level.label}` : (level?.label || 'Geral');

                                        return (
                                            <div key={t.id} className="bg-red-50 p-2 rounded-lg border border-red-100 flex justify-between items-center group cursor-pointer hover:bg-red-100">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black text-red-700 truncate leading-tight uppercase">{t.name}</p>
                                                    <div className="flex items-center gap-1 text-[8px] font-bold text-red-500/70 mt-0.5 uppercase">
                                                        <span>{locationLabel}</span>
                                                        <span>•</span>
                                                        <span>VENCEU EM {new Date(t.end).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                                <ArrowRight size={10} className="text-red-300 group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2">
                                    <Clock size={12} className="text-blue-500" />
                                    <h3 className="font-black text-slate-500 text-[10px] uppercase tracking-widest">Iniciar Logo</h3>
                                </div>
                                {upcomingTasks.length > 0 && <span className="text-[9px] font-black bg-blue-500 text-white px-1.5 rounded-full">{upcomingTasks.length}</span>}
                            </div>
                            <div className="space-y-1.5 max-h-[100px] overflow-y-auto no-scrollbar">
                                {upcomingTasks.length === 0 ? <p className="text-[10px] text-slate-400 italic px-1 pt-2 text-center font-bold uppercase">Nenhum início próximo</p> :
                                    upcomingTasks.map(t => {
                                        const level = project.structure?.levels?.find((l: any) => l.units.some((u: any) => u.id === t.linked_unit_id));
                                        const unit = level?.units.find((u: any) => u.id === t.linked_unit_id);
                                        const locationLabel = unit ? `${unit.name} • ${level.label}` : (level?.label || 'Geral');

                                        return (
                                            <div key={t.id} className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex justify-between items-center group cursor-pointer hover:bg-blue-100">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black text-blue-700 truncate leading-tight uppercase">{t.name}</p>
                                                    <div className="flex items-center gap-1 text-[8px] font-bold text-blue-500/70 mt-0.5 uppercase">
                                                        <span>{locationLabel}</span>
                                                        <span>•</span>
                                                        <span>INICIA EM {new Date(t.start).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                                <ArrowRight size={10} className="text-blue-300 group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[240px]">
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <History size={12} className="text-emerald-600" />
                            <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Atividade Recente</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
                            {recentLogs.map((log) => (
                                <div key={log.id} className="flex gap-2 relative">
                                    <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                        {log.user_avatar ? <img src={log.user_avatar} className="w-full h-full object-cover" /> : <User size={8} className="text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{log.user_name?.split(' ')[0]} • {new Date(log.date).toLocaleDateString('pt-BR')}</p>
                                        <p className="text-[10px] font-bold text-slate-800 leading-tight truncate uppercase">{log.title}</p>
                                    </div>
                                </div>
                            ))
                            }
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                        <h3 className="font-black text-slate-700 text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
                            <HardHat size={12} className="text-blue-600" /> Resumo de Etapas
                        </h3>
                        <div className="space-y-2.5">
                            {activePhases.slice(0, 5).map(phase => {
                                const stats = phaseProgress[phase.id];
                                if (!stats) return null;
                                const pct = Math.round((stats.completedCount / (stats.totalCount || 1)) * 100);

                                return (
                                    <div key={phase.id} className="px-1" onClick={() => setSelectedSectorPhase(phase)}>
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`p-1 rounded text-white ${getPhaseColor(phase.color)}`}>{getPhaseIcon(phase.icon, 8)}</div>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{phase.label}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-blue-600">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-md p-3 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Package size={12} className="text-blue-400" />
                                <h3 className="font-black text-white text-[10px] uppercase tracking-widest">Logística</h3>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            {recentSupplies.slice(0, 2).map(s => (
                                <div key={s.id} className="p-1.5 rounded bg-white/5 border border-white/5">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className="text-[10px] font-bold text-white truncate flex-1 uppercase tracking-tight">{s.title}</p>
                                        <span className={`text-[9px] font-black uppercase px-1 rounded ${s.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                            {s.status === 'delivered' ? 'Ok' : 'Em curso'}
                                        </span>
                                    </div>
                                </div>
                            ))
                            }
                        </div>
                    </div>
                </div>
            </div>

            {selectedSectorPhase && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in duration-200">
                        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg text-white ${getPhaseColor(selectedSectorPhase.color)}`}>
                                    {getPhaseIcon(selectedSectorPhase.icon, 14)}
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{selectedSectorPhase.label}</h3>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{selectedSectorPhase.code}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSectorPhase(null)} className="p-1 text-slate-400 hover:bg-white rounded-lg">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-3 space-y-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Concluídos</p>
                                    <p className="text-sm font-black text-emerald-600">{phaseProgress[selectedSectorPhase.id]?.completedCount || 0}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Em Aberto</p>
                                    <p className="text-sm font-black text-blue-600">{(phaseProgress[selectedSectorPhase.id]?.totalCount || 0) - (phaseProgress[selectedSectorPhase.id]?.completedCount || 0)}</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <h4 className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <LayoutGrid size={10} className="text-blue-500" /> Detalhamento por Pavimento
                                </h4>
                                <div className="space-y-1">
                                    {/* Group by floor */}
                                    {Array.from(new Set(phaseProgress[selectedSectorPhase.id]?.activeFronts.map(f => f.floor) || [])).sort((a: any, b: any) => b - a).map(floor => (
                                        <div key={floor} className="border border-slate-100 rounded-lg overflow-hidden">
                                            <div className="bg-slate-50 px-2 py-1 flex justify-between items-center border-b border-slate-100">
                                                <span className="text-[8px] font-black text-slate-600 uppercase">{floor}º Pavimento</span>
                                            </div>
                                            <div className="p-1 space-y-1 bg-white">
                                                {phaseProgress[selectedSectorPhase.id]?.activeFronts.filter(f => f.floor === floor).map((front, frontIdx) => (
                                                    <div
                                                        key={`${selectedSectorPhase.id}-${floor}-${front.id}-${frontIdx}`}
                                                        className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded group cursor-pointer border border-transparent hover:border-blue-100 transition-all"
                                                        onClick={() => onNavigateToExecution(front.id, selectedSectorPhase.id)}
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <p className="text-[9px] font-bold text-slate-700 uppercase tracking-tighter truncate">{front.label}</p>
                                                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className={`h-full ${front.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${front.progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className={`text-[8px] font-black ${front.progress === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{front.progress}%</span>
                                                            <ArrowRight size={10} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                            <button onClick={() => setSelectedSectorPhase(null)} className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-500 rounded font-black text-[8px] uppercase tracking-widest">Fechar</button>
                            <button
                                onClick={() => { setSelectedSectorPhase(null); setActiveTab && setActiveTab('execution'); }}
                                className="flex-[1.5] py-1.5 bg-slate-900 text-white rounded font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                            >
                                <Building2 size={12} /> Abrir Matriz
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};