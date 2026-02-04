import React, { useState, useMemo, useEffect } from 'react';
import { Project, LogEntry, UserProfile, PhaseConfig } from '../types';
import { supabase } from '../services/supabaseClient';
import {
    Check, ChevronDown, ChevronUp, Box, Zap, Layers, PaintBucket, Sparkles,
    GripHorizontal, Eye, Loader2, FileText, Droplets, ShieldAlert,
    LayoutGrid, Building2, MapPin, ArrowRight, History, User, Camera, ImageIcon,
    ChevronLeft, ChevronRight, X, BarChart3, PieChart, Activity, TrendingUp, Info, Maximize2, Minimize2,
    Minus, ListChecks, ArrowUpRight, ArrowLeft
} from 'lucide-react';
import { BuildingVisualizer } from './BuildingVisualizer';
import { DEFAULT_PHASES, getPhaseIcon, getPhaseColor } from '../constants';

// Add CSS for hiding scrollbars but keeping functionality
const scrollbarStyle = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;
export const GlobalStyles = () => <style>{scrollbarStyle}</style>;

interface UnitProgressProps {
    project: Project;
    currentUser?: any;
    userProfile?: UserProfile | null;
    onUpdateProgress: (progress: number) => void;
    onNavigateToExecution?: (unitId: string, phaseId?: string) => void;
}

