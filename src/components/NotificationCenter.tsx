import React, { useState, useEffect, useRef } from 'react';
import { Bell, ArrowRight, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Notification, Project } from '../types';

interface NotificationCenterProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  currentUser: any;
  iconClassName?: string;
  onViewAll?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ projects, onSelectProject, currentUser, iconClassName, onViewAll }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data && !error) {
      // Filter out notifications created by current user (optional, depending on preference)
      const filtered = data.filter((n: Notification) => n.created_by !== currentUser?.email);
      setNotifications(filtered);
      setUnreadCount(filtered.filter((n: Notification) => !n.is_read).length);
    }
  };

  // Initial Fetch and Realtime Subscription
  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNote = payload.new as Notification;
        if (newNote.created_by !== currentUser?.email) {
          setNotifications(prev => [newNote, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map(n => n.id);
    await supabase.from('notifications').delete().in('id', ids);
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.project_id) {
      const targetProject = projects.find(p => p.id === notification.project_id);
      if (targetProject) {
        onSelectProject(targetProject);
        setIsOpen(false);
      }
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${iconClassName || 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-slate-700 text-sm">Notificações</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} novas</span>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase flex items-center gap-1" title="Limpar Tudo">
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">Nenhuma notificação.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map(notif => {
                  const hasLink = !!notif.project_id;
                  const linkedProjectName = hasLink ? projects.find(p => p.id === notif.project_id)?.name : null;

                  return (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-slate-50 transition-colors relative group ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                    >
                      {!notif.is_read && (
                        <div className="absolute left-2 top-5 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      )}

                      <div className="pl-2">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            {notif.created_by?.split('@')[0]} • {formatTime(notif.created_at)}
                          </span>
                          {!notif.is_read && (
                            <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }} className="text-slate-300 hover:text-blue-500" title="Marcar como lida">
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 leading-snug mb-2">{notif.content}</p>

                        {hasLink && (
                          <button
                            onClick={() => handleNotificationClick(notif)}
                            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors w-full mt-2 shadow-sm"
                          >
                            <ExternalLink size={12} />
                            Ver ({linkedProjectName || 'Obra'})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {notifications.length > 0 && onViewAll && (
            <div className="p-2 border-t border-slate-100 bg-white">
              <button
                onClick={() => { setIsOpen(false); onViewAll(); }}
                className="w-full py-2 text-center text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};