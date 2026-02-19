import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Project, LevelConfig, UnitPermission, UserProfile } from '../types';
import { Users, Mail, UserPlus, Trash2, ShieldCheck, CheckCircle2, XCircle, Info, ChevronRight, LayoutGrid, Building2, Car, Warehouse, Coffee, AlertCircle } from 'lucide-react';

interface ClientManagementProps {
    project: Project;
    levels: LevelConfig[];
}

export const ClientManagement: React.FC<ClientManagementProps> = ({ project, levels }) => {
    const [inviteEmails, setInviteEmails] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [role, setRole] = useState<'client' | 'architect'>('client');
    const [jobTitle, setJobTitle] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [commonAreas, setCommonAreas] = useState<string[]>([]);
    const [permissions, setPermissions] = useState<UnitPermission[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    // Áreas comuns disponíveis baseadas nos tipos de níveis
    const commonAreaOptions = [
        { id: 'foundation', label: 'Fundação', icon: <Warehouse size={14} /> },
        { id: 'hall', label: 'Hall de Entrada', icon: <Coffee size={14} /> },
        { id: 'garage', label: 'Garagem / Estacionamento', icon: <Car size={14} /> },
        { id: 'circulation', label: 'Circulação e Escadas', icon: <LayoutGrid size={14} /> },
        { id: 'leisure', label: 'Lazer e Convivência', icon: <Building2 size={14} /> },
    ];

    useEffect(() => {
        fetchPermissions();
        checkUserRole();
    }, [project.id]);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Se é o dono do projeto
        if (project.user_id === user.id) {
            setCurrentUserRole('owner');
            return;
        }

        // Se é membro da organização
        if (project.organization_id) {
            const { data: orgMember } = await supabase
                .from('organization_members')
                .select('role')
                .eq('organization_id', project.organization_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (orgMember) {
                setCurrentUserRole('staff');
                return;
            }
        }

        // Se tem permissão de admin nas unidades
        const { data: unitPerm } = await supabase
            .from('unit_permissions')
            .select('role')
            .eq('project_id', project.id)
            .eq('user_id', user.id)
            .maybeSingle();

        setCurrentUserRole(unitPerm?.role || 'guest');
    };

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('unit_permissions')
                .select('*, unit:project_units(name, type)')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPermissions(data || []);
        } catch (error) {
            console.error('Erro ao buscar permissões:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleArea = (id: string) => {
        setCommonAreas(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleBulkInvite = async () => {
        if (!inviteEmails.trim() || !selectedUnitId) {
            alert('Por favor, insira os e-mails e selecione uma unidade.');
            return;
        }

        setSaving(true);
        const emails = inviteEmails
            .split(/[\n,;]/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e.length > 0 && e.includes('@'));

        const uniqueEmails = [...new Set(emails)];

        if (uniqueEmails.length === 0) {
            alert('Nenhum e-mail válido encontrado.');
            setSaving(false);
            return;
        }

        try {
            // 1. Criar os registros na tabela unit_permissions
            const payload = uniqueEmails.map(email => ({
                project_id: project.id,
                email: email,
                unit_id: selectedUnitId,
                role: role,
                job_title: jobTitle,
                phone: phone,
                notes: notes,
                common_areas: commonAreas,
                is_active: true
            }));

            const { error } = await supabase.from('unit_permissions').upsert(payload, { onConflict: 'project_id, unit_id, email' });

            if (error) throw error;

            // 2. Limpar formulário e recarregar
            setInviteEmails('');
            setJobTitle('');
            setPhone('');
            setNotes('');
            setCommonAreas([]);
            fetchPermissions();
            alert(`${uniqueEmails.length} convite(s) processados com sucesso!`);
        } catch (error: any) {
            console.error('Erro no convite:', error);
            alert('Erro ao enviar convites: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePermission = async (id: string) => {
        if (!window.confirm('Remover este acesso?')) return;

        try {
            const { error } = await supabase.from('unit_permissions').delete().eq('id', id);
            if (error) throw error;
            fetchPermissions();
        } catch (error) {
            console.error('Erro ao deletar:', error);
        }
    };

    const handleToggleActive = async (id: string, currentState: boolean) => {
        try {
            const { error } = await supabase
                .from('unit_permissions')
                .update({ is_active: !currentState })
                .eq('id', id);

            if (error) throw error;
            fetchPermissions();
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    };

    // Coleta todas as unidades de todos os níveis para o dropdown
    const allUnits = levels.flatMap(l => l.units.map(u => ({ ...u, levelLabel: l.label })));

    // Se for CLIENTE ou ARQUITETO, não pode ver a parte de adicionar pessoas
    const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'staff' || currentUserRole === 'admin';

    if (currentUserRole && !canManageTeam) {
        return (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <ShieldCheck size={40} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Acesso Restrito</h3>
                <p className="text-xs text-slate-500 mt-2">Somente administradores da obra podem gerenciar acessos de clientes e arquitetos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* HEADER INFORMATIVO */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4 items-start">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <ShieldCheck size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-blue-900">Acesso Externo (Clientes e Arquitetos)</h4>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        Convide proprietários e arquitetos. Eles terão visão simplificada e **somente leitura**.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* COLUNA DE CONVITE */}
                <div className="lg:col-span-1 space-y-5">
                    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <UserPlus size={14} className="text-slate-400" />
                            Novo Acesso
                        </h3>

                        <div className="space-y-4">
                            {/* E-MAILS */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase">E-mails (um por linha ou vírgula)</label>
                                <textarea
                                    value={inviteEmails}
                                    onChange={(e) => setInviteEmails(e.target.value)}
                                    placeholder="exemplo@email.com"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs min-h-[80px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase">Cargo / Função</label>
                                    <input
                                        type="text"
                                        value={jobTitle}
                                        onChange={e => setJobTitle(e.target.value)}
                                        placeholder="Ex: Proprietário"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase">Telefone</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="(99) 99999-9999"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                                    />
                                </div>
                            </div>

                            {/* UNIDADE */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Unidade Vinculada</label>
                                <select
                                    value={selectedUnitId}
                                    onChange={(e) => setSelectedUnitId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">Selecione a Unidade...</option>
                                    {allUnits.length > 0 ? (
                                        allUnits.filter(u => u.type === 'unit' || u.type === 'commercial' || !u.type).length > 0 ? (
                                            allUnits.filter(u => u.type === 'unit' || u.type === 'commercial' || !u.type).map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.levelLabel})</option>
                                            ))
                                        ) : (
                                            allUnits.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.levelLabel})</option>
                                            ))
                                        )
                                    ) : (
                                        <option disabled>Nenhuma unidade encontrada na estrutura</option>
                                    )}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Observações Internas</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ex: Esposa do Sr. João"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                                />
                            </div>

                            {/* ROLE */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Tipo de Perfil</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setRole('client')}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${role === 'client' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Cliente / Morador
                                    </button>
                                    <button
                                        onClick={() => setRole('architect')}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${role === 'architect' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Arquiteto
                                    </button>
                                </div>
                            </div>

                            {/* ÁREAS COMUNS */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Acesso a Áreas Comuns</label>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {commonAreaOptions.map(area => (
                                        <div
                                            key={area.id}
                                            onClick={() => handleToggleArea(area.id)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${commonAreas.includes(area.id) ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                                        >
                                            <div className={commonAreas.includes(area.id) ? 'text-blue-600' : 'text-slate-400'}>
                                                {area.icon}
                                            </div>
                                            <span className={`text-[10px] font-bold ${commonAreas.includes(area.id) ? 'text-blue-900' : 'text-slate-600'}`}>{area.label}</span>
                                            <div className={`ml-auto w-4 h-4 rounded border flex items-center justify-center ${commonAreas.includes(area.id) ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                                                {commonAreas.includes(area.id) && <ChevronRight size={10} className="text-white" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleBulkInvite}
                                disabled={saving}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <AlertCircle size={14} className="animate-spin" /> : <Mail size={14} />}
                                Enviar Convites
                            </button>
                        </div>
                    </section>
                </div>

                {/* LISTA DE PERMISSÕES */}
                <div className="lg:col-span-2">
                    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Users size={14} className="text-slate-400" />
                                Usuários com Acesso Externo
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">{permissions.length}</span>
                        </header>

                        <div className="divide-y divide-slate-100">
                            {loading ? (
                                <div className="p-10 text-center">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Carregando acessos...</p>
                                </div>
                            ) : permissions.length === 0 ? (
                                <div className="p-10 text-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <Users size={20} className="text-slate-300" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                                        Nenhum cliente ou arquiteto <br /> convidado para este projeto.
                                    </p>
                                </div>
                            ) : (
                                permissions.map(perm => (
                                    <div key={perm.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-colors ${!perm.is_active ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                                        <div className="flex gap-4 items-center">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${perm.role === 'client' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-purple-50 border-purple-100 text-purple-600'}`}>
                                                {perm.role === 'client' ? <Users size={18} /> : <Warehouse size={18} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-black text-slate-800">{perm.email}</p>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${perm.role === 'client' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                                                        {perm.role === 'client' ? 'Cliente' : 'Arquiteto'}
                                                    </span>
                                                    {perm.job_title && (
                                                        <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                            {perm.job_title}
                                                        </span>
                                                    )}
                                                    {!perm.user_id && (
                                                        <span className="text-[8px] font-black uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            <Info size={8} /> Pendente
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <LayoutGrid size={10} className="text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Unidade {(perm as any).unit?.name || '---'}</span>
                                                    </div>
                                                    {perm.phone && (
                                                        <div className="flex items-center gap-1">
                                                            <Users size={10} className="text-slate-400" />
                                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{perm.phone}</span>
                                                        </div>
                                                    )}
                                                    {perm.common_areas && perm.common_areas.length > 0 && (
                                                        <div className="flex items-center gap-1">
                                                            <ShieldCheck size={10} className="text-slate-400" />
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                                +{perm.common_areas.length} áreas comuns
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                {perm.notes && (
                                                    <p className="text-[9px] text-slate-400 font-medium mt-1 italic">"{perm.notes}"</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 ml-auto md:ml-0">
                                            <button
                                                onClick={() => handleToggleActive(perm.id, perm.is_active)}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border ${perm.is_active ? 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50' : 'bg-slate-200 text-slate-500 border-slate-300'}`}
                                            >
                                                {perm.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                {perm.is_active ? 'Ativo' : 'Pausado'}
                                            </button>
                                            <button
                                                onClick={() => handleDeletePermission(perm.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