export const UnitProgress: React.FC<UnitProgressProps> = ({ project, onNavigateToExecution }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedFloors, setExpandedFloors] = useState<number[]>([]);
    const [selectedUnitSummary, setSelectedUnitSummary] = useState<{ floorLabel: string, unit: any } | null>(null);
    const [selectedSectorBreakdown, setSelectedSectorBreakdown] = useState<string | null>(null);
    const [selectedPhaseDetail, setSelectedPhaseDetail] = useState<{ unitName: string, phase: PhaseConfig, unitId: string, floorLabel: string, progressData: any } | null>(null);
    const [viewMode, setViewMode] = useState<'matrix' | 'visual'>('matrix');
    const [isVisualizerExpanded, setIsVisualizerExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const projectPhases: PhaseConfig[] = useMemo(() => {
        return (project.phases && project.phases.length > 0) ? project.phases : DEFAULT_PHASES;
    }, [project.phases]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const { data: levels } = await supabase
                    .from('project_levels')
                    .select('*, units:project_units(*)')
                    .eq('project_id', project.id)
                    .order('display_order', { ascending: true });

                if (levels && levels.length > 0) {
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

                    const finalData = assembledData.sort((a: any, b: any) => a.floor - b.floor);
                    setData(finalData);
                    if (finalData.length > 0 && expandedFloors.length === 0) setExpandedFloors([finalData[0].floor]);
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        loadData();
    }, [project.id]);

    const toggleFloor = (f: number) => setExpandedFloors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

    const handleExpandAll = () => {
        if (expandedFloors.length === data.length) setExpandedFloors([]);
        else setExpandedFloors(data.map(f => f.floor));
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        return data.map(floor => ({
            ...floor,
            units: floor.units.filter((u: any) => u.name.toLowerCase().includes(searchTerm.toLowerCase()))
        })).filter(floor => floor.units.length > 0);
    }, [data, searchTerm]);

    const getFloorLabel = (floor: number) => {
        if (project.structure?.levels) {
            const level = project.structure.levels.find(l => l.order === floor);
            if (level) return level.label;
        }
        return `${floor}º Pav.`;
    };

    const getApplicablePhases = (floorOrder: number) => {
        const levelConfig = project.structure?.levels?.find(l => l.order === floorOrder);
        if (levelConfig && levelConfig.activePhases && levelConfig.activePhases.length > 0) {
            return projectPhases.filter(p => levelConfig.activePhases!.includes(p.id));
        }
        return projectPhases;
    };

    const globalStats = useMemo(() => {
        const stats: Record<string, { total: number, count: number }> = {};
        projectPhases.forEach(p => stats[p.id] = { total: 0, count: 0 });

        data.forEach(floor => {
            floor.units.forEach((unit: any) => {
                projectPhases.forEach(p => {
                    if (floor.activePhases && floor.activePhases.length > 0 && !floor.activePhases.includes(p.id)) return;
                    const val = unit.phases?.[p.id]?.percentage || 0;
                    stats[p.id].total += val;
                    stats[p.id].count += 1;
                });
            });
        });

        return projectPhases.map(p => ({
            ...p,
            average: stats[p.id].count > 0 ? Math.round(stats[p.id].total / stats[p.id].count) : 0
        }));
    }, [data, projectPhases]);

    const floorStats = useMemo(() => {
        return data.map(floor => {
            const stats: Record<string, number> = {};
            projectPhases.forEach(p => {
                if (floor.activePhases && floor.activePhases.length > 0 && !floor.activePhases.includes(p.id)) {
                    stats[p.id] = -1;
                    return;
                }
                let total = 0;
                floor.units.forEach((unit: any) => {
                    total += unit.phases?.[p.id]?.percentage || 0;
                });
                stats[p.id] = floor.units.length > 0 ? Math.round(total / floor.units.length) : 0;
            });
            return { floor: floor.floor, label: getFloorLabel(floor.floor), averages: stats };
        });
    }, [data, projectPhases]);

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

    const gridTemplateColumns = `120px repeat(${projectPhases.length}, 50px)`;

    const getHeatmapColor = (pct: number) => {
        if (pct === -1) return 'bg-slate-50 text-slate-200';
        if (pct === 100) return 'bg-emerald-500 text-white';
        if (pct >= 70) return 'bg-emerald-50 text-emerald-700';
        if (pct >= 30) return 'bg-amber-50 text-amber-700';
        if (pct > 0) return 'bg-blue-50 text-blue-700';
        return 'bg-white text-slate-300 border border-slate-100';
    };

    const handleCellClick = (unit: any, phase: PhaseConfig, floorLabel: string) => {
        const progressData = unit.phases?.[phase.id] || { percentage: 0, subtasks: {} };
        setSelectedPhaseDetail({ unitName: unit.name, unitId: unit.id, phase, floorLabel, progressData });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-10 flex flex-col min-h-screen">
            <GlobalStyles />
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 px-1">
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">Detalhamento Físico</h2>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão tática e auditoria por unidade</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => setViewMode('matrix')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'matrix' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={12} /> Matriz</button>
                    <button onClick={() => setViewMode('visual')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'visual' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Maximize2 size={12} /> Visual</button>
                </div>
            </header>

            {/* BARRA DE FERRAMENTAS RECENTE */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
                <div className="relative w-full md:w-64">
                    <Eye size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar unidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExpandAll}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2"
                    >
                        {expandedFloors.length === data.length ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        {expandedFloors.length === data.length ? 'Recolher Tudo' : 'Expandir Tudo'}
                    </button>
                </div>
            </div>

            {/* NOVO: Resumo de Progresso (Insights) */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={14} className="text-blue-600" />
                    <h3 className="font-black text-slate-800 text-[9px] uppercase tracking-widest">Resumo de Progresso por Setor</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {globalStats.map(stat => (
                        <div key={stat.id} onClick={() => setSelectedSectorBreakdown(stat.id)} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center text-center cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group">
                            <div className={`p-1 rounded text-white ${getPhaseColor(stat.color)} mb-2 shadow-sm transition-transform group-hover:scale-110`}>{getPhaseIcon(stat.icon, 10)}</div>
                            <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1.5">{stat.label}</p>
                            <p className="text-base font-black text-slate-900 leading-none">{stat.average}%</p>
                            <div className="w-full h-1 bg-white rounded-full mt-2 overflow-hidden border border-slate-200">
                                <div className={`h-full ${stat.average === 100 ? 'bg-emerald-500' : 'bg-blue-500'} transition-all duration-700`} style={{ width: `${stat.average}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {viewMode === 'matrix' ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                    {/* Legendas rápidas */}
                    <div className="p-2 border-b border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-emerald-500"></div><span className="text-[7px] font-black text-slate-500 uppercase">Fim</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-amber-400"></div><span className="text-[7px] font-black text-slate-500 uppercase">Processo</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-blue-500"></div><span className="text-[7px] font-black text-slate-500 uppercase">Início</span></div>
                    </div>

                    <div className="overflow-auto flex-1 custom-scrollbar relative">
                        <div className="min-w-max">
                            {/* HEADER FIXO DA MATRIZ */}
                            <div className="grid gap-0 sticky top-0 z-[40] bg-white border-b border-slate-200" style={{ gridTemplateColumns }}>
                                <div className="sticky left-0 top-0 z-[50] bg-white px-4 py-3 border-r border-slate-200 shadow-sm flex items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pavimento</span>
                                </div>
                                {projectPhases.map(p => (
                                    <div key={p.id} className="text-center p-2 border-r border-slate-100 last:border-0 bg-white flex flex-col items-center justify-center">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center text-white mb-1 shadow-sm ${getPhaseColor(p.color)}`}>{getPhaseIcon(p.icon, 8)}</div>
                                        <span className="text-[7px] font-black text-slate-500 uppercase truncate w-full" title={p.label}>{p.code}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="p-0">
                                {[...filteredData].reverse().map((floor, reverseIdx) => {
                                    const originalFloorIdx = data.findIndex(f => f.floor === floor.floor);
                                    const floorPhases = getApplicablePhases(floor.floor);
                                    const fLabel = getFloorLabel(floor.floor);
                                    const isExpanded = expandedFloors.includes(floor.floor);

                                    return (
                                        <div key={floor.floor} className="border-b border-slate-100 last:border-0">
                                            {/* LINHA DE PAVIMENTO */}
                                            <div className={`grid gap-0 transition-colors sticky left-0 z-[35] w-full border-b border-slate-50 ${isExpanded ? 'bg-blue-50/10' : 'bg-white hover:bg-blue-50/5'}`} style={{ gridTemplateColumns }}>
                                                <div onClick={() => toggleFloor(floor.floor)} className="sticky left-0 z-[40] bg-inherit px-4 py-2 border-r border-slate-200 flex items-center gap-2 cursor-pointer transition-all">
                                                    <div className={`w-5 h-5 flex items-center justify-center rounded text-[8px] font-black transition-all ${isExpanded ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-700'}`}>{floor.floor}</div>
                                                    <span className="font-black text-[9px] text-slate-800 uppercase tracking-tighter truncate">{fLabel}</span>
                                                    {isExpanded ? <ChevronUp size={10} className="text-slate-300 ml-auto" /> : <ChevronDown size={10} className="text-slate-300 ml-auto" />}
                                                </div>
                                                {projectPhases.map((p) => {
                                                    const avg = floorStats[originalFloorIdx].averages[p.id];
                                                    return (
                                                        <div key={`avg-${p.id}`} className="h-full border-r border-slate-50 last:border-0 flex flex-col items-center justify-center p-1 bg-inherit">
                                                            {isExpanded ? (
                                                                <div className={`p-1 rounded text-white shadow-xs ${getPhaseColor(p.color)} opacity-80`}>{getPhaseIcon(p.icon, 8)}</div>
                                                            ) : (
                                                                <div className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${avg === 100 ? 'bg-emerald-100 text-emerald-800' : avg > 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-300'}`}>{avg === -1 ? '-' : `${avg}%`}</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* UNIDADES DO PAVIMENTO */}
                                            {isExpanded && (
                                                <div className="bg-white">
                                                    {floor.units.map((unit: any, uIdx: number) => (
                                                        <div key={unit.id} className="grid gap-0 group/unit bg-white hover:bg-slate-50 border-b border-slate-50 last:border-0" style={{ gridTemplateColumns }}>
                                                            <div onClick={() => { setSelectedUnitSummary({ floorLabel: fLabel, unit }); }} className="sticky left-0 z-[30] bg-white border-r border-slate-200 shadow-sm px-4 py-1.5 text-[8px] font-bold text-slate-700 flex items-center gap-2 cursor-pointer transition-colors group-hover/unit:bg-blue-50">
                                                                <div className="w-1 h-1 bg-blue-500 rounded-full shrink-0"></div>
                                                                <span className="truncate">{unit.name}</span>
                                                            </div>
                                                            {projectPhases.map(p => {
                                                                const isApplicable = floorPhases.some(fp => fp.id === p.id);
                                                                if (!isApplicable) return <div key={p.id} className="h-full border-r border-slate-50 bg-slate-50/10 flex items-center justify-center"><Minus size={10} className="text-slate-200" /></div>;
                                                                const ph = unit.phases[p.id] || { percentage: 0 };
                                                                return (
                                                                    <div key={p.id} onClick={() => handleCellClick(unit, p, fLabel)} className={`h-full border-r border-slate-50 last:border-0 flex items-center justify-center p-1 transition-all cursor-pointer hover:bg-blue-50/30`}>
                                                                        <div className={`w-full h-6 rounded flex items-center justify-center border transition-all ${ph.percentage === 100 ? 'bg-emerald-500 text-white border-emerald-600' : ph.percentage > 0 ? 'bg-white border-blue-200 text-blue-700' : 'text-slate-200 border-slate-50 bg-white'}`}>
                                                                            {ph.percentage === 100 ? <Check size={10} strokeWidth={4} /> : <span className="text-[8px] font-black">{ph.percentage}%</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden p-4 relative min-h-[500px]">
                    <div className="absolute top-4 right-4 z-[40]">
                        <button onClick={() => setIsVisualizerExpanded(true)} className="bg-slate-900 text-white px-2 py-1.5 rounded-lg shadow-md hover:scale-105 transition-all flex items-center gap-1.5 font-black text-[8px] uppercase tracking-widest"><Maximize2 size={12} /> Focar</button>
                    </div>
                    <div className="flex-1 bg-slate-50/20 flex items-center justify-center overflow-hidden">
                        <BuildingVisualizer
                            project={project}
                            data={data}
                            onUnitClick={(e, f, u) => {
                                const floor = data[f];
                                if (floor) setSelectedUnitSummary({ floorLabel: getFloorLabel(floor.floor), unit: floor.units[u] });
                            }}
                        />
                    </div>
                </div>
            )}

            {/* MODAL DE RESUMO DA UNIDADE (SETORES) */}
            {selectedUnitSummary && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center md:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedUnitSummary(null)}>
                    <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col max-h-screen md:max-h-[90vh] animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight leading-none">{selectedUnitSummary.unit.name}</h3>
                                    <p className="text-[10px] text-blue-600 font-bold uppercase mt-1 tracking-widest">{selectedUnitSummary.floorLabel}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex bg-white rounded-xl border border-slate-100 p-1 mr-2">
                                    <button
                                        onClick={() => {
                                            const allUnits = data.flatMap(f => f.units.map((u: any) => ({ ...u, floorLabel: getFloorLabel(f.floor) })));
                                            const currentIdx = allUnits.findIndex(u => u.id === selectedUnitSummary.unit.id);
                                            const prev = allUnits[currentIdx - 1];
                                            if (prev) setSelectedUnitSummary({ floorLabel: prev.floorLabel, unit: prev });
                                        }}
                                        className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const allUnits = data.flatMap(f => f.units.map((u: any) => ({ ...u, floorLabel: getFloorLabel(f.floor) })));
                                            const currentIdx = allUnits.findIndex(u => u.id === selectedUnitSummary.unit.id);
                                            const next = allUnits[currentIdx + 1];
                                            if (next) setSelectedUnitSummary({ floorLabel: next.floorLabel, unit: next });
                                        }}
                                        className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                                <button onClick={() => setSelectedUnitSummary(null)} className="text-slate-400 hover:text-red-500 p-2 bg-white rounded-xl border border-slate-100 transition-all"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar bg-slate-50/30">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Layers size={14} className="text-blue-500" /> Status por Setor
                            </h4>
                            <div className="grid gap-2">
                                {projectPhases.map(phase => {
                                    const ph = selectedUnitSummary.unit.phases[phase.id] || { percentage: 0 };
                                    return (
                                        <div
                                            key={phase.id}
                                            onClick={() => handleCellClick(selectedUnitSummary.unit, phase, selectedUnitSummary.floorLabel)}
                                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col gap-2"
                                        >
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg text-white shadow-sm transition-transform group-hover:scale-110 ${getPhaseColor(phase.color)}`}>
                                                        {getPhaseIcon(phase.icon, 12)}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{phase.label}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-sm font-black ${ph.percentage === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{ph.percentage}%</span>
                                                </div>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-700 ${ph.percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${ph.percentage}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                            <button onClick={() => setSelectedUnitSummary(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE DETALHAMENTO DO SETOR POR PAVIMENTO */}
            {selectedSectorBreakdown && (
                <div className="fixed inset-0 z-[550] flex items-center justify-center md:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedSectorBreakdown(null)}>
                    <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col max-h-screen md:max-h-[85vh] animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${getPhaseColor(projectPhases.find(p => p.id === selectedSectorBreakdown)?.color || 'blue')}`}>
                                    {getPhaseIcon(projectPhases.find(p => p.id === selectedSectorBreakdown)?.icon || 'Layers', 20)}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight leading-none">Detalhamento por Pavimento</h3>
                                    <p className="text-[10px] text-blue-600 font-bold uppercase mt-1 tracking-widest">{projectPhases.find(p => p.id === selectedSectorBreakdown)?.label}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSectorBreakdown(null)} className="text-slate-400 hover:text-red-500 p-2 bg-white rounded-xl border border-slate-100 transition-all"><X size={20} /></button>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-slate-50/30">
                            <div className="space-y-2">
                                {[...data].reverse().map((floor, idx) => {
                                    const origIdx = data.length - 1 - idx;
                                    const avg = floorStats[origIdx].averages[selectedSectorBreakdown];
                                    if (avg === -1) return null; // Not applicable

                                    return (
                                        <div
                                            key={floor.floor}
                                            onClick={() => {
                                                if (!expandedFloors.includes(floor.floor)) toggleFloor(floor.floor);
                                                setSelectedSectorBreakdown(null);
                                                // Scroll to floor could be added here
                                            }}
                                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">{floor.floor}</div>
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{getFloorLabel(floor.floor)}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                    <div className={`h-full transition-all duration-700 ${avg === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${avg}%` }}></div>
                                                </div>
                                                <span className={`text-xs font-black min-w-[35px] text-right ${avg === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{avg}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-slate-100">
                            <button onClick={() => setSelectedSectorBreakdown(null)} className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PHASE DETAIL MODAL (CHECKLIST) */}
            {selectedPhaseDetail && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedPhaseDetail(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-md ${getPhaseColor(selectedPhaseDetail.phase.color)}`}>
                                    {getPhaseIcon(selectedPhaseDetail.phase.icon, 18)}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-tight leading-none">{selectedPhaseDetail.phase.label}</h3>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{selectedPhaseDetail.floorLabel} • {selectedPhaseDetail.unitName}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPhaseDetail(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={20} /></button>
                        </div>

                        <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-white">
                            <div className="grid gap-2">
                                {selectedPhaseDetail.phase.subtasks.map((sub, idx) => {
                                    const subProgress = selectedPhaseDetail.progressData.subtasks?.[sub];
                                    const pct = typeof subProgress === 'object' ? (subProgress.progress || 0) : (subProgress || 0);
                                    return (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center font-black text-[9px] ${pct === 100 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                                        {pct === 100 ? <Check size={14} strokeWidth={4} /> : (idx + 1)}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-800 uppercase leading-tight">{sub}</span>
                                                </div>
                                                <span className={`text-[10px] font-black ${pct === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-white rounded-full overflow-hidden border border-slate-100">
                                                <div className={`h-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* MINI GALERIA DA UNIDADE */}
                            {(selectedPhaseDetail.progressData.macroPhotos?.length > 0 || Object.values(selectedPhaseDetail.progressData.subtasks || {}).some((t: any) => typeof t === 'object' && t.photos?.length > 0)) && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <ImageIcon size={14} className="text-blue-500" /> Fotos Registradas
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(selectedPhaseDetail.progressData.macroPhotos || []).map((photo: any, idx: number) => (
                                            <div key={`macro-${idx}`} className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative group cursor-pointer" onClick={() => window.open(photo.url, '_blank')}>
                                                <img src={photo.url} className="w-full h-full object-cover" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Maximize2 size={12} className="text-white" />
                                                </div>
                                            </div>
                                        ))}
                                        {Object.values(selectedPhaseDetail.progressData.subtasks || {}).flatMap((t: any) => (typeof t === 'object' && t.photos) ? t.photos : []).map((photo: any, idx: number) => (
                                            <div key={`sub-${idx}`} className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative group cursor-pointer" onClick={() => window.open(photo.url, '_blank')}>
                                                <img src={photo.url} className="w-full h-full object-cover" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Maximize2 size={12} className="text-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    if (onNavigateToExecution) {
                                        onNavigateToExecution(selectedPhaseDetail.unitId, selectedPhaseDetail.phase.id);
                                        setSelectedPhaseDetail(null);
                                    }
                                }}
                                className="w-full py-2 bg-blue-600 text-white rounded font-black text-[9px] uppercase tracking-widest shadow-md hover:bg-blue-700 flex items-center justify-center gap-1.5"
                            >
                                Ir para Execução <ArrowUpRight size={14} />
                            </button>
                            <button onClick={() => setSelectedPhaseDetail(null)} className="w-full py-1.5 text-slate-400 font-black text-[8px] uppercase tracking-widest">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};