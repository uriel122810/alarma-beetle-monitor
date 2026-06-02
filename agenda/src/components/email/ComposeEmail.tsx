'use client';

import { useState } from 'react';
import { Send, Paperclip, X, Loader2, CheckCircle2 } from 'lucide-react';

export default function ComposeEmail() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    setStatus('sending');
    try {
      const htmlBody = `<div style="font-family:sans-serif;line-height:1.6">${body.replace(/\n/g, '<br/>')}</div>`;
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.split(',').map((e) => e.trim()).filter(Boolean),
          subject,
          htmlBody,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Error al enviar');
      }

      setStatus('sent');
      setTimeout(() => {
        setTo(''); setSubject(''); setBody(''); setStatus('idle');
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Redactar Correo</h1>
          <p className="text-slate-400 text-sm mt-1">El correo se enviará desde tu cuenta de Gmail conectada.</p>
        </div>

        <form onSubmit={handleSend} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
          {/* Para */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <span className="text-sm text-slate-500 w-16 flex-shrink-0">Para:</span>
            <input
              id="email-to"
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinatario@empresa.com, otro@empresa.com"
              className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-600 focus:outline-none"
              required
            />
          </div>

          {/* Asunto */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <span className="text-sm text-slate-500 w-16 flex-shrink-0">Asunto:</span>
            <input
              id="email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del correo..."
              className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-600 focus:outline-none"
              required
            />
          </div>

          {/* Cuerpo */}
          <div className="px-6 py-4">
            <textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={12}
              className="w-full bg-transparent border-none text-sm text-white placeholder-slate-600 focus:outline-none resize-none"
              required
            />
          </div>

          {/* Footer con acciones */}
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <button type="button" className="flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm transition-colors">
              <Paperclip size={15} />
              Adjuntar
            </button>

            <div className="flex items-center gap-3">
              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <X size={14} />
                  {errorMsg}
                </div>
              )}
              {status === 'sent' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 size={14} />
                  ¡Enviado!
                </div>
              )}
              <button
                id="btn-send-email"
                type="submit"
                disabled={status === 'sending' || status === 'sent'}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
              >
                {status === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {status === 'sending' ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
