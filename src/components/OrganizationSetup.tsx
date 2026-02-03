
import React, { useState, useEffect } from 'react';
import { supabase, uploadImage } from '../services/supabaseClient';
import { Building2, Upload, Loader2, CheckCircle2, ArrowRight, Database, Copy, Check, AlertTriangle, Mail, RefreshCcw, X } from 'lucide-react';
import { Organization, OrganizationInvite } from '../types';
import { APP_LOGO_URL } from '../constants';

interface OrganizationSetupProps {
  currentUser: any;
  onOrganizationCreated: (org: Organization) => void;
  variant?: 'fullscreen' | 'modal';
  onClose?: () => void;
}

export const OrganizationSetup: React.FC<OrganizationSetupProps> = ({ 
  currentUser, 
  onOrganizationCreated, 
  variant = 'fullscreen',
  onClose 
}) => {
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Invites State
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  useEffect(() => {
      fetchInvites();
  }, [currentUser.email]);

  const fetchInvites = async () => {
      setLoadingInvites(true);
      try {
          const { data, error } = await supabase
            .from('organization_invites')
            .select('*, organization:organizations(*)')
            .eq('email', currentUser.email)
            .eq('status', 'pending');
          
          if (data) setInvites(data);
      } catch (err) {
          console.error("Erro ao buscar convites:", err);
      } finally {
          setLoadingInvites(false);
      }
  };

  const handleAcceptInvite = async (invite: OrganizationInvite) => {
      setProcessingInvite(invite.id);
      setError(null);
      try {
          // 1. Add to members
          const { error: memberError } = await supabase.from('organization_members').insert({
              organization_id: invite.organization_id,
              user_id: currentUser.id,
              role: invite.role
          });

          if (memberError) throw memberError;

          // 2. Update invite status or delete
          await supabase.from('organization_invites').delete().eq('id', invite.id);

          // 3. Complete setup
          if (invite.organization) {
              onOrganizationCreated(invite.organization);
          } else {
              // Fetch org if join didn't work properly
              const { data: org } = await supabase.from('organizations').select('*').eq('id', invite.organization_id).single();
              if (org) onOrganizationCreated(org);
          }

      } catch (err: any) {
          console.error("Erro ao aceitar convite:", err);
          setError(err);
          // Auto-show SQL help if permission denied or recursion error
          if (err.code === '42501' || err.code === '42P17') {
             setShowSql(true);
          }
      } finally {
          setProcessingInvite(null);
      }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCopySql = () => {
    const sql = `
-- 1. Atualizações de Tabela (Fix para Erro PGRST204)
alter table if exists projects add column if not exists phases jsonb;

-- 2. Tabelas Principais de Organização
create table if not exists organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  cnpj text,
  logo_url text,
  owner_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default now()
);

create table if not exists organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'admin',
  created_at timestamp with time zone default now()
);

create table if not exists organization_invites (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references organizations(id) on delete cascade,
  email text not null,
  role text default 'member',
  status text default 'pending',
  invited_by text,
  created_at timestamp with time zone default now()
);

-- 3. Limpeza de Políticas Antigas (Evita erro 42710)
drop policy if exists "Ver minhas organizacoes" on organizations;
drop policy if exists "Criar organizacoes" on organizations;
drop policy if exists "Atualizar organizacoes" on organizations;
drop policy if exists "Ver membros" on organization_members;
drop policy if exists "Donos inserem membros" on organization_members;
drop policy if exists "Aceitar convite" on organization_members;
drop policy if exists "Remover membros" on organization_members;
drop policy if exists "Ver convites" on organization_invites;
drop policy if exists "Criar convites" on organization_invites;
drop policy if exists "Gerenciar convites" on organization_invites;

-- 4. RLS e Segurança
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invites enable row level security;

-- Função auxiliar para evitar recursão infinita
create or replace function public.is_org_member(_org_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from organization_members
    where organization_id = _org_id and user_id = auth.uid()
  );
$$;

-- Políticas Organizations
create policy "Ver minhas organizacoes" on organizations for select
  using (owner_id = auth.uid() or public.is_org_member(id));
create policy "Criar organizacoes" on organizations for insert
  with check (owner_id = auth.uid());
create policy "Atualizar organizacoes" on organizations for update
  using (owner_id = auth.uid() or public.is_org_member(id));

-- Políticas Members
create policy "Ver membros" on organization_members for select
  using (
    user_id = auth.uid() or public.is_org_member(organization_id) or
    exists (select 1 from organizations where id = organization_id and owner_id = auth.uid())
  );

create policy "Donos inserem membros" on organization_members for insert
  with check (exists (select 1 from organizations where id = organization_id and owner_id = auth.uid()));

create policy "Aceitar convite" on organization_members for insert
  with check (
    auth.uid() = user_id AND
    exists (
      select 1 from organization_invites 
      where organization_id = organization_members.organization_id 
      and email = (auth.jwt() ->> 'email')
    )
  );

create policy "Remover membros" on organization_members for delete
  using (exists (select 1 from organizations where id = organization_id and owner_id = auth.uid()));

-- Políticas Invites
create policy "Ver convites" on organization_invites for select
  using (public.is_org_member(organization_id) or email = (auth.jwt() ->> 'email'));
create policy "Criar convites" on organization_invites for insert
  with check (public.is_org_member(organization_id));
create policy "Gerenciar convites" on organization_invites for all
  using (public.is_org_member(organization_id));
`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, 'organization-logos');
      }

      // 1. Criar Organização
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: name,
          cnpj: cnpj,
          logo_url: logoUrl,
          owner_id: currentUser.id
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Adicionar dono como membro admin
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: currentUser.id,
          role: 'admin'
        });

      if (memberError) {
          console.error("Erro ao adicionar membro:", memberError);
      }

      onOrganizationCreated(org);

    } catch (err: any) {
      console.error("Erro ao criar organização:", err);
      setError(err);
      
      if (err.code === '42P01' || err.code === '42501' || err.code === '42P17') {
          setShowSql(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const Content = () => (
    <div className={`w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row ${variant === 'fullscreen' ? 'max-w-5xl min-h-[600px]' : 'max-w-4xl max-h-[90vh]'}`}>
        
        {/* Left Side - Visual */}
        <div className="bg-slate-900 w-full md:w-2/5 p-8 flex flex-col justify-between text-white relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mb-6 border border-white/20 p-1.5">
                    <img src={APP_LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{variant === 'modal' ? 'Nova Empresa' : 'Bem-vindo ao nConstruction'}</h2>
                <p className="text-slate-400">Configure sua empresa ou aceite um convite para começar a gerenciar obras.</p>
            </div>
            
            <div className="relative z-10 mt-auto pt-8">
                <button 
                    type="button" 
                    onClick={() => setShowSql(!showSql)}
                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-lg w-fit border border-white/10"
                >
                    <Database size={14} />
                    {showSql ? 'Voltar ao Formulário' : 'Configuração de Banco de Dados'}
                </button>
            </div>
        </div>

        {/* Right Side - Content */}
        <div className="w-full md:w-3/5 p-8 md:p-12 relative flex flex-col overflow-y-auto">
            {variant === 'modal' && onClose && (
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors z-20">
                    <X size={20} />
                </button>
            )}

            {showSql ? (
                <div className="animate-in fade-in duration-300 h-full flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Setup do Banco de Dados</h3>
                            <p className="text-sm text-slate-500 mt-1">Execute este script no Editor SQL do Supabase.</p>
                        </div>
                        <button 
                            onClick={handleCopySql}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar SQL'}
                        </button>
                    </div>
                    
                    <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-y-auto custom-scrollbar border border-slate-700 max-h-[400px]">
                        <code className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                            {/* SQL content generated in handleCopySql */}
                            -- Clique em "Copiar SQL" para obter o script com a correção de permissão.
                        </code>
                    </div>
                    
                    <button 
                        onClick={() => setShowSql(false)}
                        className="mt-4 text-sm text-slate-500 hover:text-slate-800 underline text-center w-full"
                    >
                        Voltar
                    </button>
                </div>
            ) : (
                <div className="max-w-md mx-auto animate-in fade-in duration-300 flex-1 flex flex-col w-full">
                    {/* INVITES SECTION */}
                    {invites.length > 0 && (
                        <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-3 text-sm">
                                <Mail size={16} /> Você tem convites pendentes!
                            </h4>
                            <div className="space-y-2">
                                {invites.map(invite => (
                                    <div key={invite.id} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                                                {invite.organization?.logo_url ? (
                                                    <img src={invite.organization.logo_url} className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    <Building2 size={20} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{invite.organization?.name || 'Empresa'}</p>
                                                <p className="text-xs text-slate-500">Convidado por {invite.invited_by || 'Admin'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleAcceptInvite(invite)}
                                            disabled={!!processingInvite}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                        >
                                            {processingInvite === invite.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                            Aceitar
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="my-6 border-b border-slate-200"></div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-slate-800">Criar Nova Empresa</h3>
                        <button onClick={fetchInvites} className="text-slate-400 hover:text-blue-600" title="Atualizar convites"><RefreshCcw size={16} /></button>
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100 mb-6 flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <span className="font-bold">Erro:</span>
                            </div>
                            <p className="pl-6 opacity-90 font-mono text-xs bg-white/50 p-2 rounded">
                                {error.message || JSON.stringify(error)}
                            </p>
                            {error.code === '42501' && (
                                <p className="pl-6 text-xs font-bold">
                                    Parece um erro de permissão (RLS). Clique em "Configuração de Banco de Dados" abaixo e copie o script atualizado para corrigir.
                                </p>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                        <div className="flex items-center justify-center">
                            <label className="relative group cursor-pointer">
                                <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:bg-slate-200 transition-colors">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Upload className="text-slate-400" size={24} />
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs font-bold">Alterar Logo</span>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoSelect} />
                            </label>
                        </div>
                        <p className="text-center text-xs text-slate-400">Clique para adicionar a logo da sua empresa</p>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Empresa</label>
                            <input 
                                required
                                type="text" 
                                placeholder="Ex: Construtora Silva & Santos"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">CNPJ (Opcional)</label>
                            <input 
                                type="text" 
                                placeholder="00.000.000/0001-00"
                                value={cnpj}
                                onChange={e => setCnpj(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-70 mt-4"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Criar Empresa <ArrowRight size={20} /></>}
                        </button>
                    </form>
                </div>
            )}
        </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <Content />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 animate-in fade-in duration-500">
      <Content />
    </div>
  );
};
