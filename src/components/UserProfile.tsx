
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { supabase, uploadImage } from '../services/supabaseClient';
import { X, Camera, Save, User, Briefcase, Loader2, LogOut } from 'lucide-react';

interface UserProfileProps {
  session: any;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileProps> = ({ session, isOpen, onClose, onProfileUpdate }) => {
  const [profile, setProfile] = useState<UserProfile>({
    id: session.user.id,
    full_name: '',
    avatar_url: '',
    role: 'Engenheiro'
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen, session.user.id]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) {
      setProfile(data);
    } else if (error && error.code === 'PGRST116') {
      // Profile doesn't exist yet, creates a default based on auth
      const newProfile = {
          id: session.user.id,
          full_name: session.user.email?.split('@')[0] || 'Usuário',
          avatar_url: '',
          role: 'Engenheiro'
      };
      setProfile(newProfile);
    }
    setLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .upsert(profile);

    if (!error) {
      onProfileUpdate(profile);
      onClose();
    } else {
      console.error('Error updating profile:', error);
      alert('Erro ao salvar perfil.');
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    const file = e.target.files[0];
    
    // Upload to 'avatars' bucket
    const publicUrl = await uploadImage(file, 'avatars');
    
    if (publicUrl) {
      setProfile({ ...profile, avatar_url: publicUrl });
    }
    setUploading(false);
  };

  const handleLogout = async () => {
      setLoggingOut(true);
      try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          // App.tsx will handle state cleanup and redirect via onAuthStateChange
      } catch (error) {
          console.error("Erro ao fazer logout:", error);
          // Fallback only if API fails locally
          window.location.href = '/';
      } finally {
          if (loggingOut) setLoggingOut(false);
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <User size={18} className="text-blue-600" />
            Meu Perfil
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User size={40} />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-sm">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
            </div>
            <p className="mt-3 text-sm text-slate-500 font-medium">{session.user.email}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={profile.full_name} 
                  onChange={e => setProfile({...profile, full_name: e.target.value})}
                  className="w-full pl-10 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Cargo / Função</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={profile.role} 
                  onChange={e => setProfile({...profile, role: e.target.value})}
                  className="w-full pl-10 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                  placeholder="Ex: Engenheiro Residente"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
             <button 
              type="button" 
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center gap-2 text-sm disabled:opacity-70"
            >
              {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              Sair
            </button>
            <div className="flex-1"></div>
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2.5 text-slate-500 font-bold hover:text-slate-700 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70 text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Perfil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
