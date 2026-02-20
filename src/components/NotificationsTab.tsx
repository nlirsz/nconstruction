import React, { useState, useEffect } from 'react';
import { Project, Notification } from '../types';
import { supabase } from '../services/supabaseClient';
import { Bell, Check, Trash2, ExternalLink, Loader2, Calendar } from 'lucide-react';

interface NotificationsTabProps {
    projects: Project[];
    onSelectProject: (project: Project) => void;
    currentUser: any;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ projects, onSelectProject, currentUser }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    // Reusing same logic as NotificationCenter
    const fetchNotifications = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (data && !error) {
            const filtered = data.filter((n: Notification) => n.created_by !== currentUser?.email);
            setNotifications(filtered);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        const channel = supabase
            .channel('public:notifications:tab')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                const newNote = payload.new as Notification;
                if (newNote.created_by !== currentUser?.email) {
                    setNotifications(prev => [newNote, ...prev]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const clearAll = async () => {
        if (notifications.length === 0) return;
        const ids = notifications.map(n => n.id);
        await supabase.from('notifications').delete().in('id', ids);
        setNotifications([]);
    };

    const deleteNotification = async (id: string) => {
        await supabase.from('notifications').delete().eq('id', id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        if (notification.project_id) {
            const targetProject = projects.find(p => p.id === notification.project_id);
            if (targetProject) {
                onSelectProject(targetProject);
            }
        }
    };

    const formatTimeInfo = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <Bell size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Todas as Notificações</h2>
                            <p className="text-xs text-slate-500 mt-1">Veja seus alertas, atualizações de tarefas e recados importantes</p>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        {notifications.some(n => !n.is_read) && (
                            <button onClick={markAllAsRead} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2">
                                <Check size={14} /> Marcar lidas
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button onClick={clearAll} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                                <Trash2 size={14} /> Limpar Tudo
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50/30">
                    {notifications.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                            <Bell size={48} className="opacity-20 mb-4" />
                            <h3 className="text-lg font-bold text-slate-600 mb-1">Caixa Vazia</h3>
                            <p className="text-sm">Você não tem novas notificações no momento.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {notifications.map(notif => {
                                const hasLink = !!notif.project_id;
                                const linkedProjectName = hasLink ? projects.find(p => p.id === notif.project_id)?.name : null;

                                return (
                                    <div key={notif.id} className={`p-4 md:p-6 transition-colors hover:bg-white flex flex-col md:flex-row gap-4 items-start md:items-center relative ${!notif.is_read ? 'bg-blue-50/20' : 'bg-transparent'}`}>
                                        {!notif.is_read && <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-10 bg-blue-500 rounded-r-full"></div>}

                                        <div className="flex-1 w-full ml-2">
                                            <div className="flex justify-between items-start md:items-center mb-2">
                                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{notif.created_by?.split('@')[0]}</span>
                                                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatTimeInfo(notif.created_at)}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    {!notif.is_read && (
                                                        <button onClick={() => markAsRead(notif.id)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg" title="Marcar como lida">
                                                            <Check size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => deleteNotification(notif.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Excluir notificação">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <p className="text-sm md:text-base text-slate-800 leading-snug">{notif.content}</p>

                                            {hasLink && (
                                                <div className="mt-3">
                                                    <button onClick={() => handleNotificationClick(notif)} className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm">
                                                        <ExternalLink size={14} />
                                                        Ver ({linkedProjectName || 'Obra'})
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
