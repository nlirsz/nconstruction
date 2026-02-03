
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, Check, Building2 } from 'lucide-react';
import { APP_LOGO_URL } from '../constants';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Login error:', err);
      // Garantir que a mensagem seja uma string legível
      let msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      
      // Map specific Supabase errors to user-friendly Portuguese messages
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-xl shadow-slate-300 mb-4 overflow-hidden text-white p-2">
             <img src={APP_LOGO_URL} alt="nConstruction" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">nConstruction</h1>
          <p className="text-slate-500 text-sm">Acesso Restrito</p>
        </div>

        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 mb-4 text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="leading-tight">{error}</span>
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-slate-900 placeholder:text-slate-400"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-slate-900 placeholder:text-slate-400"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
             <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all shadow-sm ${rememberMe ? 'bg-black border-black' : 'bg-white border-slate-300 hover:border-slate-400'}`}>
                  {rememberMe && <Check size={14} className="text-white animate-in zoom-in duration-200" strokeWidth={3} />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">Manter conectado</span>
             </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white rounded-lg font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
