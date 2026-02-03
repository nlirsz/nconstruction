
import React, { useState, useEffect, useMemo } from 'react';
import { Project, LogEntry } from '../types';
import { supabase } from '../services/supabaseClient';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, X, User, ImageIcon, ArrowRight, Minus } from 'lucide-react';

interface CalendarViewProps {
  project: Project;
}

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const CalendarView: React.FC<CalendarViewProps> = ({ project }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Image Lightbox State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
        setLoading(true);
        try {
            // New logic: Fetch from project_logs
            const { data: logData, error } = await supabase
                .from('project_logs')
                .select('*')
                .eq('project_id', project.id)
                .gte('date', new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString()) // Fetch 3 months window for efficiency
                .lte('date', new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString())
                .order('date', { ascending: false });

            if (logData) {
                setLogs(logData);
            } else {
                // Fallback legacy
                const { data: existingData } = await supabase
                    .from('project_matrices')
                    .select('matrix_data')
                    .eq('project_id', project.id)
                    .single();
                if (existingData?.matrix_data?.logs) {
                    setLogs(existingData.matrix_data.logs);
                }
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchLogs();
  }, [project.id, currentDate.getMonth()]); // Refresh when changing months to lazy load if needed

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      
      const days = [];
      // Empty slots for previous month
      for (let i = 0; i < firstDay; i++) {
          days.push(null);
      }
      // Actual days
      for (let i = 1; i <= daysInMonth; i++) {
          days.push(new Date(year, month, i));
      }
      return days;
  }, [currentDate]);

  const logsByDate = useMemo(() => {
      const map: Record<string, LogEntry[]> = {};
      logs.forEach(log => {
          const dateKey = new Date(log.date).toLocaleDateString('en-CA'); // YYYY-MM-DD
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(log);
      });
      return map;
  }, [logs]);

  const moveMonth = (direction: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + direction);
      setCurrentDate(newDate);
      setSelectedDate(null);
  };

  if (loading) {
      return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-8rem)]">
        
        {/* Calendar Grid Container */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <CalendarIcon size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 hidden sm:block">Histórico</h2>
                </div>
                
                <div className="flex items-center gap-1 bg-slate-50 rounded-xl border border-slate-100 p-1">
                    <button onClick={() => moveMonth(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-slate-800 transition-all"><ChevronLeft size={18} /></button>
                    <span className="w-32 text-center font-bold text-slate-700 text-sm capitalize select-none">{MONTH_NAMES[currentDate.getMonth()]} <span className="text-slate-400 font-medium">{currentDate.getFullYear()}</span></span>
                    <button onClick={() => moveMonth(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-slate-800 transition-all"><ChevronRight size={18} /></button>
                </div>
            </div>
            
            {/* Week Days */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 shrink-0">
                {WEEK_DAYS.map(day => (
                    <div key={day} className="py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">{day}</div>
                ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-50 gap-px border-b border-slate-100 overflow-hidden">
                {calendarDays.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} className="bg-white min-h-[60px] lg:min-h-0"></div>;
                    
                    const dateKey = date.toLocaleDateString('en-CA');
                    const dayLogs = logsByDate[dateKey] || [];
                    const isToday = new Date().toLocaleDateString('en-CA') === dateKey;
                    const isSelected = selectedDate?.toLocaleDateString('en-CA') === dateKey;
                    const hasLogs = dayLogs.length > 0;
                    
                    return (
                        <button 
                            key={dateKey} 
                            onClick={() => setSelectedDate(date)}
                            className={`
                                bg-white p-1 relative group transition-all flex flex-col items-center justify-start pt-2 gap-1 min-h-[60px] lg:min-h-0
                                ${isSelected ? 'bg-blue-50/50 z-10' : 'hover:bg-slate-50'}
                                focus:outline-none
                            `}
                        >
                            <span className={`
                                text-xs md:text-sm font-bold w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-all
                                ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : isSelected ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}
                            `}>
                                {date.getDate()}
                            </span>
                            
                            {/* Mobile Dot Indicator (Simplified) */}
                            {hasLogs && (
                                <div className="flex gap-0.5 mt-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${dayLogs.some(l => l.category === 'unit') ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                    {dayLogs.length > 1 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
                                </div>
                            )}
                            
                            {/* Desktop Chips (Detailed) */}
                            {hasLogs && (
                                <div className="hidden lg:flex flex-col gap-1 w-full px-1 mt-1">
                                    {dayLogs.slice(0, 2).map((log, idx) => (
                                        <div key={idx} className="text-[9px] bg-slate-50 text-slate-600 rounded px-1.5 py-0.5 truncate border border-slate-100 flex items-center gap-1 w-full text-left">
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.category === 'unit' ? 'bg-blue-400' : log.category === 'macro' ? 'bg-purple-400' : 'bg-slate-400'}`}></div>
                                            <span className="truncate">{log.title}</span>
                                        </div>
                                    ))}
                                    {dayLogs.length > 2 && (
                                        <div className="text-[9px] text-slate-400 px-1 font-bold">+ {dayLogs.length - 2}</div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Detail Bottom Sheet / Sidebar */}
        {/* Overlay for Mobile */}
        {selectedDate && (
            <div 
                className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setSelectedDate(null)}
            />
        )}
        
        <div 
            className={`
                bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:shadow-sm border border-slate-200 flex flex-col transition-transform duration-300 ease-out
                lg:w-96 lg:static lg:rounded-2xl lg:h-auto lg:translate-y-0
                fixed bottom-0 left-0 right-0 z-50 rounded-t-[32px] max-h-[85vh] h-[60vh] lg:max-h-none
                ${selectedDate ? 'translate-y-0' : 'translate-y-full lg:translate-y-0 lg:opacity-100 opacity-0 pointer-events-none lg:pointer-events-auto'}
            `}
        >
                {/* Mobile Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 lg:hidden" onClick={() => setSelectedDate(null)}>
                    <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
                </div>

                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Atividades do Dia</h3>
                        {selectedDate ? (
                            <p className="text-xs text-slate-500 capitalize">
                                {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        ) : (
                            <p className="text-xs text-slate-400">Selecione uma data</p>
                        )}
                    </div>
                    {selectedDate && (
                        <button onClick={() => setSelectedDate(null)} className="lg:hidden text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full">
                            <X size={20}/>
                        </button>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 lg:max-h-[calc(100vh-12rem)] custom-scrollbar bg-slate-50/50">
                    {selectedDate ? (
                        <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                        {logsByDate[selectedDate.toLocaleDateString('en-CA')]?.length > 0 ? (
                            logsByDate[selectedDate.toLocaleDateString('en-CA')]
                                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((log) => (
                                <div key={log.id} className="relative pl-4 border-l-2 border-blue-200 hover:border-blue-400 transition-colors group bg-white p-3 rounded-r-xl shadow-sm">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                                                {log.user_avatar ? (
                                                    <img src={log.user_avatar} alt="User" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={12} className="text-slate-400" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700">{log.user_name || 'Usuário'}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{new Date(log.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${log.category === 'unit' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                            {log.category === 'unit' ? 'Unidade' : 'Geral'}
                                        </span>
                                    </div>

                                    <div className="">
                                        <h4 className="text-sm font-bold text-slate-800 leading-tight mb-1">{log.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed mb-2">{log.details}</p>
                                        
                                        {log.previous_value !== undefined && log.new_value !== undefined && (
                                            <div className="flex items-center gap-2 text-xs mb-2 font-bold bg-slate-50 w-max px-2 py-1 rounded border border-slate-100">
                                                <span className="text-slate-400">{log.previous_value}%</span>
                                                <ArrowRight size={12} className="text-slate-300" />
                                                <span className={`
                                                    ${log.new_value === 100 ? 'text-green-600' : log.new_value > log.previous_value ? 'text-blue-600' : 'text-slate-600'}
                                                `}>{log.new_value}%</span>
                                            </div>
                                        )}

                                        {log.observation && (
                                            <div className="text-xs text-slate-600 italic bg-amber-50 p-2.5 rounded-lg border border-amber-100 mb-2 flex gap-2">
                                                <div className="w-0.5 bg-amber-300 rounded-full shrink-0"></div>
                                                "{log.observation}"
                                            </div>
                                        )}

                                        {log.image_url && (
                                            <div onClick={() => setPreviewImage(log.image_url || null)} className="relative h-32 w-full rounded-lg overflow-hidden cursor-pointer group/img mt-2 border border-slate-200 shadow-sm">
                                                <img src={log.image_url} alt="Evidencia" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                                    <div className="bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-bold opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-2 backdrop-blur-md">
                                                        <ImageIcon size={14} />
                                                        Ver Foto
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                    <CalendarIcon size={24} className="opacity-30" />
                                </div>
                                <p className="text-sm font-medium">Nenhuma atividade.</p>
                            </div>
                        )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center min-h-[200px]">
                            <CalendarIcon size={48} className="opacity-10 mb-4" />
                            <p className="text-sm font-medium text-slate-600">Selecione um dia no calendário</p>
                            <p className="text-xs mt-1 opacity-60">Toque para ver o histórico detalhado.</p>
                        </div>
                    )}
                </div>
        </div>

        {/* Image Lightbox */}
        {previewImage && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                <img src={previewImage} alt="Full size" className="max-w-full max-h-full rounded-lg shadow-2xl animate-in zoom-in duration-200" />
                <button className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 p-2 rounded-full backdrop-blur-md">
                    <X size={24} />
                </button>
            </div>
        )}
    </div>
  );
};
