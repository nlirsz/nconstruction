
import React, { useState, useEffect, useMemo } from 'react';
import { Project, LogEntry, UserProfile, Organization, WeatherCondition } from '../types';
import { supabase } from '../services/supabaseClient';
import { 
    FileText, Calendar, Copy, Loader2, 
    TrendingUp, ImageIcon, ClipboardList, User, Building2, MapPin, 
    Users, Sun, CloudRain, AlertCircle, Clock
} from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

interface ReportsTabProps {
  project: Project;
  userProfile?: UserProfile | null;
  organization?: Organization | null;
}

const PHASES = [
  { id: 'structure', label: 'Estrutura' },
  { id: 'masonry', label: 'Alvenaria' },
  { id: 'waterproofing', label: 'Impermeabilização' },
  { id: 'hydraulic', label: 'Inst. Hidráulicas' },
  { id: 'electrical', label: 'Inst. Elétricas' },
  { id: 'plaster', label: 'Reboco/Gesso' },
  { id: 'flooring', label: 'Contrapiso' },
  { id: 'coating', label: 'Revestimentos' },
  { id: 'painting', label: 'Pintura' },
  { id: 'finishing', label: 'Acabamentos' },
];

export const ReportsTab: React.FC<ReportsTabProps> = ({ project, userProfile, organization }) => {
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dailyReports, setDailyReports] = useState<any[]>([]);
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [project.id, selectedMonth, selectedYear]);

  const fetchData = async () => {
      setLoading(true);
      const { data: matrix } = await supabase.from('project_matrices').select('*').eq('project_id', project.id).maybeSingle();
      
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      
      const { data: rdos } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', project.id)
        .gte('date', start)
        .lte('date', end);

      if (matrix) {
          setLogs(matrix.matrix_data?.logs || []);
          setMatrixData(matrix.matrix_data?.floors || []);
      }
      if (rdos) setDailyReports(rdos);
      
      setLoading(false);
  };

  const isBusinessDay = (date: Date) => {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0 = Domingo, 6 = Sábado
  };

  const weatherStats = useMemo(() => {
      if (dailyReports.length === 0) return { avgWorkforce: 0, rainyBusinessDays: [], totalBusinessDaysReported: 0 };
      
      const totalWorkforce = dailyReports.reduce((acc, curr) => acc + (curr.workforce_count || 0), 0);
      
      const rainyReports = dailyReports.filter(r => {
          const date = new Date(r.date + 'T12:00:00'); // Compensate timezone
          const isRainy = r.weather === WeatherCondition.RAINY || r.weather === WeatherCondition.STORM;
          return isRainy && isBusinessDay(date);
      });

      const businessDaysReported = dailyReports.filter(r => isBusinessDay(new Date(r.date + 'T12:00:00'))).length;

      return {
          avgWorkforce: Math.round(totalWorkforce / dailyReports.length),
          rainyBusinessDays: rainyReports.map(r => new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')),
          totalBusinessDaysReported: businessDaysReported
      };
  }, [dailyReports]);

  const monthLogs = useMemo(() => {
      return logs.filter(log => {
          const d = new Date(log.date);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [logs, selectedMonth, selectedYear]);

  const currentStats = useMemo(() => {
    const stats: Record<string, number> = {};
    PHASES.forEach(p => {
        let total = 0, count = 0;
        matrixData.forEach(floor => {
            floor.units.forEach((unit: any) => {
                total += unit.phases?.[p.id]?.percentage || 0;
                count++;
            });
        });
        stats[p.id] = count > 0 ? Math.round(total / count) : 0;
    });
    return stats;
  }, [matrixData]);

  const startOfMonthStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const startDate = new Date(selectedYear, selectedMonth, 1).getTime();
    PHASES.forEach(p => {
        let phaseTotal = 0;
        let unitsFound = 0;
        matrixData.forEach(floor => {
            floor.units.forEach((unit: any) => {
                const unitLogsBeforeMonth = logs.filter(l => 
                    l.category === 'unit' && l.title.includes(unit.name) && l.title.includes(p.label) &&
                    new Date(l.date).getTime() < startDate
                ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const startValue = unitLogsBeforeMonth.length > 0 ? (unitLogsBeforeMonth[0].new_value || 0) : 0;
                phaseTotal += startValue;
                unitsFound++;
            });
        });
        stats[p.id] = unitsFound > 0 ? Math.round(phaseTotal / unitsFound) : 0;
    });
    return stats;
  }, [matrixData, logs, selectedMonth, selectedYear]);

  const handleCopyToClipboard = async () => {
    setCopying(true);
    const reportHtml = document.getElementById('report-content')?.innerHTML || '';
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const data = [new ClipboardItem({ 'text/html': blob })];
    try {
        await navigator.clipboard.write(data);
        alert("✅ Relatório formatado copiado! Cole no Google Docs.");
    } catch (err) { alert("Erro ao copiar."); }
    finally { setCopying(false); }
  };

  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(selectedYear, selectedMonth));
  const orgLogo = organization?.logo_url || APP_LOGO_URL;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">Relatórios de Progresso</h2>
            <p className="text-xs md:text-sm text-slate-500">Compilado inteligente de Diários (RDO) e Matriz Física.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-xl flex-1 md:flex-none">
                <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent text-[10px] md:text-xs font-bold px-2 md:px-3 py-2 outline-none w-full text-slate-700">
                    {Array.from({length: 12}).map((_, i) => (<option key={i} value={i} className="text-slate-800">{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(0, i))}</option>))}
                </select>
                <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-transparent text-[10px] md:text-xs font-bold px-2 md:px-3 py-2 outline-none text-slate-700">
                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y} className="text-slate-800">{y}</option>)}
                </select>
            </div>
            <button onClick={handleCopyToClipboard} disabled={copying} className="bg-blue-600 text-white px-4 md:px-5 py-2.5 rounded-xl font-bold text-[10px] md:text-sm shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-all whitespace-nowrap">
                {copying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} 
                <span className="hidden md:inline">Copiar para Google Docs</span>
                <span className="md:hidden">Copiar</span>
            </button>
        </div>
      </header>

      <div className="bg-slate-200 p-2 md:p-10 rounded-3xl overflow-hidden">
          <div id="report-content" className="bg-white shadow-2xl mx-auto max-w-[800px] min-h-[800px] md:min-h-[1000px] p-[1.5cm] md:p-[2cm] text-slate-800" style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.5', color: '#1e293b' }}>
              
              {/* Header */}
              <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1e293b' }}>
                  <div style={{ flex: 1 }}>
                      <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: '0', color: '#1e293b' }}>Relatório Mensal Consolidador</h1>
                      <p style={{ fontSize: '10pt', color: '#64748b', margin: '5px 0 0 0' }}>Diário de Obra + Avanço Físico • <span style={{ fontWeight: 'bold', textTransform: 'capitalize', color: '#1e293b' }}>{monthName} de {selectedYear}</span></p>
                  </div>
                  <div style={{ width: '80px', height: '80px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '5px' }}>
                      <img src={orgLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" />
                  </div>
              </div>

              {/* Info Projeto */}
              <div style={{ marginBottom: '30px', background: '#f8fafc', padding: '15px', borderRadius: '10px', color: '#1e293b' }}>
                  <h2 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px', color: '#1e293b' }}>1. Identificação</h2>
                  <table style={{ width: '100%', fontSize: '9pt', color: '#334155' }}>
                      <tbody>
                          <tr><td style={{ fontWeight: 'bold', width: '30%', color: '#334155' }}>Obra:</td><td style={{ color: '#1e293b' }}>{project.name}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#334155' }}>Engenheiro:</td><td style={{ color: '#1e293b' }}>{userProfile?.full_name || project.residentEngineer}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#334155' }}>Progresso Acumulado:</td><td style={{ color: '#1e293b' }}>{project.progress}%</td></tr>
                      </tbody>
                  </table>
              </div>

              {/* Estatísticas do Mês (DADOS DO RDO) */}
              <div style={{ marginBottom: '40px', color: '#1e293b' }}>
                  <h2 style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>2. Resumo de Recursos e Clima (RDO)</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                      <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ fontSize: '7pt', color: '#64748b', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Efetivo Médio</p>
                          <p style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0', color: '#1e293b' }}>{weatherStats.avgWorkforce} <span style={{ fontSize: '8pt' }}>op</span></p>
                      </div>
                      <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffedd5' }}>
                          <p style={{ fontSize: '7pt', color: '#c2410c', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Dias Úteis</p>
                          <p style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0', color: '#9a3412' }}>{weatherStats.totalBusinessDaysReported}</p>
                      </div>
                      <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #fee2e2' }}>
                          <p style={{ fontSize: '7pt', color: '#dc2626', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Chuvas</p>
                          <p style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0', color: '#991b1b' }}>{weatherStats.rainyBusinessDays.length}</p>
                      </div>
                  </div>

                  {/* Detalhamento de Intempéries */}
                  {weatherStats.rainyBusinessDays.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '9pt', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Datas com incidência de chuva (Dias Úteis):</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {weatherStats.rainyBusinessDays.map(date => (
                                <span key={date} style={{ fontSize: '8pt', background: '#fff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', color: '#64748b' }}>
                                    {date}
                                </span>
                            ))}
                        </div>
                    </div>
                  )}
                  <p style={{ fontSize: '8pt', color: '#94a3b8', fontStyle: 'italic', marginTop: '10px' }}>*Considera apenas feriados e finais de semana para exclusão de dias produtivos.</p>
              </div>

              {/* Quadro de Avanço */}
              <div style={{ marginBottom: '40px', color: '#1e293b' }}>
                  <h2 style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>3. Evolução Física das Etapas</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', border: '1px solid #e2e8f0', color: '#334155' }}>
                      <thead>
                          <tr style={{ background: '#1e293b', color: 'white' }}>
                              <th style={{ padding: '8px', textAlign: 'left' }}>Etapa</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Geral (%)</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>No Mês (%)</th>
                          </tr>
                      </thead>
                      <tbody>
                          {PHASES.map(p => {
                              const current = currentStats[p.id] || 0;
                              const gain = Math.max(0, current - (startOfMonthStats[p.id] || 0));
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{p.label}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{current}%</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{gain > 0 ? `+${gain}%` : '0%'}</td>
                                </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>

              {/* Registro Fotográfico */}
              <div style={{ marginBottom: '40px', color: '#1e293b' }}>
                  <h2 style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>4. Registro Fotográfico</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      {monthLogs.filter(l => l.image_url).slice(0, 8).map((log, i) => (
                          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', pageBreakInside: 'avoid' }}>
                              <img src={log.image_url} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }} alt="Foto" />
                              <p style={{ fontSize: '7pt', fontWeight: 'bold', margin: '4px 0 0 0', color: '#1e293b' }}>{log.title}</p>
                              <p style={{ fontSize: '6pt', color: '#64748b' }}>{new Date(log.date).toLocaleDateString('pt-BR')}</p>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Linha do Tempo Técnica */}
              <div style={{ marginBottom: '40px', color: '#1e293b' }}>
                  <h2 style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>5. Linha do Tempo de Ocorrências</h2>
                  <div style={{ borderLeft: '2px solid #3b82f6', paddingLeft: '15px' }}>
                      {dailyReports.filter(r => r.observations).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((r, i) => (
                          <div key={i} style={{ marginBottom: '10px' }}>
                              <p style={{ fontSize: '8pt', fontWeight: 'bold', margin: '0', color: '#334155' }}>Dia {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}:</p>
                              <p style={{ fontSize: '8pt', margin: '2px 0 0 0', color: '#475569' }}>{r.observations}</p>
                          </div>
                      ))}
                  </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center', fontSize: '7pt', color: '#94a3b8' }}>
                  Relatório gerado em {new Date().toLocaleDateString('pt-BR')} via Sistema SIGO
              </div>
          </div>
      </div>
    </div>
  );
};
