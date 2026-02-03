
import React, { useState, useEffect } from 'react';
import { WeatherCondition, Task, TaskStatus, Project } from '../types';
import { Camera, CloudRain, Sun, Cloud, Zap, CheckSquare, Square, Save, Plus, X, ChevronDown, RefreshCcw, Loader2 } from 'lucide-react';
import { fetchWeatherForecast } from '../services/weatherService';
import { supabase } from '../services/supabaseClient';

interface DailyReportProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (task: Task) => void;
}

export const DailyReport: React.FC<DailyReportProps> = ({ tasks, projects, onAddTask }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [weather, setWeather] = useState<WeatherCondition>(WeatherCondition.SUNNY);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [workforce, setWorkforce] = useState(25);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [observations, setObservations] = useState("");
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<'full' | 'morning' | 'afternoon'>('full');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    handleRefreshWeather();
    loadExistingRDO();
  }, [selectedProjectId]);

  const loadExistingRDO = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', selectedProjectId)
        .eq('date', today)
        .maybeSingle();
      
      if (data) {
          setWeather(data.weather);
          setWorkforce(data.workforce_count);
          setObservations(data.observations);
      }
  };

  const handleRefreshWeather = async () => {
    setLoadingWeather(true);
    const data = await fetchWeatherForecast();
    if (data) {
        setWeather(data.current.condition);
        setTemperature(data.current.temperature);
    }
    setLoadingWeather(false);
  };

  const handleFinalizeRDO = async () => {
      if (!selectedProjectId) return;
      setSaving(true);
      const today = new Date().toISOString().split('T')[0];
      
      try {
          const { error } = await supabase.from('daily_reports').upsert({
              project_id: selectedProjectId,
              date: today,
              weather: weather,
              workforce_count: workforce,
              observations: observations,
              updated_at: new Date().toISOString()
          }, { onConflict: 'project_id, date' });

          if (error) throw error;
          alert("✅ RDO Finalizado com sucesso! Os dados foram integrados ao relatório mensal.");
      } catch (err: any) {
          alert("Erro ao salvar RDO: " + err.message);
      } finally {
          setSaving(false);
      }
  };

  useEffect(() => {
    if (selectedProjectId) {
        const projectTasks = tasks.filter(t => t.projectId === selectedProjectId);
        setLocalTasks(projectTasks);
    }
  }, [selectedProjectId, tasks]);

  const handleTaskUpdate = (taskId: string, field: 'progress' | 'status', value: any) => {
    setLocalTasks(prev => prev.map(t => {
        if (t.id === taskId) {
            const updates: any = { [field]: value };
            if (field === 'progress') {
                if (value === 100) updates.status = TaskStatus.COMPLETED;
                else if (value === 0) updates.status = TaskStatus.NOT_STARTED;
                else updates.status = TaskStatus.IN_PROGRESS;
            }
            return { ...t, ...updates };
        }
        return t;
    }));
  };

  const handleManualTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedProjectId) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        projectId: selectedProjectId,
        name: newTaskName,
        start: todayStr,
        end: todayStr,
        progress: 0,
        status: TaskStatus.IN_PROGRESS
    };
    onAddTask(newTask);
    setNewTaskName("");
    setIsTaskModalOpen(false);
  };

  if (!selectedProject) return <div className="p-8 text-center text-slate-500">Nenhum projeto selecionado.</div>;

  return (
    <div className="pb-20 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">RDO - Diário de Obra</h2>
            <div className="flex items-center gap-3 mt-2">
                <div className="relative">
                    <select 
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="appearance-none bg-white border border-slate-300 text-slate-800 font-bold py-2 pl-4 pr-10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm hover:bg-slate-50 transition-colors w-full min-w-[250px]"
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                <span className="text-slate-400 text-sm whitespace-nowrap hidden sm:inline">• {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
        </div>
        <div className="flex gap-2 flex-wrap">
             <div className="flex bg-white rounded-lg border border-slate-300 p-1">
                 {['morning', 'afternoon', 'full'].map(p => (
                     <button key={p} onClick={() => setPeriod(p as any)} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${period === p ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                         {p === 'morning' ? 'Manhã' : p === 'afternoon' ? 'Tarde' : 'Integral'}
                     </button>
                 ))}
             </div>
             <button 
                onClick={handleFinalizeRDO}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
             >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Finalizar RDO
             </button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Condições & Recursos</h3>
                <button onClick={handleRefreshWeather} className={`text-slate-400 hover:text-blue-600 transition-colors ${loadingWeather ? 'animate-spin' : ''}`}>
                    <RefreshCcw size={14} />
                </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                        Condição Climática
                        {temperature !== null && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-auto">{temperature}°C</span>}
                    </label>
                    <div className="flex gap-3">
                        {[
                            { val: WeatherCondition.SUNNY, icon: <Sun size={24} />, label: 'Sol' },
                            { val: WeatherCondition.CLOUDY, icon: <Cloud size={24} />, label: 'Nublado' },
                            { val: WeatherCondition.RAINY, icon: <CloudRain size={24} />, label: 'Chuva' },
                            { val: WeatherCondition.STORM, icon: <Zap size={24} />, label: 'Temp.' }
                        ].map((w) => (
                            <button key={w.val} onClick={() => setWeather(w.val)} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${weather === w.val ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 hover:border-slate-300 text-slate-400 hover:bg-slate-50'}`}>
                                {w.icon}
                                <span className="text-xs font-medium mt-1">{w.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                        Efetivo Total (Operários)
                        <span className="float-right font-bold text-blue-600 bg-blue-50 px-2 rounded border border-blue-100">{workforce}</span>
                    </label>
                    <input type="range" min="0" max="100" value={workforce} onChange={(e) => setWorkforce(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    <div className="flex justify-between text-xs text-slate-400 mt-2"><span>0</span><span>50</span><span>100+</span></div>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Auditoria de Atividades</h3>
                     <button onClick={() => setIsTaskModalOpen(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors border border-blue-100"><Plus size={14} /> Adicionar Extra</button>
                 </div>
            </div>
            <div className="divide-y divide-slate-100">
                {localTasks.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm">Nenhuma tarefa cadastrada.</div> : localTasks.map(task => (
                    <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-start gap-4">
                            <button onClick={() => handleTaskUpdate(task.id, 'progress', task.status === TaskStatus.COMPLETED ? 0 : 100)} className={`mt-1 flex-shrink-0 transition-colors ${task.status === TaskStatus.COMPLETED ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}>
                                {task.status === TaskStatus.COMPLETED ? <CheckSquare size={24} /> : <Square size={24} />}
                            </button>
                            <div className="flex-1">
                                <div className="flex justify-between mb-2">
                                    <span className={`font-medium ${task.status === TaskStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.name}</span>
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${task.progress === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{task.progress}%</span>
                                </div>
                                <input type="range" value={task.progress} onChange={(e) => handleTaskUpdate(task.id, 'progress', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Observações do Residente</h3>
            <textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Principais acontecimentos do dia..." className="w-full h-32 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-slate-800" />
        </div>
      </div>

      {isTaskModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Atividade Extra</h3><button onClick={() => setIsTaskModalOpen(false)}><X size={20} /></button></div>
                  <form onSubmit={handleManualTaskSubmit}>
                      <input required type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Descrição da atividade..." className="w-full px-3 py-2 border rounded-lg mb-4 bg-white text-slate-800" />
                      <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Adicionar</button></div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
