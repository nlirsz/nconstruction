import React, { useState, useMemo, useEffect } from 'react';
import { Task, TaskStatus, Project, ProjectPhoto, PhaseConfig } from '../types';
import {
    Calendar, ChevronLeft, ChevronRight, Plus, Edit3, X, Trash2, Save,
    BarChart3, GripVertical, Loader2, AlertTriangle,
    ArrowRight, MapPin, LocateFixed, Link2, MoreVertical, GitBranch,
    Link, Camera, Image as ImageIconLucide,
    CheckCircle2, Building2, ListChecks, ChevronDown, CheckSquare, Square,
    FileText, Briefcase, LayoutList, GanttChart
} from 'lucide-react';
import { uploadImage, supabase } from '../services/supabaseClient';
import { DEFAULT_PHASES } from '../constants';
import { parseLocalDate, formatLocalDate, addDays } from '../utils/dateUtils';

interface GanttViewProps {
    tasks: Task[];
    projects: Project[];
    onAddTask: (task: Task) => void;
    onUpdateTask: (task: Task) => void;
    onDeleteTask: (id: string) => void;
}

type TabMode = 'list' | 'gantt';

const INITIAL_TASK_FORM: Task = {
    id: '',
    projectId: '',
    name: '',
    customId: '',
    description: '',
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    progress: 0,
    status: TaskStatus.NOT_STARTED,
    dependencies: [],
    linked_unit_id: '',
    linked_phase_id: '',
    linked_subtasks: []
};

// Date methods moved to dateUtils.ts

const checkConflict = (task: Task, allTasks: Task[]) => {
    if (!task.linked_unit_id) return false;
    const start = parseLocalDate(task.start);
    const end = parseLocalDate(task.end);

    return allTasks.some(other => {
        if (other.id === task.id || other.linked_unit_id !== task.linked_unit_id) return false;
        const oStart = parseLocalDate(other.start);
        const oEnd = parseLocalDate(other.end);
        return (start <= oEnd && end >= oStart);
    });
};

const getSectorColor = (phaseId?: string) => {
    if (!phaseId) return 'bg-slate-300';

    const colorMap: Record<string, string> = {
        'PROJ': 'bg-violet-600',
        'ESTR': 'bg-blue-600',
        'ALVE': 'bg-orange-600',
        'IMPE': 'bg-cyan-600',
        'HIDR': 'bg-indigo-600',
        'ELET': 'bg-yellow-600',
        'REBO': 'bg-slate-600',
        'PISO': 'bg-stone-600',
        'REVE': 'bg-emerald-600',
        'PINT': 'bg-rose-600',
        'ACAB': 'bg-violet-600',
        // Support for existing names
        'structure': 'bg-blue-600',
        'masonry': 'bg-orange-600',
        'waterproofing': 'bg-cyan-600',
        'hydraulic': 'bg-indigo-600',
        'electrical': 'bg-yellow-600',
        'plaster': 'bg-slate-600',
        'flooring': 'bg-stone-600',
        'coating': 'bg-emerald-600',
        'painting': 'bg-rose-600',
        'finishing': 'bg-violet-600'
    };

    return colorMap[phaseId] || 'bg-blue-500';
};

