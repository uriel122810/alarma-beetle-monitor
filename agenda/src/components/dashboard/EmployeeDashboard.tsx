'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, CalendarDays, ChevronRight, Loader2 } from 'lucide-react';
import { formatDateTime, getProgressColor } from '@/lib/utils';
import type { Task, Meeting } from '@/types/database.types';

interface EmployeeData {
  tasks: Task[];
  meetings: Meeting[];
}

export default function EmployeeDashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd   = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const [tasksRes, meetingsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch(`/api/meetings?from=${todayStart}&to=${todayEnd}`),
      ]);

      const [{ tasks }, { meetings }] = await Promise.all([
        tasksRes.json(),
        meetingsRes.json(),
      ]);

      setData({ tasks: tasks ?? [], meetings: meetings ?? [] });
      setLoading(false);
    }
    load();
  }, []);

  async function toggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'completed' ? 'in_progress' : 'completed';
    setUpdating(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t
            ),
          };
        });
      }
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  const tasks = data?.tasks ?? [];
  const meetings = data?.meetings ?? [];
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const completionPct = Math.round((completedCount / Math.max(tasks.length, 1)) * 100);
  const progressColor = getProgressColor(completionPct);

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          Buenos días, <span className="text-violet-400">{userName.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Checklist de Tareas */}
        <div className="xl:col-span-2 space-y-5">

          {/* Progress Header */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-300">Mi progreso de hoy</span>
              <span className="text-sm font-bold" style={{ color: progressColor }}>
                {completedCount}/{tasks.length} tareas
              </span>
            </div>
            <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%`, backgroundColor: progressColor }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">{completionPct}% completado</p>
          </div>

          {/* Tareas Pendientes */}
          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <h2 className="text-base font-bold text-white">Tareas Pendientes</h2>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">
                {pendingTasks.length}
              </span>
            </div>
            <div className="divide-y divide-white/4">
              {pendingTasks.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2 opacity-60" />
                  <p className="text-slate-400 text-sm">¡Todo al día! No tienes tareas pendientes.</p>
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-4 px-5 py-4 group hover:bg-white/3 transition-colors">
                    <button
                      id={`btn-task-${task.id}`}
                      onClick={() => toggleTask(task.id, task.status)}
                      disabled={updating === task.id}
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-slate-500 hover:border-violet-400 transition-colors flex items-center justify-center"
                    >
                      {updating === task.id
                        ? <Loader2 size={10} className="animate-spin text-violet-400" />
                        : <Circle size={10} className="text-transparent group-hover:text-violet-400 transition-colors" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {task.due_date && (
                          <span className="text-xs text-slate-500">
                            📅 {new Date(task.due_date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          task.status === 'in_progress'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                        }`}>
                          {task.status === 'in_progress' ? 'En progreso' : 'Pendiente'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          task.priority === 'critical' ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
                          task.priority === 'high' ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20' :
                          'text-slate-500 bg-white/5 border border-white/8'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors mt-1 flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tareas Completadas */}
          {completedTasks.length > 0 && (
            <div className="rounded-2xl bg-white/3 border border-white/6 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <h2 className="text-base font-bold text-slate-300">Completadas</h2>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
                  {completedTasks.length}
                </span>
              </div>
              <div className="divide-y divide-white/3">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 px-5 py-3.5 opacity-60 hover:opacity-80 transition-opacity">
                    <button
                      onClick={() => toggleTask(task.id, task.status)}
                      className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center"
                    >
                      <CheckCircle2 size={10} className="text-emerald-400" />
                    </button>
                    <p className="text-sm text-slate-400 line-through">{task.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agenda del Día */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <CalendarDays size={16} className="text-violet-400" />
            <h2 className="text-base font-bold text-white">Agenda de Hoy</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium">
              {meetings.length}
            </span>
          </div>
          <div className="divide-y divide-white/4">
            {meetings.length === 0 ? (
              <div className="py-10 text-center px-5">
                <CalendarDays size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-slate-400 text-sm">No tienes reuniones programadas para hoy.</p>
              </div>
            ) : (
              meetings.map((meeting) => (
                <div key={meeting.id} className="px-5 py-4 hover:bg-white/3 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-violet-400 mt-1.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{meeting.title}</p>
                      <p className="text-xs text-violet-400 mt-0.5">
                        {formatDateTime(meeting.start_time)}
                      </p>
                      {meeting.location && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">📍 {meeting.location}</p>
                      )}
                      {meeting.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{meeting.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
