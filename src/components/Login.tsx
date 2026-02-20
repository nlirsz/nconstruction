
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, Check, Building2, UserPlus, LogIn, ShieldAlert } from 'lucide-react';
import { APP_LOGO_URL } from '../constants';
import { GradientBlinds } from './GradientBlinds';

const LOGIN_BG_COLORS = ['#0570FB', '#81E8FF'];

export const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const formEmail = (formData.get('email') as string) || email;
    const formPassword = (formData.get('password') as string) || password;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formEmail,
        password: formPassword,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));

      if (msg.includes('Email not confirmed')) {
        msg = 'Email não confirmado. Verifique sua caixa de entrada ou contate o administrador.';
      } else if (msg.includes('Invalid login credentials')) {
        msg = 'Email ou senha incorretos.';
      } else if (msg.includes('Too many requests')) {
        msg = 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    try {
      // 1. Verificar se o e-mail tem permissão na tabela unit_permissions
      const { data: permissions, error: permError } = await supabase
        .from('unit_permissions')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .limit(1);

      if (permError) throw permError;

      if (!permissions || permissions.length === 0) {
        setError('Este e-mail não possui convites pendentes. Entre em contato com a construtora para receber acesso.');
        setLoading(false);
        return;
      }

      // 2. Tentar criar a conta
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: email.split('@')[0], // Fallback name
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.user && data.session) {
        setSuccess('Conta criada com sucesso! Você já está conectado.');
        // O Supabase geralmente loga o usuário após o signup se o email for confirmado ou auto-confirmado.
        // Se houver sessão, o App.tsx cuidará do redirecionamento.
      } else {
        setSuccess('Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.');
        setActiveTab('login');
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      let msg = err.message || String(err);
      if (msg.includes('User already registered')) {
        msg = 'Este e-mail já possui conta cadastrada. Tente fazer login.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 isolate">
      <GradientBlinds
        gradientColors={LOGIN_BG_COLORS}
        angle={0}
        noise={0.3}
        blindCount={12}
        blindMinWidth={50}
        spotlightRadius={0.5}
        spotlightSoftness={1}
        spotlightOpacity={1}
        mouseDampening={0.15}
        distortAmount={0}
        shineDirection="left"
        mixBlendMode="lighten"
      />
      <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 flex flex-col items-center z-10">
        {/* LOGO AREA */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl mb-4 overflow-hidden p-2">
            <img src={APP_LOGO_URL} alt="nConstruction" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">nConstruction</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Gestão Inteligente de Obras</p>
        </div>

        {/* THIN TABS */}
        <div className="w-full grid grid-cols-2 bg-slate-100/50 p-1 rounded-2xl mb-8">
          <button
            onClick={() => { setActiveTab('login'); setError(null); setSuccess(null); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'login' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LogIn size={14} />
            Entrar
          </button>
          <button
            onClick={() => { setActiveTab('signup'); setError(null); setSuccess(null); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'signup' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <UserPlus size={14} />
            Primeiro Acesso
          </button>
        </div>

        {/* FEEDBACK MESSAGES */}
        {error && (
          <div className="w-full bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-start gap-3 mb-6 text-xs border border-rose-100 animate-in fade-in slide-in-from-top-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span className="font-bold leading-tight">{error}</span>
          </div>
        )}

        {success && (
          <div className="w-full bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex items-start gap-3 mb-6 text-xs border border-emerald-100 animate-in fade-in slide-in-from-top-2">
            <Check size={16} className="shrink-0" />
            <span className="font-bold leading-tight">{success}</span>
          </div>
        )}

        {/* FORMS */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail de Acesso</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white focus:border-slate-900 outline-none transition-all text-sm text-slate-900 placeholder:text-slate-300 font-bold"
                placeholder="seu@e-mail.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white focus:border-slate-900 outline-none transition-all text-sm text-slate-900 placeholder:text-slate-300 font-bold"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                  {rememberMe && <Check size={12} strokeWidth={4} className="text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors">Permanecer conectado</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 flex items-center justify-center gap-3 transition-all disabled:opacity-50 mt-6"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Entrar na Plataforma'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFirstAccess} className="w-full space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-2">
              <p className="text-[10px] text-slate-500 font-bold leading-normal">
                Se você recebeu um convite da sua construtora, informe seu e-mail e crie sua senha abaixo para ativar seu acesso.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu E-mail</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white focus:border-slate-900 outline-none transition-all text-sm text-slate-900 placeholder:text-slate-300 font-bold"
                placeholder="seu@e-mail.com"
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Definir Senha</label>
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white focus:border-slate-900 outline-none transition-all text-sm text-slate-900 placeholder:text-slate-300 font-bold"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
                <input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white focus:border-slate-900 outline-none transition-all text-sm text-slate-900 placeholder:text-slate-300 font-bold"
                  placeholder="Repita a senha"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 flex items-center justify-center gap-3 transition-all disabled:opacity-50 mt-6"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Ativar e Acessar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
