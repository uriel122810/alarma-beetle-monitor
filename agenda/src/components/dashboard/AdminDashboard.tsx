'use client';

import { CheckCircle, Clock, Mail, Calendar, BarChart3, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

const mockData = [
  { name: 'Finanzas', completadas: 45, pendientes: 12 },
  { name: 'Obras Públicas', completadas: 30, pendientes: 25 },
  { name: 'Recursos Humanos', completadas: 60, pendientes: 5 },
];

export default function PazSumaDashboard() {
  const [sending, setSending] = useState(false);

  const triggerBulkEmail = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'equipo@ejemplo.com', // Reemplazar con destinatario real
          subject: 'Actualización PazSuma - Tareas Pendientes',
          message: '<p>Este es un correo automático del sistema PazSuma.</p>'
        })
      });
      if (!res.ok) throw new Error('Error al enviar masivos');
      alert('¡Correos enviados exitosamente!');
    } catch (error) {
      alert('Error en el envío. Revisa la consola para más detalles.');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">PazSuma - Panel de Control</h1>
          <p className="text-slate-500 mt-1">Sistema Integrado de Gestión - La Paz</p>
        </div>
        <button 
          onClick={triggerBulkEmail}
          disabled={sending}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Mail size={18} />
          {sending ? 'Enviando...' : 'Notificación Masiva'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle size={24} /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Checklists Completados</p>
            <p className="text-2xl font-bold text-slate-900">135 <span className="text-sm font-normal text-slate-400">/ 177</span></p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Calendar size={24} /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Reuniones de Hoy</p>
            <p className="text-2xl font-bold text-slate-900">8</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Zap size={24} /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Correos Enviados</p>
            <p className="text-2xl font-bold text-slate-900">1,204</p>
          </div>
        </div>
      </div>

      {/* Gráfica de Progreso */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <BarChart3 size={20} className="text-slate-400"/>
          Progreso de Checklists por Departamento
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Bar dataKey="completadas" name="Completadas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="pendientes" name="Pendientes" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
