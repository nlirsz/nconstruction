
import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectDocument, DocumentCategory, UserProfile } from '../types';
import { supabase, uploadFile } from '../services/supabaseClient';
import {
    FolderOpen, Upload, Download, Trash2, FileText, Filter, Plus, X, Loader2,
    MapPin, Grid, Layers, Zap, Droplets, PaintBucket, CheckSquare, Square,
    ChevronDown, ChevronUp, Check, ListChecks, Eye, Layout,
    CheckCircle2, Edit2, Search, Building2
} from 'lucide-react';

interface DocumentsTabProps {
    project: Project;
    currentUser: any;
    userProfile?: UserProfile | null;
}

const CATEGORIES: { id: DocumentCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'structural', label: 'Estrutural', icon: <Grid size={16} />, color: 'bg-stone-100 text-stone-700' },
    { id: 'architectural', label: 'Arquitetura', icon: <Layers size={16} />, color: 'bg-blue-100 text-blue-700' },
    { id: 'electrical', label: 'Elétrico', icon: <Zap size={16} />, color: 'bg-yellow-100 text-yellow-700' },
    { id: 'hydraulic', label: 'Hidráulico', icon: <Droplets size={16} />, color: 'bg-cyan-100 text-cyan-700' },
    { id: 'finishing', label: 'Acabamentos', icon: <PaintBucket size={16} />, color: 'bg-purple-100 text-purple-700' },
    { id: 'others', label: 'Outros', icon: <FolderOpen size={16} />, color: 'bg-slate-100 text-slate-700' },
];

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ project, currentUser }) => {
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);

    // Form States
    const [newDocTitle, setNewDocTitle] = useState('');
    const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('architectural');
    const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
    const [contextSearch, setContextSearch] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, [project.id]);

    const structureTree = useMemo(() => {
        const generalSet = new Set(['Geral', 'Áreas Externas', 'Garagem', 'Lazer / Térreo', 'Cobertura']);
        const floors: { label: string, units: string[] }[] = [];

        if (project.structure?.levels && project.structure.levels.length > 0) {
            project.structure.levels.forEach(level => {
                // Separação estrita: Apenas 'apartments' vira nível com unidades
                if (level.type === 'apartments') {
                    floors.push({
                        label: level.label,
                        units: level.units.map(u => u.name)
                    });
                } else {
                    // Outros tipos vão para o filtro de áreas gerais
                    generalSet.add(level.label);
                }
            });
        } else {
            const floorCount = project.structure?.floors || 10;
            const unitsPerFloor = project.structure?.unitsPerFloor || 4;
            for (let f = 1; f <= floorCount; f++) {
                const units = [];
                for (let u = 1; u <= unitsPerFloor; u++) { units.push(`Apto ${f * 100 + u}`); }
                floors.push({ label: `Pavimento ${f}`, units });
            }
        }
        return { general: Array.from(generalSet), floors };
    }, [project.structure]);

    const fetchDocuments = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('project_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
        if (data && !error) setDocuments(data);
        setLoading(false);
    };

    const handleOpenModal = (doc?: ProjectDocument) => {
        if (doc) {
            setEditingDoc(doc);
            setNewDocTitle(doc.title);
            setNewDocCategory(doc.category);
            setSelectedContexts([doc.context && doc.context !== '' ? doc.context : 'Geral']);
            setSelectedFile(null);
        } else {
            setEditingDoc(null);
            setNewDocTitle('');
            setNewDocCategory('architectural');
            setSelectedContexts([]);
            setSelectedFile(null);
        }
        setIsModalOpen(true);
    };

    const toggleContext = (ctx: string) => {
        setSelectedContexts(prev => {
            if (prev.includes(ctx)) {
                return prev.filter(c => c !== ctx);
            }
            if (editingDoc) return [ctx];
            const list = prev.filter(c => c !== 'Geral');
            return [...list, ctx];
        });
    };

    const toggleFloorGroup = (floorLabel: string, units: string[]) => {
        if (editingDoc) {
            setSelectedContexts([floorLabel]);
            return;
        }
        const allSelected = units.every(u => selectedContexts.includes(u)) && selectedContexts.includes(floorLabel);
        if (allSelected) {
            setSelectedContexts(prev => prev.filter(c => c !== floorLabel && !units.includes(c)));
        } else {
            const list = selectedContexts.filter(c => c !== 'Geral');
            setSelectedContexts([...new Set([...list, floorLabel, ...units])]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDocTitle || selectedContexts.length === 0) return;

        setUploadLoading(true);
        try {
            let fileUrl = editingDoc?.file_url || '';
            let fileType = editingDoc?.file_type || '';

            if (selectedFile) {
                const uploadedUrl = await uploadFile(selectedFile, `documents/${project.id}`);
                if (uploadedUrl) {
                    fileUrl = uploadedUrl;
                    fileType = selectedFile.name.split('.').pop()?.toLowerCase() || 'unknown';
                }
            }

            if (editingDoc) {
                const primaryContext = selectedContexts[0];

                const { error } = await supabase.from('project_documents').update({
                    title: newDocTitle,
                    category: newDocCategory,
                    context: primaryContext,
                    file_url: fileUrl,
                    file_type: fileType
                }).eq('id', editingDoc.id);

                if (error) throw error;
            } else {
                if (!fileUrl) throw new Error("Arquivo é obrigatório.");
                const inserts = selectedContexts.map(ctx => ({
                    project_id: project.id,
                    title: newDocTitle,
                    category: newDocCategory,
                    context: ctx,
                    file_url: fileUrl,
                    file_type: fileType,
                    created_by: currentUser.email
                }));
                const { error } = await supabase.from('project_documents').insert(inserts);
                if (error) throw error;
            }
            fetchDocuments();
            setIsModalOpen(false);
        } catch (err: any) {
            console.error("Erro ao salvar:", err);
            alert("Erro ao salvar: " + (err.message || "Verifique a conexão"));
        } finally {
            setUploadLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir este arquivo?")) return;
        const { error } = await supabase.from('project_documents').delete().eq('id', id);
        if (!error) fetchDocuments();
    };

    const filteredDocs = activeCategory === 'all' ? documents : documents.filter(d => d.category === activeCategory);

    return (
        <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 px-1">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2"><FolderOpen className="text-blue-600" size={22} /> Documentação</h2>
                    <p className="text-[10px] md:text-sm text-slate-500 mt-1 uppercase tracking-widest font-bold">Biblioteca Técnica Centralizada</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"><Plus size={16} /> Novo Arquivo</button>
            </div>

            <div className="flex gap-2 mb-6 md:mb-8 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveCategory('all')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-bold border transition-all whitespace-nowrap ${activeCategory === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>TODOS</button>
                {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${activeCategory === cat.id ? 'bg-white border-blue-50 text-blue-600 shadow-md ring-2 ring-blue-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{cat.icon}{cat.label}</button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <FileText className="mx-auto text-slate-200 mb-4" size={48} />
                    <h3 className="text-sm md:text-lg font-bold text-slate-400 uppercase tracking-widest">Nenhum arquivo encontrado</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {filteredDocs.map(doc => {
                        const type = doc.file_type?.toLowerCase() || 'unknown';
                        const isPDF = type === 'pdf';
                        const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(type);
                        return (
                            <div key={doc.id} className="bg-white rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-5 shadow-sm hover:shadow-xl transition-all group flex flex-col relative overflow-hidden">
                                <div className="flex justify-between items-start mb-3 md:mb-4">
                                    <div className={`p-2 md:p-2.5 rounded-lg md:rounded-xl ${CATEGORIES.find(c => c.id === doc.category)?.color || 'bg-slate-100'}`}>
                                        {CATEGORIES.find(c => c.id === doc.category)?.icon || <FileText size={18} />}
                                    </div>
                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(doc)} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <h4 className="font-bold text-slate-900 text-xs md:text-sm mb-1.5 truncate" title={doc.title}>{doc.title}</h4>
                                <div className="flex items-center gap-1.5 md:gap-2 mb-4 md:mb-6">
                                    <span className="text-[9px] md:text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[100px]">{doc.context || 'Geral'}</span>
                                    <span className="text-[9px] md:text-[10px] font-black uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{type}</span>
                                </div>
                                <div className="mt-auto space-y-2">
                                    {(isPDF || isImg) && (
                                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold hover:bg-blue-600 transition-all">
                                            <Eye size={12} /> Visualizar
                                        </a>
                                    )}
                                    <a href={doc.file_url} download className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-800 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50">
                                        <Download size={12} /> Baixar
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 flex flex-col max-h-[95vh]">
                        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl md:rounded-t-3xl">
                            <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm md:text-base">
                                <Upload size={18} className="text-blue-600" />
                                <span>{editingDoc ? 'Editar Documento' : 'Vincular Arquivo a Locais'}</span>
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 p-2 hover:bg-slate-200 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div className="space-y-4 md:space-y-6">
                                    <div>
                                        <label className="block text-[10px] md:text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2">Título do Arquivo</label>
                                        <input required type="text" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} placeholder="Ex: Projeto Elétrico" className="w-full px-3 py-2.5 md:px-4 md:py-3 border border-slate-300 rounded-xl md:rounded-2xl outline-none text-xs md:text-sm bg-white font-bold text-slate-800" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] md:text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2">Categoria</label>
                                        <select value={newDocCategory} onChange={e => setNewDocCategory(e.target.value as DocumentCategory)} className="w-full px-3 py-2.5 md:px-4 md:py-3 border border-slate-300 rounded-xl md:rounded-2xl outline-none text-xs md:text-sm bg-white font-bold text-slate-800">
                                            {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] md:text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2">{editingDoc ? 'Alterar Arquivo (Opcional)' : 'Selecionar Arquivo'}</label>
                                        <label className="flex flex-col items-center justify-center border-2 md:border-4 border-dashed border-slate-200 rounded-2xl md:rounded-3xl p-6 md:p-8 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer">
                                            <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                                            {selectedFile ? (
                                                <div className="text-center">
                                                    <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                                                    <p className="text-[10px] md:text-xs font-bold text-slate-700 truncate max-w-[150px]">{selectedFile.name}</p>
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-400">
                                                    <Upload size={24} className="mx-auto mb-2" />
                                                    <p className="text-[9px] md:text-[10px] font-bold uppercase">Clique para subir</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                                <div className="flex flex-col h-full min-h-[300px] md:min-h-[400px]">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <label className="block text-[10px] md:text-[11px] font-black text-slate-900 uppercase tracking-widest">{editingDoc ? 'Local Vinculado' : `Locais Vinculados (${selectedContexts.length})`}</label>
                                        {selectedContexts.length > 0 && <button type="button" onClick={() => setSelectedContexts(editingDoc ? ['Geral'] : [])} className="text-[9px] md:text-[10px] font-black text-red-500 uppercase hover:underline">Limpar</button>}
                                    </div>
                                    <div className="relative mb-3">
                                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="text" placeholder="Filtrar local..." value={contextSearch} onChange={e => setContextSearch(e.target.value)} className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 text-slate-700" />
                                    </div>
                                    <div className="flex-1 border border-slate-200 rounded-2xl overflow-y-auto bg-slate-50/50 p-2 space-y-4 custom-scrollbar">
                                        <div>
                                            <p className="px-2 pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Áreas Gerais</p>
                                            <div className="grid grid-cols-1 gap-1">
                                                {structureTree.general.filter(g => g.toLowerCase().includes(contextSearch.toLowerCase())).map(area => (
                                                    <button key={area} type="button" onClick={() => toggleContext(area)} className={`flex items-center gap-2 p-2 rounded-lg text-left text-[10px] md:text-[11px] font-bold transition-all ${selectedContexts.includes(area) ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-100 hover:border-blue-200'}`}>
                                                        {selectedContexts.includes(area) ? <CheckSquare size={12} /> : <Square size={12} className="opacity-40" />}
                                                        {area}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="px-2 pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pavimentos e Unidades</p>
                                            <div className="space-y-3">
                                                {structureTree.floors.map(floor => {
                                                    const matchesFloor = floor.label.toLowerCase().includes(contextSearch.toLowerCase());
                                                    const matchingUnits = floor.units.filter(u => u.toLowerCase().includes(contextSearch.toLowerCase()));
                                                    if (!matchesFloor && matchingUnits.length === 0) return null;
                                                    return (
                                                        <div key={floor.label} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                                            <div className="bg-slate-100/50 p-2 flex justify-between items-center border-b border-slate-100">
                                                                <button type="button" onClick={() => toggleContext(floor.label)} className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-700 uppercase">
                                                                    {selectedContexts.includes(floor.label) ? <CheckSquare size={12} className="text-blue-600" /> : <Square size={12} className="opacity-40" />}
                                                                    {floor.label}
                                                                </button>
                                                                <button type="button" onClick={() => toggleFloorGroup(floor.label, floor.units)} className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase">Toda a Laje</button>
                                                            </div>
                                                            <div className="p-2 grid grid-cols-2 gap-1">
                                                                {matchingUnits.map(unit => (
                                                                    <button key={unit} type="button" onClick={() => toggleContext(unit)} className={`flex items-center gap-1.5 p-1.5 rounded-md text-[9px] md:text-[10px] font-bold transition-all ${selectedContexts.includes(unit) ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50 border border-transparent'}`}>
                                                                        {selectedContexts.includes(unit) ? <Check size={10} /> : <div className="w-2.5 h-2.5 border border-slate-200 rounded-sm" />}
                                                                        {unit.replace('Apto ', '')}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 md:py-4 bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase transition-all">Cancelar</button>
                                <button type="submit" disabled={uploadLoading || selectedContexts.length === 0} className="flex-[2] py-3 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase shadow-xl flex items-center justify-center gap-2 md:gap-3 hover:bg-blue-600 disabled:opacity-50 transition-all">
                                    {uploadLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {uploadLoading ? 'Salvando...' : (editingDoc ? 'Atualizar Documento' : `Vincular a ${selectedContexts.length} Locais`)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
