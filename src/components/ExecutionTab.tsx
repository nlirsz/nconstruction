import React, { useState, useMemo, useEffect } from 'react';
import { Project, LogEntry, UserProfile, PhaseConfig, UnitVerification, VerificationStatus, PhotoCategory, Task, TaskStatus, ProjectPhoto } from '../types';
import { supabase, uploadImage } from '../services/supabaseClient';
import {
    Check, ChevronDown, ChevronRight, Box, Zap, Layers, PaintBucket, Sparkles,
    GripHorizontal, Plus, Camera, Loader2, Save,
    Trash2, ListChecks, Building2, MapPin, ShieldAlert, Droplets, LayoutGrid,
    CheckCircle2, X, AlertTriangle, History, ImageIcon, ScanSearch, FileSpreadsheet,
    RefreshCcw, LayersIcon, ListTodo, Info, Tag, ArrowRight, Edit2, Link, GalleryHorizontal, Calendar, ArrowUpRight, Maximize2
} from 'lucide-react';
import { DEFAULT_PHASES, getPhaseIcon, getPhaseColor } from '../constants';

interface ExecutionTabProps {
    project: Project;
    onUpdateProgress: (progress: number) => void;
    userProfile?: UserProfile | null;
    currentUser?: any;
    initialUnitId?: string | null;
    initialPhaseId?: string | null;
    onClearInitialUnit?: () => void;
}