export const GanttView: React.FC<GanttViewProps> = ({ tasks, projects, onAddTask, onUpdateTask, onDeleteTask }) => {
    const [tabMode, setTabMode] = useState<TabMode>('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Task>(INITIAL_TASK_FORM);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Gantt Window calculation
    const timelineDates = useMemo(() => {
        const dates = [];
        const today = new Date();
        const start = addDays(today, -7);
        for (let i = 0; i < 45; i++) {
            dates.push(addDays(start, i));
        }
        return dates;
    }, []);

    const activeProject = useMemo(() => {
        return projects.find(p => p.id === formData.projectId) || projects[0];
    }, [formData.projectId, projects]);

    const projectPhases: PhaseConfig[] = useMemo(() => {
        return (activeProject?.phases && activeProject.phases.length > 0) ? activeProject.phases : DEFAULT_PHASES;
    }, [activeProject]);

    const projectLocations = useMemo(() => {
        if (!activeProject?.structure?.levels) return [];
        const locs: { id: string, label: string, name: string, activePhases?: string[] }[] = [];
        activeProject.structure.levels.forEach(level => {
            locs.push({ id: level.id, label: level.label, name: level.label, activePhases: level.activePhases });
            level.units.forEach(unit => locs.push({ id: unit.id, label: `${level.label} > ${unit.name}`, name: unit.name, activePhases: level.activePhases }));
        });
        return locs;
    }, [activeProject]);

    const handleTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isEditing) await onUpdateTask(formData);
            else await onAddTask(formData);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Erro ao salvar tarefa:", error);
            alert("Não foi possível salvar a tarefa. Verifique sua conexão e os dados inseridos.");
        } finally {
            setSaving(false);
        }
    };

    const handleOpenAdd = (predecessor?: Task) => {
        setIsEditing(false);
        const newId = Math.random().toString(36).substr(2, 9);
        if (predecessor) {
            const predEnd = parseLocalDate(predecessor.end);
            const newStart = addDays(predEnd, 1);
            setFormData({ ...INITIAL_TASK_FORM, id: newId, projectId: predecessor.projectId, start: formatLocalDate(newStart), end: formatLocalDate(addDays(newStart, 5)), dependencies: [predecessor.id], linked_unit_id: predecessor.linked_unit_id || '', linked_phase_id: predecessor.linked_phase_id || '', customId: predecessor.customId });
        } else {
            setFormData({ ...INITIAL_TASK_FORM, id: newId, projectId: projects[0]?.id || '' });
        }
        setIsModalOpen(true);
    };

    const handleOpenEdit = (task: Task) => {
        setIsEditing(true);
        setFormData({ ...task, linked_subtasks: task.linked_subtasks || [], linked_unit_id: task.linked_unit_id || '', linked_phase_id: task.linked_phase_id || '' });
        setIsModalOpen(true);
    };

    const pendingTasks = useMemo(() => {
        return tasks
            .filter(t => t.status !== TaskStatus.COMPLETED && t.progress < 100)
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }, [tasks]);

    const completedTasks = useMemo(() => {
        return tasks
            .filter(t => t.status === TaskStatus.COMPLETED || t.progress === 100)
            .sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime()); // Newer first
    }, [tasks]);

    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }, [tasks]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">

            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><GanttChart size={16} /></div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Planejamento Executivo</h2>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-inner">
                        <button onClick={() => setTabMode('list')} className={`p-1.5 rounded transition-all ${tabMode === 'list' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:bg-slate-50'}`} title="Visão em Lista"><LayoutList size={14} /></button>
                        <button onClick={() => setTabMode('gantt')} className={`p-1.5 rounded transition-all ${tabMode === 'gantt' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:bg-slate-50'}`} title="Visão em Gantt"><GanttChart size={14} /></button>
                    </div>
                    <button onClick={() => handleOpenAdd()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-blue-700 shadow-sm flex items-center gap-1.5">
                        <Plus size={12} /> <span className="hidden md:inline">Nova Atividade</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-white relative">
                {tabMode === 'list' ? (
                    <div className="w-full md:min-w-[700px]">
                        {/* Desktop View */}
                        <table className="hidden md:table w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white z-20 shadow-sm border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest w-24 bg-white">Setor</th>
                                    <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest bg-white">Descrição da Atividade</th>
                                    <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center w-28 bg-white">Status</th>
                                    <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest w-40 bg-white">Progresso Físico</th>
                                    <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right w-24 bg-white">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {pendingTasks.length > 0 && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={5} className="px-4 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest border-y border-slate-100">Atividades em Aberto ({pendingTasks.length})</td>
                                    </tr>
                                )}
                                {pendingTasks.map((task) => {
                                    const hasConflict = checkConflict(task, tasks);
                                    const isOverdue = new Date(task.end) < new Date() && task.progress < 100;
                                    const isActiveToday = new Date(task.start) <= new Date() && new Date(task.end) >= new Date() && task.status !== TaskStatus.COMPLETED;
                                    return (
                                        <tr key={task.id} className={`hover:bg-blue-50/30 transition-colors group cursor-pointer ${isActiveToday ? 'bg-blue-50/40' : ''}`} onClick={() => handleOpenEdit(task)}>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${getSectorColor(task.linked_phase_id)}`} />
                                                    <span className="font-bold text-[8px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate block uppercase">
                                                        {projectLocations.find(l => l.id === task.linked_unit_id)?.label || task.customId || 'Geral'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-black text-[10px] uppercase leading-tight text-slate-800`}>{task.name}</span>
                                                        {isOverdue && (
                                                            <span className="text-[7px] font-black bg-red-100 text-red-600 px-1 rounded-sm border border-red-200 animate-pulse">ATRASADA</span>
                                                        )}
                                                        {hasConflict && (
                                                            <div className="group/conflict relative">
                                                                <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                                                                <div className="absolute left-full ml-2 top-0 bg-red-900 text-white text-[8px] p-2 rounded shadow-xl z-50 w-32 hidden group-hover/conflict:block uppercase font-black">
                                                                    Conflito: Outra tarefa agendada para este local nas mesmas datas.
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                                                        <Calendar size={8} />
                                                        <span className="text-[8px] font-bold">
                                                            {parseLocalDate(task.start).toLocaleDateString('pt-BR')} — {parseLocalDate(task.end).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-center hidden md:table-cell">
                                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md border ${task.progress > 0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all bg-blue-500`} style={{ width: `${task.progress}%` }}></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-500 w-6">{task.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => handleOpenAdd(task)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Sequenciar"><GitBranch size={14} /></button>
                                                    <button onClick={() => onDeleteTask(task.id)} className="p-1 text-slate-300 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {completedTasks.length > 0 && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={5} className="px-4 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest border-y border-slate-100">Atividades Concluídas ({completedTasks.length})</td>
                                    </tr>
                                )}
                                {completedTasks.map((task) => {
                                    return (
                                        <tr key={task.id} className="hover:bg-slate-50 transition-colors group cursor-pointer opacity-70" onClick={() => handleOpenEdit(task)}>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${getSectorColor(task.linked_phase_id)}`} />
                                                    <span className="font-bold text-[8px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 truncate block uppercase">
                                                        {projectLocations.find(l => l.id === task.linked_unit_id)?.label || task.customId || 'Geral'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-black text-[10px] uppercase leading-tight text-slate-400 line-through`}>{task.name}</span>
                                                        <CheckCircle2 size={10} className="text-emerald-500" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 opacity-40">
                                                        <Calendar size={8} />
                                                        <span className="text-[8px] font-bold">
                                                            Concluída em {parseLocalDate(task.end).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-center hidden md:table-cell">
                                                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md border bg-emerald-50 text-emerald-600 border-emerald-100">
                                                    CONCLUÍDO
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-emerald-50 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 w-full"></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-emerald-600 w-6">100%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => onDeleteTask(task.id)} className="p-1 text-slate-300 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {tasks.length === 0 && (
                                    <tr><td colSpan={5} className="py-20 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma tarefa planejada</td></tr>
                                )}
                            </tbody>
                        </table>

                        {/* Mobile View - Compact */}
                        <div className="md:hidden divide-y divide-slate-100 bg-white">
                            {pendingTasks.length > 0 && (
                                <div className="px-3 py-1.5 bg-slate-50/80 text-[7px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">Em Aberto ({pendingTasks.length})</div>
                            )}
                            {pendingTasks.map((task) => {
                                const isOverdue = new Date(task.end) < new Date() && task.progress < 100;
                                const isActiveToday = new Date(task.start) <= new Date() && new Date(task.end) >= new Date() && task.status !== TaskStatus.COMPLETED;
                                return (
                                    <div key={task.id} className={`px-3 py-2 active:bg-slate-50 transition-colors ${isActiveToday ? 'border-l-2 border-l-blue-500 bg-blue-50/20' : ''}`} onClick={() => handleOpenEdit(task)}>
                                        {/* Row 1: Sector dot + Name + Status badge */}
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getSectorColor(task.linked_phase_id)}`} />
                                            <span className="font-black text-[10px] text-slate-800 uppercase leading-tight truncate flex-1">{task.name}</span>
                                            {isOverdue && (
                                                <span className="text-[6px] font-black bg-red-100 text-red-600 px-1 rounded-sm border border-red-200 shrink-0">ATRASO</span>
                                            )}
                                            <span className="text-[8px] font-black text-slate-500 shrink-0">{task.progress}%</span>
                                        </div>
                                        {/* Row 2: Location + Date + Progress bar */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase truncate max-w-[80px]">
                                                {projectLocations.find(l => l.id === task.linked_unit_id)?.label || 'Geral'}
                                            </span>
                                            <span className="text-slate-200">·</span>
                                            <span className="text-[7px] font-bold text-slate-400 shrink-0">
                                                {parseLocalDate(task.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} → {parseLocalDate(task.end).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                            </span>
                                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden ml-1">
                                                <div className="h-full bg-blue-500 transition-all" style={{ width: `${task.progress}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {completedTasks.length > 0 && (
                                <div className="px-3 py-1.5 bg-slate-50/80 text-[7px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">Concluídas ({completedTasks.length})</div>
                            )}
                            {completedTasks.map((task) => (
                                <div key={task.id} className="px-3 py-1.5 opacity-60" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                                        <span className="font-black text-[9px] text-slate-400 uppercase truncate line-through flex-1">{task.name}</span>
                                        <span className="text-[7px] font-black text-emerald-600 shrink-0">100%</span>
                                    </div>
                                </div>
                            ))}

                            {tasks.length === 0 && (
                                <div className="py-16 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma tarefa planejada</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="min-w-fit flex flex-col relative w-full">
                        {/* Header Row: Corner + Dates */}
                        <div className="flex sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm min-w-max">
                            <div className="sticky left-0 z-50 w-72 shrink-0 bg-white border-r border-slate-200 px-3 py-2 text-[8px] font-black uppercase text-slate-400 flex items-center justify-between shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                                <span>Atividade</span>
                                <span className="opacity-50">{sortedTasks.length} Registros</span>
                            </div>
                            <div className="flex">
                                {timelineDates.map((date, idx) => {
                                    const isToday = date.toDateString() === new Date().toDateString();
                                    return (
                                        <div key={idx} className={`w-8 shrink-0 text-center py-2 border-r border-slate-100 flex flex-col items-center justify-center ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
                                            <span className="text-[6px] font-black text-slate-400 uppercase leading-none mb-0.5">{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date)}</span>
                                            <span className={`text-[8px] font-black leading-none ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>{date.getDate()}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="min-w-max">
                            {sortedTasks.map(task => {
                                const start = parseLocalDate(task.start);
                                const end = parseLocalDate(task.end);
                                const timelineStart = timelineDates[0];
                                const timelineEnd = timelineDates[timelineDates.length - 1];

                                if (end < timelineStart || start > timelineEnd) return null;

                                const isActiveToday = start <= new Date() && end >= new Date() && task.status !== TaskStatus.COMPLETED;

                                const leftOffset = Math.max(0, Math.floor((start.getTime() - timelineStart.getTime()) / 86400000)) * 32;
                                const duration = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
                                const width = duration * 32;

                                return (
                                    <div key={task.id} className="flex border-b border-slate-50 group hover:bg-slate-50/50 min-w-max">
                                        <div className={`sticky left-0 z-30 w-72 shrink-0 bg-white border-r border-slate-100 px-3 py-2 flex flex-col justify-center overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] group-hover:bg-blue-50/10 transition-colors ${isActiveToday ? 'bg-blue-50/80 border-l-4 border-l-blue-500' : ''}`}>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${getSectorColor(task.linked_phase_id)}`} />
                                                <span className={`text-[9px] font-bold uppercase truncate leading-tight ${isActiveToday ? 'text-blue-700' : 'text-slate-800'}`}>{task.name}</span>
                                            </div>
                                            <span className="text-[7px] font-semibold text-slate-400 uppercase truncate pl-3.5">{task.customId || 'Atividade Geral'}</span>
                                        </div>
                                        <div className="flex relative h-10 items-center">
                                            <div
                                                onClick={() => handleOpenEdit(task)}
                                                className={`absolute h-5 rounded shadow-sm cursor-pointer transition-transform hover:scale-[1.01] flex items-center px-1 overflow-hidden border border-white/20 select-none ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' : getSectorColor(task.linked_phase_id)}`}
                                                style={{ left: `${leftOffset}px`, width: `${width}px` }}
                                            >
                                                <div className="absolute inset-0 bg-black/10 transition-all" style={{ width: `${100 - task.progress}%`, left: `${task.progress}%` }}></div>
                                                <div className="flex items-center justify-between w-full relative z-10">
                                                    <span className="text-[6px] font-black text-white uppercase truncate px-0.5">{task.progress}%</span>
                                                    {checkConflict(task, tasks) && <AlertTriangle size={8} className="text-white animate-pulse" />}
                                                </div>
                                            </div>

                                            {/* Quick Add Sequence Button */}
                                            <button
                                                onClick={() => handleOpenAdd(task)}
                                                className="absolute p-1 bg-white border border-slate-200 rounded-full shadow-lg text-blue-600 opacity-0 group-hover/timeline:opacity-100 transition-opacity z-20 hover:scale-110"
                                                style={{ left: `${leftOffset + width + 4}px` }}
                                                title="Sequenciar tarefa"
                                            >
                                                <ArrowRight size={10} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-none md:rounded-xl shadow-2xl w-full h-full md:h-auto md:max-w-lg animate-in zoom-in duration-200 flex flex-col max-h-screen md:max-h-[85vh]">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                {isEditing ? <Edit3 size={14} className="text-blue-600" /> : <Plus size={14} className="text-blue-600" />}
                                {isEditing ? 'Editar Atividade' : 'Nova Atividade'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 p-1 rounded-lg"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleTaskSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[8px] font-black text-slate-400 uppercase">Título da Atividade</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const loc = projectLocations.find(l => l.id === formData.linked_unit_id);
                                                const ph = projectPhases.find(p => p.id === formData.linked_phase_id);
                                                if (loc || ph) {
                                                    const newName = `${ph?.label || ''}${ph && loc ? ' - ' : ''}${loc?.label || ''}`;
                                                    setFormData({ ...formData, name: newName });
                                                }
                                            }}
                                            className="text-[7px] font-black text-blue-600 uppercase hover:underline"
                                        >
                                            Sugerir Nome
                                        </button>
                                    </div>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-bold text-xs text-slate-800 bg-slate-50" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Início</label>
                                        <input type="date" required value={formData.start} onChange={e => setFormData({ ...formData, start: e.target.value })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Término</label>
                                        <input type="date" required value={formData.end} onChange={e => setFormData({ ...formData, end: e.target.value })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 bg-white" />
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">Vínculo com Execução</label>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase">Cor no Cronograma:</span>
                                            <div className={`w-3.5 h-3.5 rounded-full ${getSectorColor(formData.linked_phase_id)} shadow-sm border border-white`} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1.5 ml-1"><MapPin size={10} className="text-blue-500" /> Local / Unidade (Onde?)</label>
                                            <select
                                                value={formData.linked_unit_id || ''}
                                                onChange={e => setFormData({ ...formData, linked_unit_id: e.target.value, customId: projectLocations.find(l => l.id === e.target.value)?.name || '' })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                            >
                                                <option value="">Não vinculado a local</option>
                                                {projectLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.label}</option>)}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1.5 ml-1"><GanttChart size={10} className="text-blue-500" /> Etapa Técnica (O quê?)</label>
                                            <select
                                                value={formData.linked_phase_id || ''}
                                                onChange={e => setFormData({ ...formData, linked_phase_id: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                            >
                                                <option value="">Não vinculado a etapa</option>
                                                {projectPhases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1.5 ml-1"><ArrowRight size={10} className="text-blue-500" /> Atividade Precedente (Dependência)</label>
                                            <div className="relative group/dep">
                                                <select
                                                    value={formData.dependencies?.[0] || ''}
                                                    onChange={e => setFormData({ ...formData, dependencies: e.target.value ? [e.target.value] : [] })}
                                                    className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="">Nenhuma (Início Livre)</option>
                                                    {tasks.filter(t => t.id !== formData.id && t.projectId === formData.projectId).map(t => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name} {t.customId ? `[${t.customId}]` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ArrowRight size={12} />
                                                </div>
                                            </div>
                                            {formData.dependencies && formData.dependencies.length > 0 && (
                                                <p className="text-[7px] font-bold text-blue-600/60 uppercase ml-1 italic">
                                                    * Esta atividade começará após o término da selecionada.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-blue-600/5 p-2 rounded-lg border border-blue-100 flex items-start gap-2">
                                        <Link size={12} className="text-blue-600 mt-0.5 shrink-0" />
                                        <p className="text-[8px] font-bold text-blue-700/70 uppercase leading-tight">
                                            Ao vincular, o progresso físico será atualizado automaticamente ao concluir esta tarefa.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Progresso Real (%)</label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min="0" max="100" step="5" value={formData.progress} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })} className="flex-1 h-1 bg-slate-200 rounded-full appearance-none accent-blue-600" />
                                        <span className="text-xs font-black text-slate-700 w-8">{formData.progress}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase">Sair</button>
                                <button type="submit" disabled={saving} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-black text-[10px] uppercase shadow-md flex items-center gap-2">
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};