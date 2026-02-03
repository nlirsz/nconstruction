import React, { useState, useEffect } from 'react';
import { Organization, OrganizationMember, OrganizationInvite } from '../types';
import { supabase, uploadImage } from '../services/supabaseClient';
import { X, Building2, Users, Save, Loader2, Upload, Trash2, Mail, ShieldCheck, Crown } from 'lucide-react';

interface OrganizationSettingsProps {
  organization: Organization;
  onClose: () => void;
  onUpdate: (org: Organization) => void;
  currentUser: any;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ organization, onClose, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'members'>('general');
  
  // General State
  const [name, setName] = useState(organization.name);
  const [cnpj, setCnpj] = useState(organization.cnpj || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(organization.logo_url || null);
  const [saving, setSaving] = useState(false);

  // Members State
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
      if (activeTab === 'members') {
          fetchMembersData();
      }
  }, [activeTab]);

  const fetchMembersData = async () => {
      setLoadingMembers(true);
      try {
          // 1. Fetch Raw Members (IDs only first to avoid Join RLS issues)
          const { data: membersRaw } = await supabase
            .from('organization_members')
            .select('*')
            .eq('organization_id', organization.id);
          
          // 2. Fetch Invites
          const { data: invitesData } = await supabase
            .from('organization_invites')
            .select('*')
            .eq('organization_id', organization.id);
          
          if (invitesData) setInvites(invitesData);

          // 3. Fetch Profiles manually if members exist
          if (membersRaw && membersRaw.length > 0) {
              const userIds = membersRaw.map(m => m.user_id);
              
              const { data: profilesData } = await supabase
                  .from('profiles')
                  .select('*')
                  .in('id', userIds);
              
              const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

              const mergedMembers = membersRaw.map(m => ({
                  ...m,
                  profiles: profilesMap.get(m.user_id) || { full_name: 'Usuário', avatar_url: '' }
              }));

              setMembers(mergedMembers);
          } else {
              setMembers([]);
          }

      } catch (err) {
          console.error("Error fetching org data:", err);
      } finally {
          setLoadingMembers(false);
      }
  };

  const handleUpdateGeneral = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
          let logoUrl = organization.logo_url;
          if (logoFile) {
              logoUrl = await uploadImage(logoFile, 'organization-logos') || logoUrl;
          }

          const { error } = await supabase
            .from('organizations')
            .update({ name, cnpj, logo_url: logoUrl })
            .eq('id', organization.id);

          if (error) throw error;

          onUpdate({ ...organization, name, cnpj, logo_url: logoUrl });
          alert("Empresa atualizada com sucesso!");
      } catch (err: any) {
          alert("Erro ao atualizar empresa: " + err.message);
      } finally {
          setSaving(false);
      }
  };

  const handleInvite = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inviteEmail) return;
      setInviting(true);

      try {
          const { error } = await supabase.from('organization_invites').insert({
              organization_id: organization.id,
              email: inviteEmail.trim().toLowerCase(),
              role: 'member',
              invited_by: currentUser.email
          });

          if (error) throw error;

          setInviteEmail('');
          fetchMembersData(); // Refresh list
      } catch (err: any) {
          alert("Erro ao enviar convite: " + err.message);
      } finally {
          setInviting(false);
      }
  };

  const handleRemoveMember = async (id: string) => {
      if(!confirm("Remover este membro da empresa?")) return;
      await supabase.from('organization_members').delete().eq('id', id);
      fetchMembersData();
  };

  const handleCancelInvite = async (id: string) => {
      await supabase.from('organization_invites').delete().eq('id', id);
      fetchMembersData();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
        
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            Gerenciar Empresa
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
            <button 
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
                Geral
            </button>
            <button 
                onClick={() => setActiveTab('members')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
                Membros & Acesso
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' ? (
                <form onSubmit={handleUpdateGeneral} className="space-y-6">
                    <div className="flex justify-center">
                        <label className="relative group cursor-pointer">
                            <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors">
                                {logoPreview ? (
                                    <img src={logoPreview} className="w-full h-full object-cover" />
                                ) : (
                                    <Upload className="text-slate-400" size={24} />
                                )}
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                if(e.target.files?.[0]) {
                                    setLogoFile(e.target.files[0]);
                                    setLogoPreview(URL.createObjectURL(e.target.files[0]));
                                }
                            }} />
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Nome da Empresa</label>
                        <input 
                            type="text" 
                            required 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-800"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">CNPJ</label>
                        <input 
                            type="text" 
                            value={cnpj} 
                            onChange={e => setCnpj(e.target.value)} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-800"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm"><Mail size={16}/> Convidar por E-mail</h4>
                        <form onSubmit={handleInvite} className="flex gap-2">
                            <input 
                                type="email" 
                                placeholder="usuario@email.com" 
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                required
                            />
                            <button 
                                type="submit" 
                                disabled={inviting}
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 disabled:opacity-70"
                            >
                                {inviting ? 'Enviando...' : 'Convidar'}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><ShieldCheck size={16}/> Membros da Empresa</h4>
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                {loadingMembers ? (
                                    <div className="p-4 text-center"><Loader2 className="animate-spin inline text-blue-600" /></div>
                                ) : members.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-sm">Nenhum membro encontrado.</div>
                                ) : (
                                    members.map(member => (
                                        <div key={member.id} className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden border border-blue-200">
                                                    {member.profiles?.avatar_url ? (
                                                        <img src={member.profiles.avatar_url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        (member.profiles?.full_name || 'U').substring(0,2).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                                        {member.profiles?.full_name || 'Usuário'}
                                                        {member.role === 'admin' && <Crown size={12} className="text-amber-500 fill-current" />}
                                                    </p>
                                                    <p className="text-xs text-slate-500 capitalize">{member.role}</p>
                                                </div>
                                            </div>
                                            {member.role !== 'admin' && ( // Prevent removing admins/owners easily here
                                                <button onClick={() => handleRemoveMember(member.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {invites.length > 0 && (
                            <div>
                                <h4 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><Mail size={16}/> Convites Pendentes</h4>
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                    {invites.map(invite => (
                                        <div key={invite.id} className="p-3 flex items-center justify-between bg-slate-50/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs">@</div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{invite.email}</p>
                                                    <p className="text-xs text-slate-500">Enviado por {invite.invited_by || 'Admin'}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleCancelInvite(invite.id)} className="text-slate-400 hover:text-red-600 p-1"><X size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};