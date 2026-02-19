import React, { useEffect, useState } from 'react';
import { Project, ProjectPhoto } from '../types';
import { generateMonthlyInsight, MonthlyInsight } from '../services/smartReportService';
import { Sun, CloudRain, Users, CheckCircle, Calendar, ArrowRight, Loader2, Image as ImageIcon, Zap } from 'lucide-react';

interface InsightSummaryProps {
    project: Project;
    onViewDetails?: () => void;
}

export const InsightSummary: React.FC<InsightSummaryProps> = ({ project, onViewDetails }) => {
    const [insight, setInsight] = useState<MonthlyInsight | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const today = new Date();
            // Sempre carrega o mês atual ou anterior se for dia 1-5
            const targetMonth = today.getDate() < 5 ? (today.getMonth() === 0 ? 11 : today.getMonth() - 1) : today.getMonth();
            const targetYear = today.getDate() < 5 && today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

            try {
                const data = await generateMonthlyInsight(project, targetMonth, targetYear);
                setInsight(data);
            } catch (error) {
                console.error("Erro ao gerar insight:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [project.id]);

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex items-center justify-center min-h-[300px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-blue-600 animate-spin" />
                    <p className="text-sm font-medium text-slate-500">Gerando relatório inteligente...</p>
                </div>
            </div>
        );
    }

    if (!insight) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header & Progress */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                                Relatório Mensal
                            </span>
                            <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">
                                {insight.period}
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black leading-tight mb-2">
                            Resumo de <span className="text-blue-400">Atividades</span>
                        </h2>
                        <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                            Confira os principais avanços, condições climáticas e registros fotográficos do período.
                        </p>
                    </div>

                    <div className="flex items-center gap-6 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Evolução Geral</p>
                            <div className="flex items-end gap-1">
                                <span className="text-3xl font-black text-white">{project.progress}%</span>
                                <span className="text-xs font-bold text-emerald-400 mb-1.5 flex items-center">
                                    <Zap size={10} className="mr-0.5" /> +{insight.progress.delta}%
                                </span>
                            </div>
                        </div>
                        <div className="text-right pl-6 border-l border-white/10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</p>
                            <div className="flex items-center gap-1.5 justify-end">
                                <div className={`w-2 h-2 rounded-full ${project.status === 'green' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                                <span className="text-sm font-bold text-white uppercase tracking-tight">
                                    {project.status === 'green' ? 'No Prazo' : 'Atenção'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Clima & Produtividade */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Sun size={18} />
                        </div>
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Clima & Obra</h3>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <p className="text-2xl font-black text-slate-800">{insight.productivity.workDays}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Dias Trabalhados</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-slate-400">{insight.productivity.rainyDays}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-end gap-1">
                                <CloudRain size={10} /> Dias Chuva
                            </p>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 h-full" style={{ width: `${(insight.productivity.workDays / 30) * 100}%` }} />
                        <div className="bg-slate-300 h-full" style={{ width: `${(insight.productivity.rainyDays / 30) * 100}%` }} />
                    </div>
                </div>

                {/* Efetivo Médio */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Users size={18} />
                        </div>
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Efetivo Médio</h3>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-black text-slate-800">{insight.productivity.avgWorkforce}</span>
                        <span className="text-xs font-bold text-slate-400 mb-1.5">Colaboradores / dia</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                        Média diária de profissionais atuando no canteiro durante este mês.
                    </p>
                </div>

                {/* Marcos */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <CheckCircle size={18} />
                        </div>
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Entregas do Mês</h3>
                    </div>
                    {insight.milestones.completed.length > 0 ? (
                        <ul className="space-y-2">
                            {insight.milestones.completed.slice(0, 3).map((m, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    {m}
                                </li>
                            ))}
                            {insight.milestones.completed.length > 3 && (
                                <li className="text-[10px] font-bold text-slate-400 pl-3.5">+ {insight.milestones.completed.length - 3} outros itens</li>
                            )}
                        </ul>
                    ) : (
                        <div className="text-center py-2">
                            <p className="text-xs text-slate-400 font-medium">Nenhum marco principal concluído ainda.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Smart Gallery */}
            {insight.highlights.photos.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ImageIcon size={16} className="text-slate-400" />
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Destaques da Galeria</h3>
                        </div>
                        {onViewDetails && (
                            <button
                                onClick={onViewDetails}
                                className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:gap-2 transition-all"
                            >
                                Ver Galeria <ArrowRight size={12} />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {insight.highlights.photos.map((photo) => (
                            <div
                                key={photo.id}
                                className="aspect-square rounded-lg overflow-hidden relative group cursor-pointer border border-slate-100 bg-slate-50"
                            >
                                <img
                                    src={photo.url}
                                    alt={photo.description}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <p className="text-[9px] font-bold text-white line-clamp-1">{photo.location_label || 'Geral'}</p>
                                    <p className="text-[8px] text-white/70">{new Date(photo.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Featured Notes */}
            {insight.highlights.notes.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Calendar size={14} /> Notas do Diário
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                        {insight.highlights.notes.map((note, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100 text-xs text-slate-600 line-clamp-2 md:line-clamp-3 leading-relaxed italic">
                                "{note}"
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
