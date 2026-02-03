
import React, { useState, useEffect, useMemo } from 'react';
import { Note, Project, UserProfile, NoteStatus } from '../types';
import { supabase, uploadFile } from '../services/supabaseClient';
import {
    NotebookPen, Send, CheckCircle2, Circle, Clock, Trash2, MessageSquare,
    User, Tag, Filter, Edit2, X, Save, Search, Plus, Calendar,
    Flag, Paperclip, MoreVertical, LayoutGrid, List, AlertCircle, Ban, ArrowRight, Upload, Loader2, MapPin
} from 'lucide-react';

interface NotesTabProps {
    project: Project;
    currentUser: any;
    userProfile?: UserProfile | null;
}

const PRIORITIES = [
    { id: 'low', label: 'Baixa', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    { id: 'medium', label: 'Média', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'high', label: 'Alta', color: 'bg-red-50 text-red-700 border-red-200' }
];

const STATUSES: { id: NoteStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'pending', label: 'A Fazer', icon: <Circle size={14} />, color: 'text-slate-500 bg-slate-50 border-slate-200' },
    { id: 'in_progress', label: 'Em Andamento', icon: <Clock size={14} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'blocked', label: 'Bloqueado', icon: <Ban size={14} />, color: 'text-red-600 bg-red-50 border-red-200' },
    { id: 'completed', label: 'Concluído', icon: <CheckCircle2 size={14} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

export const NotesTab: React.FC<NotesTabProps> = ({ project, currentUser, userProfile }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // View State
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [filterMode, setFilterMode] = useState<'all' | 'my'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    // Form Fields
    const [formData, setFormData] = useState({
        title: '', content: '', priority: 'medium' as 'low' | 'medium' | 'high', status: 'pending' as NoteStatus, assigned_to: '', due_date: '', context: '', attachments: [] as File[]
    });

    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([fetchNotes(), fetchMembers()]).then(() => setLoading(false));
    }, [project.id]);

    const fetchMembers = async () => {
        const { data } = await supabase.from('project_members').select('*, profiles:user_id(*)').eq('project_id', project.id);
        if (data) setProjectMembers(data);
    };

    const fetchNotes = async () => {
        const { data, error } = await supabase.from('project_notes').select('*, project_note_replies(*)').eq('project_id', project.id).order('created_at', { ascending: false });
        if (!error && data) {
            setNotes(data.map((note: any) => ({ ...note, status: note.status || (note.is_completed ? 'completed' : 'pending'), project_note_replies: note.project_note_replies?.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [] })));
        }
    };

    // Mapa de perfis unificado
    const profileMap = useMemo(() => {
        const map: Record<string, { name: string, avatar: string }> = {};
        projectMembers.forEach(m => {
            if (m.profiles?.email || m.profiles?.id) {
                const key = m.profiles.email || m.profiles.id;
                map[key] = { name: m.profiles.full_name, avatar: m.profiles.avatar_url };
            }
        });
        if (currentUser?.email && userProfile) {
            map[currentUser.email] = { name: userProfile.full_name, avatar: userProfile.avatar_url };
        }
        return map;
    }, [projectMembers, currentUser, userProfile]);

    const handleOpenCreate = () => { setEditingNote(null); setFormData({ title: '', content: '', priority: 'medium', status: 'pending', assigned_to: '', due_date: '', context: '', attachments: [] }); setIsModalOpen(true); };
    const handleOpenEdit = (note: Note) => { setEditingNote(note); setFormData({ title: note.title || '', content: note.content, priority: note.priority || 'medium', status: note.status, assigned_to: note.assigned_to || '', due_date: note.due_date || '', context: note.context || '', attachments: [] }); setIsModalOpen(true); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        setFormLoading(true);
        const uploadedUrls: string[] = [];
        const galleryEntries: any[] = [];

        for (const file of formData.attachments) {
            const url = await uploadFile(file, `notes/${project.id}`);
            if (url) {
                uploadedUrls.push(url);
                // NEW: Sync with project_photos if it's an image
                if (file.type.startsWith('image/')) {
                    const { data: photoData } = await supabase.from('project_photos').insert({
                        project_id: project.id,
                        url,
                        description: formData.title || 'Anexo de Nota',
                        category: 'inspection',
                        location_label: formData.context || 'Notas Gerais',
                        created_by: currentUser?.email
                    }).select().single();
                    if (photoData) galleryEntries.push(photoData);
                }
            }
        }

        const payload = { project_id: project.id, title: formData.title || 'Sem título', content: formData.content, priority: formData.priority, status: formData.status, assigned_to: formData.assigned_to || null, due_date: formData.due_date || null, context: formData.context || null, is_completed: formData.status === 'completed', updated_at: new Date().toISOString() };
        let error;
        if (editingNote) {
            const { error: err } = await supabase.from('project_notes').update({ ...payload, attachments: [...(editingNote.attachments || []), ...uploadedUrls] }).eq('id', editingNote.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('project_notes').insert({ ...payload, created_by: currentUser.email, attachments: uploadedUrls });
            error = err;
        }
        if (!error) { fetchNotes(); setIsModalOpen(false); }
        setFormLoading(false);
    };

    const handleAddReply = async (noteId: string) => {
        const text = replyText[noteId];
        if (!text?.trim()) return;
        const { error } = await supabase.from('project_note_replies').insert({ note_id: noteId, content: text, created_by: currentUser.email });
        if (!error) { setReplyText(prev => ({ ...prev, [noteId]: '' })); setActiveReplyId(null); fetchNotes(); }
    };

    const filteredNotes = useMemo(() => {
        return notes.filter(n => {
            const matchesSearch = (n.title?.toLowerCase().includes(searchTerm.toLowerCase()) || '') || n.content.toLowerCase().includes(searchTerm.toLowerCase()) || (n.context?.toLowerCase().includes(searchTerm.toLowerCase()) || '');
            const matchesMy = filterMode === 'my' ? (n.assigned_to === currentUser.email || n.created_by === currentUser.email) : true;
            return matchesSearch && matchesMy;
        });
    }, [notes, searchTerm, filterMode, currentUser.email]);

    const kanbanColumns = useMemo(() => {
        const cols: Record<NoteStatus, Note[]> = { pending: [], in_progress: [], blocked: [], completed: [] };
        filteredNotes.forEach(n => { if (cols[n.status]) cols[n.status].push(n); else cols['pending'].push(n); });
        return cols;
    }, [filteredNotes]);

    if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

    return (
        <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-6 mb-8 px-1">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><NotebookPen className="text-blue-600" size={24} /> Pendências</h2>
                        <p className="text-slate-500 mt-1">Coordene observações e prazos da equipe.</p>
                    </div>
                    <button onClick={handleOpenCreate} className="bg-slate-900 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center gap-2"><Plus size={18} /> Nova Tarefa</button>
                </div>
                <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}><List size={18} /></button>
                            <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
                        </div>
                        <button onClick={() => setFilterMode('all')} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${filterMode === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}>Todos</button>
                        <button onClick={() => setFilterMode('my')} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${filterMode === 'my' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}>Minhas</button>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-lg text-sm outline-none text-slate-700" />
                    </div>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredNotes.map(note => <NoteCard key={note.id} note={note} onEdit={handleOpenEdit} onStatusChange={(n, s) => { supabase.from('project_notes').update({ status: s, is_completed: s === 'completed' }).eq('id', n.id).then(() => fetchNotes()); }} onReply={handleAddReply} currentUser={currentUser} activeReplyId={activeReplyId} setActiveReplyId={setActiveReplyId} replyText={replyText} setReplyText={setReplyText} profileMap={profileMap} />)}
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-6">
                    {STATUSES.map(status => (
                        <div key={status.id} className="min-w-[300px] w-[300px] flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/60 h-fit">
                            <div className="p-3 border-b border-slate-200 bg-white rounded-t-xl flex items-center justify-between">
                                <div className="flex items-center gap-2"><span className={`p-1 rounded-md ${status.color}`}>{status.icon}</span><span className="font-bold text-slate-700 text-sm">{status.label}</span></div>
                            </div>
                            <div className="p-2 space-y-3">
                                {kanbanColumns[status.id].map(note => <NoteCard key={note.id} note={note} minimal profileMap={profileMap} onEdit={handleOpenEdit} />)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center md:p-4">
                    <div className="bg-white rounded-none md:rounded-xl shadow-2xl w-full h-full md:h-auto md:max-w-lg border flex flex-col max-h-screen md:max-h-[90vh]">
                        <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="font-bold text-slate-800">{editingNote ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Título" className="w-full px-3 py-2.5 border rounded-lg text-slate-800" />
                            <textarea required value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} placeholder="Descrição" rows={4} className="w-full px-3 py-2 border rounded-lg resize-none text-slate-800" />
                            <div className="grid grid-cols-2 gap-4">
                                <select value={formData.assigned_to} onChange={e => setFormData({ ...formData, assigned_to: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-slate-800 bg-white">
                                    <option value="">Atribuir a...</option>
                                    {projectMembers.map(m => <option key={m.id} value={m.profiles?.email || m.profiles?.id}>{m.profiles?.full_name}</option>)}
                                </select>
                                <input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-slate-800" />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-sm text-slate-500">Cancelar</button>
                                <button type="submit" disabled={formLoading} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm">{formLoading ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const NoteCard = ({ note, minimal, onEdit, onStatusChange, onReply, currentUser, activeReplyId, setActiveReplyId, replyText, setReplyText, profileMap }: any) => {
    const priorityInfo = PRIORITIES.find(p => p.id === (note.priority || 'medium'))!;
    const statusInfo = STATUSES.find(s => s.id === note.status)!;
    const creator = profileMap[note.created_by] || { name: note.created_by.split('@')[0], avatar: '' };
    const assignee = note.assigned_to ? (profileMap[note.assigned_to] || { name: note.assigned_to.split('@')[0], avatar: '' }) : null;

    if (minimal) {
        return (
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${priorityInfo.color}`}>{priorityInfo.label}</span>
                    {onEdit && <button onClick={() => onEdit(note)} className="text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>}
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 line-clamp-2">{note.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-1.5">
                        {assignee && (
                            <div className="w-5 h-5 rounded-full bg-blue-100 overflow-hidden border border-blue-200" title={`Atribuído a ${assignee.name}`}>
                                {assignee.avatar ? <img src={assignee.avatar} className="w-full h-full object-cover" /> : <User size={10} className="m-auto mt-0.5 text-blue-500" />}
                            </div>
                        )}
                        {note.due_date && <span className="text-[9px] font-bold text-slate-400">{new Date(note.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                    </div>
                    {note.attachments?.length > 0 && <Paperclip size={12} className="text-slate-400" />}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
            <div className="p-4 flex-1">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${priorityInfo.color}`}>{priorityInfo.label}</span>
                        {note.context && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 flex items-center gap-1"><MapPin size={10} /> {note.context}</span>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && <button onClick={() => onEdit(note)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>}
                    </div>
                </div>
                <div className="mb-4">
                    <h3 className="font-bold text-slate-800 mb-1">{note.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-3">{note.content}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white overflow-hidden" title={`Criado por ${creator.name}`}>
                                {creator.avatar ? <img src={creator.avatar} className="w-full h-full object-cover" /> : <User size={12} className="m-auto mt-0.5 text-slate-400" />}
                            </div>
                            {assignee && (
                                <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white overflow-hidden" title={`Atribuído a ${assignee.name}`}>
                                    {assignee.avatar ? <img src={assignee.avatar} className="w-full h-full object-cover" /> : <User size={12} className="m-auto mt-0.5 text-blue-500" />}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[100px]">{assignee ? assignee.name : creator.name}</span>
                    </div>
                    {note.due_date && <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={12} /> {new Date(note.due_date).toLocaleDateString('pt-BR')}</div>}
                </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-b-xl border-t flex items-center justify-between">
                <button className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${statusInfo.color}`}>{statusInfo.icon} {statusInfo.label}</button>
                <button onClick={() => setActiveReplyId && setActiveReplyId(activeReplyId === note.id ? null : note.id)} className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-blue-600"><MessageSquare size={14} /> {note.project_note_replies?.length || 0}</button>
            </div>
            {activeReplyId === note.id && (
                <div className="bg-slate-50 border-t p-3 animate-in slide-in-from-top-2">
                    <div className="space-y-3 mb-3 max-h-[150px] overflow-y-auto">
                        {note.project_note_replies?.map((reply: any) => {
                            const rDisplay = profileMap[reply.created_by] || { name: reply.created_by.split('@')[0], avatar: '' };
                            return (
                                <div key={reply.id} className="text-[11px]">
                                    <div className="flex justify-between text-slate-400 mb-0.5 font-bold"><span>{rDisplay.name}</span><span>{new Date(reply.created_at).toLocaleDateString('pt-BR')}</span></div>
                                    <div className="bg-white p-2 rounded-lg border shadow-sm text-slate-700">{reply.content}</div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Responder..." value={replyText?.[note.id] || ''} onChange={e => setReplyText({ ...replyText, [note.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && onReply(note.id)} className="flex-1 px-3 py-1.5 text-xs border rounded-lg outline-none text-slate-800" />
                        <button onClick={() => onReply(note.id)} className="p-1.5 bg-blue-600 text-white rounded-lg"><Send size={12} /></button>
                    </div>
                </div>
            )}
        </div>
    );
};