export const ExecutionTab: React.FC<ExecutionTabProps> = ({ project, onUpdateProgress, userProfile, currentUser, initialUnitId, initialPhaseId, onClearInitialUnit }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedFloors, setExpandedFloors] = useState<number[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<{ fIdx: number, uIdx: number } | null>(null);
    const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryTitle, setGalleryTitle] = useState("");
    const [galleryImages, setGalleryImages] = useState<{ url: string, description: string }[]>([]);
    const [uploadingTask, setUploadingTask] = useState<string | null>(null);
    const [isMassUpdateOpen, setIsMassUpdateOpen] = useState(false);
    const [massUpdateData, setMassUpdateData] = useState({ phaseId: '', progress: 0, subtasks: [] as string[] });
    const [massSelectedUnits, setMassSelectedUnits] = useState<string[]>([]);

    const projectPhases: PhaseConfig[] = useMemo(() => {
        return (project.phases && project.phases.length > 0) ? project.phases : DEFAULT_PHASES;
    }, [project.phases]);

    const activePhasesForUnit = useMemo(() => {
        if (!selectedUnit || !data[selectedUnit.fIdx]) return [];
        const floor = data[selectedUnit.fIdx];
        if (floor.activePhases && floor.activePhases.length > 0) {
            return projectPhases.filter(p => floor.activePhases.includes(p.id));
        }
        return projectPhases;
    }, [selectedUnit, data, projectPhases]);

    useEffect(() => { loadData(); }, [project.id, projectPhases]);

    useEffect(() => {
        if (initialUnitId && data.length > 0) {
            let found = false;
            data.forEach((floor, fIdx) => {
                floor.units.forEach((unit: any, uIdx: number) => {
                    if (unit.id === initialUnitId) {
                        setSelectedUnit({ fIdx, uIdx });
                        setExpandedFloors(prev => prev.includes(floor.floor) ? prev : [...prev, floor.floor]);
                        if (initialPhaseId) setActivePhaseId(initialPhaseId);
                        found = true;
                    }
                });
            });
            if (found && onClearInitialUnit) onClearInitialUnit();
        }
    }, [initialUnitId, initialPhaseId, data]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: levels, error: lError } = await supabase
                .from('project_levels')
                .select('*, units:project_units(*)')
                .eq('project_id', project.id)
                .order('display_order', { ascending: true });

            if (lError) throw lError;

            const { data: progressRows } = await supabase
                .from('unit_progress')
                .select('*')
                .eq('project_id', project.id);

            const progressMap = new Map();
            progressRows?.forEach((p: any) => {
                if (!progressMap.has(p.unit_id)) progressMap.set(p.unit_id, {});
                progressMap.get(p.unit_id)[p.phase_id] = {
                    percentage: p.percentage,
                    subtasks: p.subtasks || {},
                    imageUrl: p.image_url
                };
            });

            const assembledData = levels.map((l: any) => ({
                floor: l.display_order,
                label: l.label,
                activePhases: l.active_phases,
                units: (l.units || []).sort((a: any, b: any) => a.display_order - b.display_order).map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    phases: progressMap.get(u.id) || {}
                }))
            }));

            setData(assembledData);
            if (assembledData.length > 0 && expandedFloors.length === 0) setExpandedFloors([assembledData[0].floor]);
        } catch (err: any) { console.error(err); } finally { setLoading(false); }
    };

    const handleUpdateSubtask = (name: string, val: number) => {
        if (!selectedUnit || !activePhaseId) return;
        const newData = JSON.parse(JSON.stringify(data));
        const unit = newData[selectedUnit.fIdx].units[selectedUnit.uIdx];
        if (!unit.phases[activePhaseId]) unit.phases[activePhaseId] = { percentage: 0, subtasks: {} };
        const phase = unit.phases[activePhaseId];
        const currentTaskData = phase.subtasks?.[name] || { progress: 0 };
        const newTaskData = typeof currentTaskData === 'object' ? { ...currentTaskData, progress: val } : { progress: val, imageUrl: null };
        const newSubtasks = { ...(phase.subtasks || {}), [name]: newTaskData };
        const currentPhaseConfig = projectPhases.find(p => p.id === activePhaseId);
        const templateSubtasks = currentPhaseConfig?.subtasks || [];
        let sum = 0;
        templateSubtasks.forEach(taskName => { const task = newSubtasks[taskName]; sum += (typeof task === 'object' ? task.progress : task) || 0; });
        const avg = templateSubtasks.length === 0 ? val : Math.round(sum / templateSubtasks.length);
        unit.phases[activePhaseId] = { ...phase, subtasks: newSubtasks, percentage: avg };
        setData(newData);
    };

    const handleSaveProgressOnly = async () => {
        if (!selectedUnit || !activePhaseId) return;
        setSaving(true);
        try {
            const unit = data[selectedUnit.fIdx].units[selectedUnit.uIdx];
            const currentPhaseState = unit.phases[activePhaseId] || { percentage: 0, subtasks: {} };
            await supabase.from('unit_progress').upsert({ unit_id: unit.id, project_id: project.id, phase_id: activePhaseId, percentage: currentPhaseState.percentage, subtasks: currentPhaseState.subtasks, updated_at: new Date().toISOString() }, { onConflict: 'unit_id, phase_id' });

            // Sincronização: Atualiza tarefa correspondente no cronograma (Gantt)
            const { data: tasksToUpdate } = await supabase
                .from('tasks')
                .select('id')
                .eq('project_id', project.id)
                .eq('linked_unit_id', unit.id)
                .eq('linked_phase_id', activePhaseId);

            if (tasksToUpdate && tasksToUpdate.length > 0) {
                const status = currentPhaseState.percentage === 100 ? TaskStatus.COMPLETED :
                    currentPhaseState.percentage > 0 ? TaskStatus.IN_PROGRESS : TaskStatus.NOT_STARTED;

                for (const t of tasksToUpdate) {
                    await supabase.from('tasks').update({
                        progress: currentPhaseState.percentage,
                        status: status
                    }).eq('id', t.id);
                }
            }

            const globalProgress = calculateGlobalProgress(data);
            await supabase.from('projects').update({ progress: globalProgress }).eq('id', project.id);
            onUpdateProgress(globalProgress);
            setActivePhaseId(null);
        } catch (err: any) { alert("Erro ao salvar"); } finally { setSaving(false); }
    };

    const calculateGlobalProgress = (matrixData: any[]) => {
        let totalP = 0, count = 0;
        matrixData.forEach(f => f.units.forEach((u: any) => projectPhases.forEach(p => { if (f.activePhases && f.activePhases.length > 0 && !f.activePhases.includes(p.id)) return; totalP += u.phases?.[p.id]?.percentage || 0; count++; })));
        return count === 0 ? 0 : Math.round(totalP / count);
    };

    const handleAddPhoto = async (taskName: string | "MACRO") => {
        if (!selectedUnit || !activePhaseId) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async (e: any) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            setUploadingTask(taskName);
            const unit = data[selectedUnit.fIdx].units[selectedUnit.uIdx];
            const floorLabel = getFloorLabel(data[selectedUnit.fIdx].floor);
            const dateStr = new Date().toLocaleDateString('pt-BR');
            const locationLabel = `${floorLabel} • ${unit.name}`;

            try {
                const uploadedPhotos = [];
                for (const file of files) {
                    const url = await uploadImage(file, `execution/${project.id}/${unit.id}`);
                    if (url) {
                        const photoId = Math.random().toString(36).substr(2, 9).toUpperCase();
                        const description = `${taskName === 'MACRO' ? 'FOTO MACRO' : taskName}`;

                        // NEW: Sync with project_photos
                        const { data: photoData, error: photoError } = await supabase.from('project_photos').insert({
                            project_id: project.id,
                            url,
                            description: description,
                            category: taskName === 'MACRO' ? 'evolution' : 'inspection',
                            location_label: locationLabel,
                            created_by: currentUser?.email
                        }).select().single();

                        if (!photoError && photoData) {
                            uploadedPhotos.push({
                                id: photoData.id, // Use the real DB ID
                                url,
                                description: photoData.description,
                                created_at: photoData.created_at
                            });
                        } else {
                            // Fallback if table doesn't exist or error
                            uploadedPhotos.push({
                                id: photoId,
                                url,
                                description: `${dateStr} - ${description}`,
                                created_at: new Date().toISOString()
                            });
                        }
                    }
                }

                const newData = JSON.parse(JSON.stringify(data));
                const targetUnit = newData[selectedUnit.fIdx].units[selectedUnit.uIdx];
                if (!targetUnit.phases[activePhaseId]) targetUnit.phases[activePhaseId] = { percentage: 0, subtasks: {} };

                if (taskName === "MACRO") {
                    const existingPhotos = targetUnit.phases[activePhaseId].macroPhotos || [];
                    targetUnit.phases[activePhaseId].macroPhotos = [...existingPhotos, ...uploadedPhotos];
                } else {
                    const unitSubtasks = targetUnit.phases[activePhaseId].subtasks || {};
                    const taskData = unitSubtasks[taskName] || { progress: 0, photos: [] };
                    const existingPhotos = taskData.photos || (taskData.imageUrl ? [{ id: 'OLD', url: taskData.imageUrl, description: 'Foto anterior' }] : []);
                    unitSubtasks[taskName] = { ...taskData, photos: [...existingPhotos, ...uploadedPhotos] };
                    targetUnit.phases[activePhaseId].subtasks = unitSubtasks;
                }

                setData(newData);
            } catch (err) {
                console.error("Erro no upload", err);
                alert("Erro ao enviar fotos");
            } finally {
                setUploadingTask(null);
            }
        };
        input.click();
    };

    const handleDeletePhotoFromGallery = async (photoId: string) => {
        if (!confirm("Excluir esta foto permanentemente?")) return;

        try {
            // Delete from project_photos
            await supabase.from('project_photos').delete().eq('id', photoId);

            // Delete from local data state
            const newData = JSON.parse(JSON.stringify(data));
            const targetUnit = newData[selectedUnit!.fIdx].units[selectedUnit!.uIdx];
            const phase = targetUnit.phases[activePhaseId!];

            if (galleryTitle === "FOTOS MACRO") {
                phase.macroPhotos = phase.macroPhotos.filter((p: any) => p.id !== photoId);
            } else {
                const taskData = phase.subtasks[galleryTitle];
                if (taskData) {
                    taskData.photos = taskData.photos.filter((p: any) => p.id !== photoId);
                }
            }

            setData(newData);
            setGalleryImages(prev => prev.filter(p => p.id !== photoId));
            alert("Foto excluída com sucesso");
        } catch (err) {
            console.error("Erro ao excluir foto", err);
        }
    };

    const handleEditPhotoFromGallery = async (photoId: string, newDesc: string) => {
        try {
            await supabase.from('project_photos').update({ description: newDesc }).eq('id', photoId);

            const newData = JSON.parse(JSON.stringify(data));
            const targetUnit = newData[selectedUnit!.fIdx].units[selectedUnit!.uIdx];
            const phase = targetUnit.phases[activePhaseId!];

            const updateLocal = (photos: any[]) => photos.map(p => p.id === photoId ? { ...p, description: newDesc } : p);

            if (galleryTitle === "FOTOS MACRO") {
                phase.macroPhotos = updateLocal(phase.macroPhotos);
            } else {
                const taskData = phase.subtasks[galleryTitle];
                if (taskData) {
                    taskData.photos = updateLocal(taskData.photos);
                }
            }

            setData(newData);
            setGalleryImages(prev => prev.map(p => p.id === photoId ? { ...p, description: newDesc } : p));
        } catch (err) {
            console.error("Erro ao editar foto", err);
        }
    };

    const openGallery = (title: string, photos: any[]) => {
        setGalleryTitle(title);
        setGalleryImages(photos.map(p => ({
            id: p.id,
            url: typeof p === 'string' ? p : p.url,
            description: p.description || ""
        })));
        setGalleryOpen(true);
    };

    const handleExportCSV = () => {
        const headers = ["Pavimento", "Unidade", "Fase", "Progresso (%)", "Subetapas Concluídas"];
        const rows: string[][] = [];

        data.forEach(floor => {
            floor.units.forEach((unit: any) => {
                projectPhases.forEach(phase => {
                    const unitPhase = unit.phases?.[phase.id];
                    if (unitPhase) {
                        const subtasks = Object.entries(unitPhase.subtasks || {})
                            .filter(([_, val]: any) => (typeof val === 'object' ? val.progress : val) === 100)
                            .map(([name]) => name)
                            .join("; ");
                        rows.push([
                            getFloorLabel(floor.floor),
                            unit.name,
                            phase.label,
                            unitPhase.percentage.toString(),
                            subtasks
                        ]);
                    }
                });
            });
        });

        const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `progresso_${project.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleMassUpdate = async () => {
        if (!massUpdateData.phaseId || massSelectedUnits.length === 0) return;
        setSaving(true);
        try {
            const updates = massSelectedUnits.map(async (unitId) => {
                const subtasksObj: any = {};
                if (massUpdateData.subtasks.length > 0) {
                    massUpdateData.subtasks.forEach(st => {
                        subtasksObj[st] = { progress: massUpdateData.progress };
                    });
                }

                return supabase.from('unit_progress').upsert({
                    project_id: project.id,
                    unit_id: unitId,
                    phase_id: massUpdateData.phaseId,
                    percentage: massUpdateData.progress,
                    subtasks: subtasksObj,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'project_id,unit_id,phase_id' });
            });

            await Promise.all(updates);
            await loadData();
            setIsMassUpdateOpen(false);
            setMassSelectedUnits([]);
            setMassUpdateData({ phaseId: '', progress: 0, subtasks: [] });
        } catch (err) {
            console.error("Erro no mass update", err);
            alert("Erro ao atualizar unidades em massa");
        } finally {
            setSaving(false);
        }
    };

    const getFloorLabel = (floor: number) => {
        if (project.structure?.levels) { const level = project.structure.levels.find(l => l.order === floor); if (level) return level.label; }
        return `${floor}º Pav.`;
    };

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

    return (
        <div className="flex flex-col lg:flex-row gap-4 animate-in fade-in duration-500 pb-10">
            <div className="w-full lg:w-72 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col shrink-0 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-[10px] uppercase tracking-widest"><Building2 size={14} className="text-blue-600" /> Inventário</h3>
                    <div className="flex items-center gap-1.5">
                        <button onClick={handleExportCSV} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-emerald-600 transition-all" title="Exportar CSV"><FileSpreadsheet size={14} /></button>
                        <button onClick={() => setIsMassUpdateOpen(true)} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-blue-600 transition-all" title="Atualização em Massa"><LayersIcon size={14} /></button>
                        <button onClick={loadData} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-blue-600 transition-all"><RefreshCcw size={14} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-none custom-scrollbar">
                    {[...data].reverse().map((floor, rIdx) => {
                        const originalIdx = data.length - 1 - rIdx;
                        return (
                            <div key={floor.floor} className="border-b border-slate-50 last:border-0">
                                <button onClick={() => setExpandedFloors(prev => prev.includes(floor.floor) ? prev.filter(f => f !== floor.floor) : [...prev, floor.floor])} className={`w-full flex items-center justify-between px-3 py-2.5 text-[9px] font-black transition-all ${expandedFloors.includes(floor.floor) ? 'text-blue-600 bg-blue-50/20' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                                        {expandedFloors.includes(floor.floor) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        {getFloorLabel(floor.floor)}
                                    </span>
                                    <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 font-bold">{floor.units.length}</span>
                                </button>
                                {expandedFloors.includes(floor.floor) && (
                                    <div className="bg-slate-50/30 p-1.5 grid grid-cols-2 lg:grid-cols-1 gap-1">
                                        {floor.units.map((unit: any, uIdx: number) => (
                                            <button key={unit.id} onClick={() => { setSelectedUnit({ fIdx: originalIdx, uIdx }); setActivePhaseId(null); }} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedUnit?.fIdx === originalIdx && selectedUnit?.uIdx === uIdx ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-100 hover:border-blue-300'}`}>
                                                <span className="truncate">{unit.name}</span>
                                                {selectedUnit?.fIdx === originalIdx && selectedUnit?.uIdx === uIdx && <CheckCircle2 size={10} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="flex-1">
                {!selectedUnit ? (
                    <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <LayoutGrid size={32} className="opacity-10" />
                        <div className="text-center">
                            <p className="font-black uppercase tracking-[0.1em] text-[10px] text-slate-800">Selecione uma Unidade</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">Navegue na lista para auditar as frentes de trabalho</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-400">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white"><MapPin size={16} /></div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-sm leading-none">{data[selectedUnit.fIdx].units[selectedUnit.uIdx].name}</h3>
                                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">{getFloorLabel(data[selectedUnit.fIdx].floor)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedUnit(null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><X size={18} /></button>
                            </div>

                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {activePhasesForUnit.map(p => {
                                    const unitPhase = data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases?.[p.id] || { percentage: 0 };
                                    const isActive = activePhaseId === p.id;
                                    return (
                                        <div key={p.id} className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer group flex flex-col gap-3 ${isActive ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-100 hover:border-blue-400'}`} onClick={() => setActivePhaseId(isActive ? null : p.id)}>
                                            <div className="flex justify-between items-start">
                                                <div className={`p-1.5 rounded-lg text-white shadow-sm ${getPhaseColor(p.color)}`}>{getPhaseIcon(p.icon, 14)}</div>
                                                <div className="text-right">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{p.label}</p>
                                                    <p className="text-lg font-black text-slate-900 mt-0.5">{unitPhase.percentage}%</p>
                                                </div>
                                            </div>
                                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-700 ${unitPhase.percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${unitPhase.percentage}%` }}></div>
                                            </div>

                                            {/* Macro Photo Access */}
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex -space-x-2">
                                                    {(unitPhase.macroPhotos || []).slice(0, 3).map((ph: any, i: number) => (
                                                        <img key={i} src={ph.url} className="w-5 h-5 rounded-full border border-white object-cover" />
                                                    ))}
                                                    {(unitPhase.macroPhotos || []).length > 3 && <div className="w-5 h-5 rounded-full bg-slate-100 border border-white text-[7px] flex items-center justify-center font-bold font-black">+{(unitPhase.macroPhotos || []).length - 3}</div>}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAddPhoto("MACRO"); }}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                >
                                                    {uploadingTask === "MACRO" ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {activePhaseId && selectedUnit && (
                <div className="fixed inset-0 z-[210] flex justify-end animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setActivePhaseId(null)}></div>
                    <div className="relative w-full md:max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-0 md:slide-in-from-right-8 duration-500">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl text-white ${getPhaseColor(projectPhases.find(p => p.id === activePhaseId)?.color || 'slate')} shadow-lg`}>{getPhaseIcon(projectPhases.find(p => p.id === activePhaseId)?.icon || 'Box', 16)}</div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm leading-none">{projectPhases.find(p => p.id === activePhaseId)?.label}</h3>
                                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">{data[selectedUnit.fIdx].units[selectedUnit.uIdx].name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openGallery("FOTOS MACRO", data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases[activePhaseId!]?.macroPhotos || [])}
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all flex items-center gap-1.5"
                                    title="Ver Galeria Macro"
                                >
                                    <GalleryHorizontal size={18} />
                                </button>
                                <button onClick={() => setActivePhaseId(null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white custom-scrollbar">
                            {data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases[activePhaseId!]?.macroPhotos?.length > 0 && (
                                <div className="relative group">
                                    <img
                                        src={data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases[activePhaseId!]?.macroPhotos.slice(-1)[0].url}
                                        className="w-full h-40 object-cover rounded-2xl border border-slate-200 shadow-inner"
                                        alt="Macro view"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 rounded-b-2xl">
                                        <p className="text-[8px] font-black text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                                            <ImageIcon size={10} /> Foto Macro Recente
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => openGallery("FOTOS MACRO", data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases[activePhaseId!]?.macroPhotos || [])}
                                        className="absolute top-2 right-2 p-2 bg-white/20 backdrop-blur-md text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all border border-white/30"
                                    >
                                        <Maximize2 size={14} />
                                    </button>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><ListChecks size={14} className="text-blue-600" /> Itens Técnicos</h4>
                                <div className="space-y-2">
                                    {(projectPhases.find(p => p.id === activePhaseId)?.subtasks || []).map((name) => {
                                        const unitSubtasks = data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases[activePhaseId!]?.subtasks || {};
                                        const taskData = unitSubtasks[name] || {};
                                        const progress = typeof taskData === 'object' ? taskData.progress : taskData || 0;
                                        const photos = taskData.photos || (taskData.imageUrl ? [{ url: taskData.imageUrl, description: "Foto anterior" }] : []);

                                        return (
                                            <div key={name} className="bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[10px] font-bold text-slate-800 uppercase leading-tight w-2/3">{name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => handleAddPhoto(name)}
                                                            className="text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors"
                                                        >
                                                            {uploadingTask === name ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                                        </button>
                                                        {photos.length > 0 && (
                                                            <button
                                                                onClick={() => openGallery(name, photos)}
                                                                className="text-emerald-600 hover:bg-emerald-100 p-1 rounded transition-colors flex items-center gap-1"
                                                            >
                                                                <ImageIcon size={12} />
                                                                <span className="text-[9px] font-black">{photos.length}</span>
                                                            </button>
                                                        )}
                                                        <span className={`text-xs font-black ${progress === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{progress}%</span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="10"
                                                    value={progress}
                                                    onChange={(e) => handleUpdateSubtask(name, parseInt(e.target.value))}
                                                    className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                            <button onClick={() => setActivePhaseId(null)} className="text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 px-4">Voltar</button>
                            <button onClick={handleSaveProgressOnly} disabled={saving} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-md hover:bg-slate-800 disabled:opacity-70 transition-all flex items-center gap-2">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Salvar Auditoria
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mass Update Modal */}
            {isMassUpdateOpen && (
                <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center md:p-4 animate-in fade-in duration-300">
                    <div className="w-full h-full md:h-auto md:max-w-2xl bg-white rounded-none md:rounded-2xl shadow-2xl flex flex-col max-h-screen md:max-h-[90vh] animate-in zoom-in duration-300">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm flex items-center gap-2">
                                <LayersIcon size={18} className="text-blue-600" /> Atualização em Massa
                            </h3>
                            <button onClick={() => setIsMassUpdateOpen(false)} className="text-slate-400 p-2 hover:bg-white rounded-xl transition-all"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                                <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
                                <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase tracking-tight">
                                    Selecione uma fase e o progresso para aplicar em todas as unidades selecionadas de uma vez.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fase</label>
                                    <select
                                        value={massUpdateData.phaseId}
                                        onChange={(e) => setMassUpdateData({ ...massUpdateData, phaseId: e.target.value, subtasks: [] })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione a fase</option>
                                        {projectPhases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Novo Progresso (%)</label>
                                    <input
                                        type="number" min="0" max="100" step="10"
                                        value={massUpdateData.progress}
                                        onChange={(e) => setMassUpdateData({ ...massUpdateData, progress: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {massUpdateData.phaseId && (
                                <div className="space-y-3">
                                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Aplicar em Subetapas Específicas (Opcional)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(projectPhases.find(p => p.id === massUpdateData.phaseId)?.subtasks || []).map(st => (
                                            <button
                                                key={st}
                                                onClick={() => {
                                                    const current = massUpdateData.subtasks;
                                                    setMassUpdateData({
                                                        ...massUpdateData,
                                                        subtasks: current.includes(st) ? current.filter(s => s !== st) : [...current, st]
                                                    });
                                                }}
                                                className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${massUpdateData.subtasks.includes(st) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-300'}`}
                                            >
                                                <div className={`w-3 h-3 rounded border flex items-center justify-center ${massUpdateData.subtasks.includes(st) ? 'bg-white border-white' : 'border-slate-300'}`}>
                                                    {massUpdateData.subtasks.includes(st) && <Check size={8} className="text-blue-600" />}
                                                </div>
                                                <span className="truncate">{st}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">* Se nada for selecionado, o progresso será aplicado na fase inteira.</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    <span>Unidades ({massSelectedUnits.length} selecionadas)</span>
                                    <button
                                        onClick={() => {
                                            const allIds: string[] = [];
                                            data.forEach(f => f.units.forEach((u: any) => allIds.push(u.id)));
                                            setMassSelectedUnits(massSelectedUnits.length === allIds.length ? [] : allIds);
                                        }}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {massSelectedUnits.length === data.reduce((acc, f) => acc + f.units.length, 0) ? 'Desmarcar todas' : 'Selecionar todas'}
                                    </button>
                                </label>
                                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                    {data.map(floor => (
                                        <div key={floor.floor} className="bg-slate-50/50">
                                            <div className="px-3 py-2 bg-slate-100 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={floor.units.every((u: any) => massSelectedUnits.includes(u.id))}
                                                    onChange={() => {
                                                        const floorIds = floor.units.map((u: any) => u.id);
                                                        const allSelected = floorIds.every((id: any) => massSelectedUnits.includes(id));
                                                        if (allSelected) {
                                                            setMassSelectedUnits(massSelectedUnits.filter(id => !floorIds.includes(id)));
                                                        } else {
                                                            setMassSelectedUnits([...new Set([...massSelectedUnits, ...floorIds])]);
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-blue-600"
                                                />
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight">{getFloorLabel(floor.floor)}</span>
                                            </div>
                                            <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {floor.units.map((u: any) => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => setMassSelectedUnits(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-[9px] font-bold transition-all ${massSelectedUnits.includes(u.id) ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-300'}`}
                                                    >
                                                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${massSelectedUnits.includes(u.id) ? 'bg-white border-white' : 'border-slate-300'}`}>
                                                            {massSelectedUnits.includes(u.id) && <Check size={8} className="text-slate-900" />}
                                                        </div>
                                                        <span className="truncate">{u.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsMassUpdateOpen(false)} className="px-6 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900">Cancelar</button>
                            <button
                                onClick={handleMassUpdate}
                                disabled={saving || !massUpdateData.phaseId || massSelectedUnits.length === 0}
                                className="px-8 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <LayersIcon size={14} />}
                                Atualizar {massSelectedUnits.length} Unidades
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Modal */}
            {galleryOpen && (
                <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <ImageIcon size={16} className="text-blue-600" /> Galeria: {galleryTitle}
                            </h3>
                            <button onClick={() => setGalleryOpen(false)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-xl transition-all"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                            {galleryImages.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-300 gap-2">
                                    <ImageIcon size={48} className="opacity-10" />
                                    <p className="font-bold text-[10px] uppercase">Nenhuma foto encontrada</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {galleryImages.map((img, i) => (
                                        <div key={img.id || i} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm group">
                                            <div className="relative aspect-video overflow-hidden">
                                                <img src={img.url} alt={`Photo ${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <a href={img.url} target="_blank" rel="noreferrer" className="p-1.5 bg-black/50 text-white rounded-lg backdrop-blur-sm hover:bg-black/70">
                                                        <ArrowUpRight size={14} />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDeletePhotoFromGallery(img.id)}
                                                        className="p-1.5 bg-red-500/80 text-white rounded-lg backdrop-blur-sm hover:bg-red-600"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white">
                                                <div className="flex items-center justify-between gap-2">
                                                    <input
                                                        type="text"
                                                        defaultValue={img.description}
                                                        onBlur={(e) => {
                                                            if (e.target.value !== img.description) {
                                                                handleEditPhotoFromGallery(img.id, e.target.value);
                                                            }
                                                        }}
                                                        className="text-[10px] font-bold text-slate-700 leading-relaxed font-mono bg-transparent border-b border-transparent focus:border-blue-300 outline-none w-full py-0.5"
                                                        placeholder="Clique para adicionar descrição..."
                                                    />
                                                    <Edit2 size={10} className="text-slate-300" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setGalleryOpen(false)} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest">Fechar Galeria</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};