import React, { useState, useMemo, useEffect } from 'react';
import { Project, LogEntry, UserProfile, PhaseConfig, UnitVerification, VerificationStatus, PhotoCategory, Task, TaskStatus, ProjectPhoto } from '../types';
import { supabase, uploadImage } from '../services/supabaseClient';
import { 
    Check, ChevronDown, ChevronRight, Box, Zap, Layers, PaintBucket, Sparkles, 
    GripHorizontal, Plus, Camera, Loader2, Save, 
    Trash2, ListChecks, Building2, MapPin, ShieldAlert, Droplets, LayoutGrid,
    CheckCircle2, X, AlertTriangle, History, ImageIcon, ScanSearch, FileSpreadsheet,
    RefreshCcw, LayersIcon, ListTodo, Info, Tag, ArrowRight, Edit2, Link, GalleryHorizontal, Calendar, ArrowUpRight
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
  const [selectedUnit, setSelectedUnit] = useState<{fIdx: number, uIdx: number} | null>(null);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

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
        if (assembledData.length > 0) setExpandedFloors([assembledData[0].floor]);
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

  const getFloorLabel = (floor: number) => {
    if (project.structure?.levels) { const level = project.structure.levels.find(l => l.order === floor); if (level) return level.label; }
    return `${floor}º Pav.`;
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-4 animate-in fade-in duration-500 pb-10">
      <div className="w-full lg:w-72 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-[10px] uppercase tracking-widest"><Building2 size={14} className="text-blue-600"/> Inventário</h3>
              <button onClick={loadData} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-blue-600 transition-all"><RefreshCcw size={14}/></button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-none custom-scrollbar">
              {[...data].reverse().map((floor, rIdx) => {
                  const originalIdx = data.length - 1 - rIdx;
                  return (
                  <div key={floor.floor} className="border-b border-slate-50 last:border-0">
                      <button onClick={() => setExpandedFloors(prev => prev.includes(floor.floor) ? prev.filter(f => f !== floor.floor) : [...prev, floor.floor])} className={`w-full flex items-center justify-between px-3 py-2.5 text-[9px] font-black transition-all ${expandedFloors.includes(floor.floor) ? 'text-blue-600 bg-blue-50/20' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                            {expandedFloors.includes(floor.floor) ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                            {getFloorLabel(floor.floor)}
                          </span>
                          <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 font-bold">{floor.units.length}</span>
                      </button>
                      {expandedFloors.includes(floor.floor) && (
                          <div className="bg-slate-50/30 p-1.5 grid grid-cols-2 lg:grid-cols-1 gap-1">
                              {floor.units.map((unit: any, uIdx: number) => (
                                  <button key={unit.id} onClick={() => { setSelectedUnit({fIdx: originalIdx, uIdx}); setActivePhaseId(null); }} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedUnit?.fIdx === originalIdx && selectedUnit?.uIdx === uIdx ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-100 hover:border-blue-300'}`}>
                                      <span className="truncate">{unit.name}</span>
                                      {selectedUnit?.fIdx === originalIdx && selectedUnit?.uIdx === uIdx && <CheckCircle2 size={10} />}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              )})}
          </div>
      </div>

      <div className="flex-1">
          {!selectedUnit ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <LayoutGrid size={32} className="opacity-10"/>
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
                          <button onClick={() => setSelectedUnit(null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><X size={18}/></button>
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
              <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-500">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                      <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl text-white ${getPhaseColor(projectPhases.find(p => p.id === activePhaseId)?.color || 'slate')} shadow-lg`}>{getPhaseIcon(projectPhases.find(p => p.id === activePhaseId)?.icon || 'Box', 16)}</div>
                          <div>
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm leading-none">{projectPhases.find(p => p.id === activePhaseId)?.label}</h3>
                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">{data[selectedUnit.fIdx].units[selectedUnit.uIdx].name}</p>
                          </div>
                      </div>
                      <button onClick={() => setActivePhaseId(null)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white custom-scrollbar">
                      <div className="space-y-3">
                          <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><ListChecks size={14} className="text-blue-600"/> Itens Técnicos</h4>
                          <div className="space-y-2">
                              {(projectPhases.find(p => p.id === activePhaseId)?.subtasks || []).map((name) => {
                                      const unitSubtasks = data[selectedUnit.fIdx].units[selectedUnit.uIdx].phases[activePhaseId!]?.subtasks || {};
                                      const taskData = unitSubtasks[name];
                                      const progress = typeof taskData === 'object' ? taskData.progress : taskData || 0;

                                      return (
                                          <div key={name} className="bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all flex flex-col gap-3">
                                              <div className="flex justify-between items-start">
                                                  <span className="text-[10px] font-bold text-slate-800 uppercase leading-tight w-3/4">{name}</span>
                                                  <span className={`text-xs font-black ${progress === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{progress}%</span>
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
    </div>
  );
};