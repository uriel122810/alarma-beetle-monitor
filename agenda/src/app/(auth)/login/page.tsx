'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PazSumaLogin() {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly'
          ].join(' '),
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f4f1ea] font-sans selection:bg-[#b39656] selection:text-white">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 w-full max-w-md shadow-xl shadow-black/5 relative overflow-hidden">
        {/* Adorno superior dorado */}
        <div className="absolute top-0 left-0 w-full h-2 bg-[#b39656]"></div>

        <div className="text-center mb-10 mt-2 flex flex-col items-center">
          <div className="flex flex-col mb-4">
            <h1 className="text-4xl font-extrabold text-[#6b1c35] tracking-tight leading-none">
              PazSuma
            </h1>
            <span className="text-[#b39656] text-xs font-bold tracking-[0.2em] uppercase mt-2">
              Sistema Institucional
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-xs">
            Acceso seguro y centralizado para la administración operativa.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="group relative w-full flex items-center gap-4 bg-white px-6 py-4 rounded-xl border-2 border-[#b39656] shadow-lg shadow-[#b39656]/10 hover:shadow-[#b39656]/30 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {/* Efecto Hover Background */}
          <div className="absolute inset-0 bg-[#f4f1ea] transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
          
          <div className="relative z-10 flex items-center justify-center bg-white p-2 rounded-full border border-slate-100 shadow-sm">
            {loading ? (
              <Loader2 className="animate-spin text-[#6b1c35]" size={24} />
            ) : (
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
          </div>
          <span className="relative z-10 font-bold text-[#6b1c35] text-sm tracking-wide">
            Conectar Identidad Institucional
          </span>
        </button>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-[11px] text-slate-400 font-medium">
            Uso exclusivo para el personal autorizado. Todo acceso queda registrado por seguridad.
          </p>
        </div>
      </div>
    </div>
  );
}
