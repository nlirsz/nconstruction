import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Project, Note, UserProfile } from '../types';
import { Send, User, Clock, MessageSquare, Image as ImageIcon, CheckCircle2, MoreVertical, Paperclip, ChevronRight, Info } from 'lucide-react';

interface UnitCommunicationProps {
    project: Project;
    unitId: string;
    role: 'client' | 'architect';
}

export const UnitCommunication: React.FC<UnitCommunicationProps> = ({ project, unitId, role }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
        fetchNotes();
    }, [project.id, unitId]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('project_notes')
                .select('*, project_note_replies(*)')
                .eq('project_id', project.id)
                .eq('context', unitId) // Usamos context para filtrar pela unidade
                .order('created_at', { ascending: false });

            if (error) throw error;

            const sortedNotes = (data || []).map(note => ({
                ...note,
                project_note_replies: (note.project_note_replies || []).sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
            }));

            setNotes(sortedNotes);

            // Fetch profiles for users in this context
            const userEmails = new Set<string>();
            sortedNotes.forEach(n => {
                userEmails.add(n.created_by);
                n.project_note_replies.forEach((r: any) => userEmails.add(r.created_by));
            });

            if (userEmails.size > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('email', Array.from(userEmails));

                if (profilesData) {
                    const pMap: Record<string, UserProfile> = {};
                    profilesData.forEach(p => pMap[p.email] = p);
                    setProfiles(pMap);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar comunicações:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddReply = async (noteId: string) => {
        const text = replyText[noteId];
        if (!text?.trim()) return;

        try {
            const { error } = await supabase
                .from('project_note_replies')
                .insert({
                    note_id: noteId,
                    content: text,
                    created_by: currentUser.email
                });

            if (error) throw error;

            setReplyText(prev => ({ ...prev, [noteId]: '' }));
            setActiveReplyId(null);
            fetchNotes();
        } catch (error) {
            console.error("Erro ao comentar:", error);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando mural...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-10">
            {notes.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <MessageSquare size={24} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 uppercase">Nada por aqui ainda</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-2 leading-relaxed">
                        As atualizações da construtora sobre a sua unidade aparecerão aqui. Fique atento!
                    </p>
                </div>
            ) : (
                <div className="relative">
                    {/* Linha Vertical das Timeline */}
                    <div className="absolute left-6 top-8 bottom-0 w-px bg-slate-100 hidden md:block"></div>

                    <div className="space-y-10">
                        {notes.map((note) => {
                            const creator = profiles[note.created_by] || { full_name: note.created_by.split('@')[0], avatar_url: '' };
                            const isCompanyPost = true; // Por definição, no mural do cliente, o Post principal é da empresa

                            return (
                                <div key={note.id} className="relative pl-0 md:pl-16 group">
                                    {/* Ponto da Timeline */}
                                    <div className="absolute left-4 top-1 md:left-4 md:top-2 w-4 h-4 rounded-full bg-white border-4 border-blue-600 z-10 hidden md:block"></div>

                                    <article className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                        {/* Cabeçalho do Post */}
                                        <header className="p-5 md:p-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-200 rounded-xl overflow-hidden border-2 border-white shadow-sm">
                                                    {creator.avatar_url ? (
                                                        <img src={creator.avatar_url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white font-black text-xs">CO</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{creator.full_name}</h4>
                                                        <span className="text-[8px] font-black uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Equipe de Obra</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                                                        <Clock size={10} />
                                                        <span className="text-[10px] font-bold uppercase">{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {note.priority === 'high' && (
                                                <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase">
                                                    <Info size={12} /> Importante
                                                </div>
                                            )}
                                        </header>

                                        {/* Conteúdo do Post */}
                                        <div className="p-5 md:p-6 space-y-4">
                                            {note.title && (
                                                <h3 className="text-lg font-black text-slate-900 leading-tight">{note.title}</h3>
                                            )}
                                            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                {note.content}
                                            </div>

                                            {/* Anexos */}
                                            {note.attachments && note.attachments.length > 0 && (
                                                <div className="grid grid-cols-2 gap-2 mt-4">
                                                    {note.attachments.map((url, idx) => (
                                                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-100 block group/img">
                                                            <img src={url} className="w-full h-full object-cover" />
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase gap-2">
                                                                <ImageIcon size={16} /> Ver Foto
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Rodapé / Comentários */}
                                        <footer className="bg-slate-50/30 border-t border-slate-50 p-4 md:p-6">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <MessageSquare size={12} /> {note.project_note_replies?.length || 0} Comentários
                                                </span>
                                                <div className="h-px bg-slate-100 flex-1"></div>
                                            </div>

                                            <div className="space-y-4">
                                                {note.project_note_replies?.map((reply: any) => {
                                                    const rUser = profiles[reply.created_by] || { full_name: reply.created_by.split('@')[0], avatar_url: '' };
                                                    const isMe = reply.created_by === currentUser?.email;

                                                    return (
                                                        <div key={reply.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                            <div className={`w-8 h-8 rounded-full bg-slate-200 border border-white shrink-0 overflow-hidden ${isMe ? 'ring-2 ring-blue-100' : ''}`}>
                                                                {rUser.avatar_url ? (
                                                                    <img src={rUser.avatar_url} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-[10px] bg-slate-300 text-white font-bold">
                                                                        {rUser.full_name?.[0] || 'U'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className={`max-w-[85%] ${isMe ? 'items-end flex flex-col' : ''}`}>
                                                                <div className={`p-3 rounded-2xl text-[13px] ${isMe ? 'bg-blue-600 text-white rounded-tr-sm shadow-sm shadow-blue-200' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm shadow-slate-50'}`}>
                                                                    {reply.content}
                                                                </div>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                                                    {new Date(reply.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Campo de Comentário */}
                                            <div className="flex gap-2 mt-6">
                                                <input
                                                    type="text"
                                                    placeholder="Adicione um comentário ou dúvida..."
                                                    value={replyText[note.id] || ''}
                                                    onChange={e => setReplyText({ ...replyText, [note.id]: e.target.value })}
                                                    onKeyDown={e => e.key === 'Enter' && handleAddReply(note.id)}
                                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                                                />
                                                <button
                                                    onClick={() => handleAddReply(note.id)}
                                                    className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                                >
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                        </footer>
                                    </article>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
