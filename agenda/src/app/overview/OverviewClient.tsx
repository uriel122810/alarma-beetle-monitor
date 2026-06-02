'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  CheckCircle2, CalendarDays, Search, UserCircle,
  Clock, LogOut, Plus, LayoutDashboard,
  Users, Mail, ChevronRight, Settings, ChevronDown,
  Sun, Moon, Paperclip, Send, Loader2, X,
  ChevronLeft, Shield, Trash2, UserPlus, Globe, Lock,
  Bell, FileText, Image as ImageIcon
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ChecklistStatus  = 'pendiente' | 'en_progreso' | 'completado';
type UserRole         = 'administrador' | 'empleado';
type Visibility       = 'personal' | 'compartido' | 'global';

interface Checklist {
  id: string;
  titulo: string;
  descripcion: string | null;
  estatus: ChecklistStatus;
  creador_email: string;
  compartido_con: string[];
  visibilidad: Visibility | null;
  fecha_limite: string | null;
  creado_en: string;
}

interface AgendaEvent {
  id: string;
  fecha_hora: string;
  titulo: string;
  descripcion: string | null;
  creador_email: string;
  visibilidad?: Visibility | null;
  compartido_con?: string[];
  isExternal?: boolean;
}

interface ContactUser {
  id?: string;
  name: string | null;
  email: string | null;
  role?: UserRole;
}

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  pendiente:  'Pendiente',
  en_progreso:'Trabajando',
  completado: 'Completado',
};
const STATUS_OPTIONS: ChecklistStatus[] = ['pendiente', 'en_progreso', 'completado'];
const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ─── Theme Tokens ─────────────────────────────────────────────────────────────
const LIGHT = {
  bg: 'bg-[#f4f1ea]', text: 'text-slate-800',
  sidebarBg: 'bg-slate-900',
  headerBg: 'bg-white', headerBorder: 'border-slate-200',
  cardBg: 'bg-white', cardBorder: 'border-slate-200',
  mutedText: 'text-slate-500', searchBg: 'bg-slate-100',
  calCell: 'bg-white', calOther: 'bg-slate-50',
  calHdr: 'bg-[#f9f9f9]', calHover: 'hover:bg-amber-50',
  tableTh: 'bg-[#f4f1ea]', tableHover: 'hover:bg-[#f4f1ea]',
};
const DARK = {
  bg: 'bg-slate-950', text: 'text-slate-100',
  sidebarBg: 'bg-slate-950',
  headerBg: 'bg-slate-900', headerBorder: 'border-slate-800',
  cardBg: 'bg-slate-900', cardBorder: 'border-slate-800',
  mutedText: 'text-slate-400', searchBg: 'bg-slate-800',
  calCell: 'bg-slate-900', calOther: 'bg-slate-950/70',
  calHdr: 'bg-slate-800', calHover: 'hover:bg-slate-800/60',
  tableTh: 'bg-slate-800', tableHover: 'hover:bg-slate-800/50',
};

const INPUT = 'w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-black placeholder-slate-400 focus:outline-none focus:border-[#581c2f] focus:ring-1 focus:ring-[#581c2f] transition-all';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  user: any;
  userRole: UserRole;
  userName: string;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function OverviewClient({ user, userRole, userName }: Props) {
  const router   = useRouter();
  const supabase = createSupabaseBrowserClient();
  const settingsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === 'administrador';
  const userEmail = user?.email;

  // ── UI
  const [isDark, setIsDark] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen]   = useState(false);
  const [isDropdownOpen, setIsDropdownOpen]   = useState(false);
  const [currentView, setCurrentView]         = useState('pipelines');
  const [notificationCount, setNotificationCount] = useState(0);

  // ── Modals
  const [isEventModalOpen,      setIsEventModalOpen]      = useState(false);
  const [isProjectModalOpen,    setIsProjectModalOpen]    = useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [isShareModalOpen,      setIsShareModalOpen]      = useState(false);
  const [isShareEventModalOpen, setIsShareEventModalOpen] = useState(false);
  
  // ── Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'checklist' | 'agenda', title: string } | null>(null);

  // ── Data
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [agenda,     setAgenda]     = useState<AgendaEvent[]>([]);
  const [contacts,   setContacts]   = useState<ContactUser[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  // ── Event Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate,  setEventDate]  = useState('');
  const [eventType,  setEventType]  = useState('Reunión');
  const [eventGuests, setEventGuests] = useState('');
  const [showGuests,  setShowGuests]  = useState(false);
  const [eventVisibility, setEventVisibility] = useState<Visibility>('personal');
  const [eventShareEmail, setEventShareEmail] = useState<string>(''); // Seleccionado
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  
  const [eventToShare, setEventToShare] = useState<AgendaEvent | null>(null);

  // ── Project Form & Share Form
  const [projectTitle,      setProjectTitle]      = useState('');
  const [projectDesc,       setProjectDesc]       = useState('');
  const [projectVisibility, setProjectVisibility] = useState<Visibility>('personal');
  const [shareWithEmail,    setShareWithEmail]    = useState<string>(''); // Seleccionado
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  
  const [projectToShare, setProjectToShare] = useState<Checklist | null>(null);

  // ── Contact Form (admin only)
  const [contactEmail, setContactEmail] = useState('');
  const [contactName,  setContactName]  = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // ── Email Composer (Mensajes)
  const [emailTo,      setEmailTo]      = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailFiles,   setEmailFiles]   = useState<File[]>([]);
  const [emailStatus,  setEmailStatus]  = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError,   setEmailError]   = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Calendar navigation
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const t = isDark ? DARK : LIGHT;

  // ─── Outside click handler ────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setIsSettingsOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ─── Gmail Redirection ─────────────────────────────────────────────────────
  const handleOpenGmail = () => {
    setNotificationCount(0);
    if (userEmail) {
      window.open(`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(userEmail)}`, '_blank');
    } else {
      window.open('https://mail.google.com', '_blank');
    }
  };

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const { data, error } = await supabase.from('users').select('name, email');
      if (error) throw error;
      if (data) {
        setContacts(data as ContactUser[]);
      }
    } catch (err) {
      console.error("Error al cargar contactos:", err);
    } finally {
      setIsLoadingContacts(false);
    }
  }, [supabase]);

  const fetchChecklists = useCallback(async () => {
    if (!userEmail) return;
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .order('creado_en', { ascending: false });

    if (data) {
      // Filtrar a nivel de JS como lo solicitó el usuario y actualizar estado
      const proyectosFiltrados = data.filter(item => 
        item.creador_email === userEmail || 
        item.visibilidad === 'global' || 
        (item.compartido_con && item.compartido_con.includes(userEmail))
      );
      setChecklists(proyectosFiltrados as Checklist[]);
    }
  }, [supabase, userEmail]);

  const fetchAgenda = useCallback(async () => {
    if (!userEmail) return;
    
    // 1. Fetch from Supabase (Local)
    const { data: localData } = await supabase
      .from('agenda')
      .select('*')
      .order('fecha_hora', { ascending: true });
      
    // Filter local data immediately to match the user's logic requirements
    const localFiltered = (localData || []).filter(item => 
      item.creador_email === userEmail || 
      item.visibilidad === 'global' || 
      (item.compartido_con && item.compartido_con.includes(userEmail))
    ) as AgendaEvent[];

    // 2. Fetch from Google Calendar (External)
    let externalData: AgendaEvent[] = [];
    try {
      const res = await fetch('/api/calendar');
      if (res.ok) {
        const { items } = await res.json();
        if (items) {
          externalData = items.map((item: any) => ({
            id: item.id,
            fecha_hora: item.start.dateTime || item.start.date,
            titulo: item.summary || 'Evento Externo',
            descripcion: item.description || null,
            creador_email: 'external',
            isExternal: true,
            visibilidad: 'personal'
          }));
        }
      }
    } catch (e) {
      console.error('Error fetching external calendar events', e);
    }

    const combined = [...localFiltered, ...externalData].sort(
      (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
    );

    setAgenda(combined);
  }, [supabase, userEmail]);

  useEffect(() => {
    fetchContacts();
    fetchChecklists();
    fetchAgenda();

    // Supabase Realtime for instant synchronization across clients
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, () => {
        fetchChecklists();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda' }, () => {
        fetchAgenda();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContacts, fetchChecklists, fetchAgenda, supabase]);

  // ─── Checklists ───────────────────────────────────────────────────────────
  const handleUpdateStatus = async (id: string, newStatus: ChecklistStatus) => {
    setChecklists(prev => prev.map(c => c.id === id ? { ...c, estatus: newStatus } : c));
    const { error } = await supabase.from('checklists').update({ estatus: newStatus }).eq('id', id);
    if (error) { console.error(error); fetchChecklists(); }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) return;

    if (!userEmail) {
      alert('No se detectó una sesión activa.');
      return;
    }

    const payload = {
      titulo: projectTitle,
      descripcion: projectDesc || "",
      creador_email: userEmail,
      visibilidad: projectVisibility,
      compartido_con: projectVisibility === 'compartido' && shareWithEmail ? [shareWithEmail] : [],
      estatus: 'pendiente'
    };

    setIsSubmittingProject(true);
    try {
      const { data, error } = await supabase
        .from('checklists')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("Error completo de Supabase:", error);
        alert("Error al crear proyecto: " + error.message);
        return;
      }
      
      if (data) {
        setChecklists(prev => [data as Checklist, ...prev]);
        setIsProjectModalOpen(false);
        resetProjectForm();
      }
    } catch (err: any) {
      alert(`Error inesperado: ${err.message}`);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleUpdateProjectVisibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToShare || !userEmail) return;
    setIsSubmittingProject(true);
    try {
      const { error } = await supabase.from('checklists').update({
        visibilidad: projectVisibility,
        compartido_con: projectVisibility === 'compartido' && shareWithEmail ? [shareWithEmail] : [],
      }).eq('id', projectToShare.id);

      if (error) throw error;

      await fetchChecklists();
      setIsShareModalOpen(false);
      setProjectToShare(null);
      resetProjectForm();
    } catch (err: any) {
      alert(`Error al actualizar privacidad: ${err.message}`);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const openShareModal = (project: Checklist) => {
    setProjectToShare(project);
    setProjectVisibility(project.visibilidad || 'personal');
    setShareWithEmail((project.compartido_con && project.compartido_con[0]) || '');
    setIsShareModalOpen(true);
  };

  const resetProjectForm = () => {
    setProjectTitle(''); setProjectDesc('');
    setProjectVisibility('personal'); setShareWithEmail('');
  };

  // ─── Agenda ───────────────────────────────────────────────────────────────
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) { alert('Sesión inválida. Vuelve a iniciar sesión.'); return; }
    setIsSubmittingEvent(true);
    try {
      const descParts = [`Tipo: ${eventType}`];
      if (showGuests && eventGuests.trim()) descParts.push(`Invitados: ${eventGuests.trim()}`);
      
      const fullDesc = descParts.join(' | ');
      const isoDate = new Date(eventDate).toISOString();

      const payload = {
        titulo:         eventTitle,
        descripcion:    fullDesc,
        fecha_hora:     isoDate,
        creador_email:  userEmail,
        visibilidad:    eventVisibility,
        compartido_con: eventVisibility === 'compartido' && eventShareEmail ? [eventShareEmail] : [],
      };

      // 1. Guardar en Supabase local
      const { data, error } = await supabase.from('agenda').insert([payload]).select().single();
      if (error) throw error;
      
      if (data) setAgenda(prev => [...prev, data as AgendaEvent]);

      // 2. Guardar en Google Calendar (External API Sync)
      try {
         await fetch('/api/calendar', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             summary: eventTitle,
             description: fullDesc,
             startDateTime: isoDate,
             endDateTime: new Date(new Date(eventDate).getTime() + 60 * 60 * 1000).toISOString()
           })
         });
      } catch(gError) {
         console.warn('Could not sync to Google Calendar', gError);
      }

      closeEventModal();
    } catch (err: any) {
      alert(`Error al crear evento: ${err.message}`);
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleUpdateEventVisibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventToShare || !userEmail) return;
    setIsSubmittingEvent(true);
    try {
      const { error } = await supabase.from('agenda').update({
        visibilidad: eventVisibility,
        compartido_con: eventVisibility === 'compartido' && eventShareEmail ? [eventShareEmail] : [],
      }).eq('id', eventToShare.id);

      if (error) throw error;

      await fetchAgenda();
      setIsShareEventModalOpen(false);
      setEventToShare(null);
      setEventVisibility('personal');
      setEventShareEmail('');
    } catch (err: any) {
      alert(`Error al actualizar privacidad del evento: ${err.message}`);
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const openShareEventModal = (event: AgendaEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.isExternal) return; // Cannot update privacy of external google events here
    
    setEventToShare(event);
    setEventVisibility(event.visibilidad || 'personal');
    setEventShareEmail((event.compartido_con && event.compartido_con[0]) || '');
    setIsShareEventModalOpen(true);
  };

  const closeEventModal = () => {
    setIsEventModalOpen(false);
    setEventTitle(''); setEventDate(''); setEventType('Reunión');
    setEventGuests(''); setShowGuests(false);
    setEventVisibility('personal'); setEventShareEmail('');
  };

  // ─── Deletion Logic ───────────────────────────────────────────────────────
  const openDeleteModal = (id: string, type: 'checklist' | 'agenda', title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete({ id, type, title });
    setIsDeleteModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    
    try {
      if (type === 'checklist') {
        setChecklists(prev => prev.filter(c => c.id !== id));
        const { error } = await supabase.from('checklists').delete().eq('id', id);
        if (error) throw error;
      } else if (type === 'agenda') {
        setAgenda(prev => prev.filter(a => a.id !== id));
        const { error } = await supabase.from('agenda').delete().eq('id', id);
        if (error) throw error;
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
      if (type === 'checklist') fetchChecklists();
      if (type === 'agenda') fetchAgenda();
    } finally {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  // ─── Contacts (Admin only) ────────────────────────────────────────────────
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmittingContact(true);
    try {
      const { error } = await supabase.from('users').insert({
        id:    crypto.randomUUID(),
        name:  contactName,
        email: contactEmail,
        role:  'empleado',
      });
      if (error) throw error;
      await fetchContacts();
      setIsAddContactModalOpen(false);
      setContactEmail(''); setContactName('');
    } catch (err: any) {
      alert(`Error al agregar contacto: ${err.message}`);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('¿Eliminar este contacto del sistema?')) return;
    await supabase.from('users').delete().eq('id', id);
    await fetchContacts();
  };

  // ─── Email — Attachments & Send (FormData) ────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEmailFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setEmailFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo.trim() || !emailSubject.trim() || !emailMessage.trim()) {
      setEmailError('Completa todos los campos requeridos.');
      setEmailStatus('error');
      return;
    }
    setEmailStatus('sending');
    setEmailError('');
    setUploadProgress(0);

    try {
      if (emailFiles.length > 0) {
        for (let i = 1; i <= 10; i++) {
          await new Promise(r => setTimeout(r, 80));
          setUploadProgress(i * 10);
        }
      }

      const messageHtml = `<div style="font-family:sans-serif;line-height:1.6">${emailMessage.replace(/\n/g, '<br/>')}</div>`;

      const formData = new FormData();
      const recipients = emailTo.split(',').map(s => s.trim()).filter(Boolean);
      recipients.forEach(r => formData.append('to', r));
      formData.append('subject', emailSubject);
      formData.append('message', messageHtml);
      emailFiles.forEach(file => formData.append('attachments', file));

      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al enviar (backend rechazo)');
      }

      setEmailStatus('sent');
      // Incrementar notificación visual de éxito
      setNotificationCount(prev => prev + 1);

      setTimeout(() => {
        setEmailTo(''); setEmailSubject(''); setEmailMessage('');
        setEmailFiles([]); setEmailStatus('idle'); setUploadProgress(0);
      }, 3000);
    } catch (err: any) {
      setEmailError(err.message);
      setEmailStatus('error');
    }
  };

  // ─── Calendar Grid ────────────────────────────────────────────────────────
  const buildCalendar = () => {
    const firstDay   = new Date(calYear, calMonth, 1).getDay();
    const offset     = firstDay === 0 ? 6 : firstDay - 1; // Mon-first grid
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++)       cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    const rem = (Math.ceil(cells.length / 7) * 7) - cells.length;
    for (let i = 0; i < rem; i++)          cells.push(null);
    return cells;
  };

  const eventsOnDay = (date: Date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // Now filtering agenda local array directly since it's already properly populated
    return agenda.filter(ev => ev.fecha_hora.startsWith(key));
  };

  const handleDayClick = (date: Date) => {
    const off = date.getTimezoneOffset() * 60000;
    setEventDate(new Date(date.getTime() - off).toISOString().slice(0, 16));
    setIsEventModalOpen(true);
  };

  const monthLabel = new Date(calYear, calMonth).toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  // ─── Kanban Column ────────────────────────────────────────────────────────
  const KanbanColumn = ({ status, accent }: { status: ChecklistStatus; accent: string }) => {
    // We filter checklists directly, since fetchChecklists filters state upfront!
    const items = checklists.filter(c => c.estatus === status);
    return (
      <div className={`${t.cardBg} border ${t.cardBorder} border-t-[3px] ${accent} rounded-xl shadow-sm flex-1 flex flex-col min-w-[256px]`}>
        <div className={`px-4 py-3 border-b ${t.cardBorder} flex justify-between items-center`}>
          <span className="font-bold text-xs uppercase tracking-widest text-[#6b1c35]">{STATUS_LABELS[status]}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{items.length}</span>
        </div>
        <div className="p-3 flex-1 space-y-3 overflow-y-auto min-h-[280px]">
          {items.map(item => {
            const isOwn    = item.creador_email === userEmail;
            const isGlobal = item.visibilidad === 'global';
            const isShared = item.visibilidad === 'compartido';
            const canManage = isOwn || isAdmin;
            
            return (
              <div key={item.id} className={`${t.cardBg} border ${t.cardBorder} rounded-lg p-4 hover:border-[#b39656] transition-all relative group`}>
                <div className="flex items-start justify-between gap-2 mb-2 pr-12">
                  <p className={`font-bold text-sm leading-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.titulo}</p>
                </div>
                {item.descripcion && <p className={`text-xs mb-3 ${t.mutedText}`}>{item.descripcion}</p>}
                
                <div className="flex items-center justify-between mt-3">
                  <select
                    value={item.estatus}
                    onChange={e => handleUpdateStatus(item.id, e.target.value as ChecklistStatus)}
                    disabled={!canManage && !isGlobal && !isShared}
                    className={`text-xs font-bold px-2 py-1.5 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#581c2f] disabled:opacity-50 disabled:cursor-not-allowed ${
                      item.estatus === 'completado' ? 'bg-[#6b1c35]/10 border-[#6b1c35]/20 text-[#6b1c35]'
                      : item.estatus === 'en_progreso' ? 'bg-[#b39656]/10 border-[#b39656]/20 text-[#b39656]'
                      : isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  
                  {/* Share button */}
                  {canManage && (
                    <button 
                      onClick={() => openShareModal(item)}
                      title="Gestionar Privacidad"
                      className="absolute top-3 right-8 p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-[#b39656]"
                    >
                      {isGlobal ? <Globe size={15} className="text-[#b39656]" /> : 
                       isShared ? <Users size={15} className="text-[#b39656]" /> : 
                       <Lock size={15} />}
                    </button>
                  )}
                  
                  {/* Delete button */}
                  {canManage && (
                    <button 
                      onClick={(e) => openDeleteModal(item.id, 'checklist', item.titulo, e)}
                      title="Eliminar Proyecto"
                      className="absolute top-3 right-2 p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors text-slate-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}

                  {!canManage && (
                     <div className="absolute top-3 right-3 text-slate-400" title={isGlobal ? 'Global' : 'Compartido'}>
                       {isGlobal ? <Globe size={15} /> : <Users size={15} />}
                     </div>
                  )}

                  {item.fecha_limite && (
                    <span className={`flex items-center gap-1 text-[11px] ${t.mutedText}`}>
                      <Clock size={11} />{new Date(item.fecha_limite).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className={`text-center py-8 text-xs font-medium ${t.mutedText} border-2 border-dashed ${t.cardBorder} rounded-lg`}>Sin elementos</div>
          )}
        </div>
      </div>
    );
  };

  // ─── Componentes Compartidos (Selectors) ──────────────────────────────────
  const ContactsSelect = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const availableContacts = contacts.filter(c => c.email !== userEmail && c.email);
    
    if (isLoadingContacts) {
      return <div className={INPUT + " text-slate-400 bg-slate-50 flex items-center"}><Loader2 size={14} className="animate-spin mr-2" /> Buscando...</div>;
    }

    if (contacts.length === 0 || availableContacts.length === 0) {
      return (
        <div>
          <input 
            type="email" 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            placeholder="correo@municipio.gob.mx" 
            className={INPUT} 
            required 
          />
          <p className="text-[10px] text-amber-600 mt-1">Escribe el correo manualmente (Directorio vacío).</p>
        </div>
      );
    }

    return (
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className={INPUT}
        required
      >
        <option value="" disabled>-- Selecciona un contacto --</option>
        {availableContacts.map(c => (
          <option key={c.email!} value={c.email!}>
            {c.name || 'Sin Nombre'} ({c.email})
          </option>
        ))}
      </select>
    );
  };

  // ─── Navigation ─────────────────────────────────────────────
  const NAV = [
    { id: 'pipelines',   label: 'Pipelines',  icon: CheckCircle2    },
    { id: 'contactos',   label: 'Contactos',  icon: Users           },
    { id: 'actividades', label: 'Actividades',icon: CalendarDays    },
    { id: 'dashboards',  label: 'Dashboards', icon: LayoutDashboard },
    { id: 'mensajes',    label: 'Mensajes',   icon: Mail            },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className={`flex min-h-screen ${t.bg} ${t.text} font-sans`} style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className={`w-64 ${t.sidebarBg} flex-shrink-0 hidden md:flex flex-col border-r border-slate-800`}>
        <div className="px-6 py-6 border-b border-white/5">
          <span className="text-white font-extrabold text-2xl tracking-tight">PazSuma</span>
          <p className="text-[#b39656] text-[10px] mt-1.5 tracking-widest uppercase font-bold">Sistema Institucional</p>
        </div>
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {NAV.map(item => {
            const active = currentView === item.id;
            return (
              <button key={item.id} onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all group relative ${
                  active ? 'bg-[#6b1c35] text-white shadow-md shadow-[#6b1c35]/20'
                         : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={17} className={`flex-shrink-0 ${active ? 'text-[#b39656]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && item.id !== 'mensajes' && <ChevronRight size={13} className="text-[#b39656]" />}
              </button>
            );
          })}
        </nav>
        {/* Role badge */}
        <div className="px-5 py-4 border-t border-white/5">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isAdmin ? 'bg-[#6b1c35]/20' : 'bg-white/5'}`}>
            <Shield size={14} className={isAdmin ? 'text-[#b39656]' : 'text-slate-500'} />
            <span className={`text-xs font-bold capitalize ${isAdmin ? 'text-[#b39656]' : 'text-slate-500'}`}>{userRole}</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Header */}
        <header className={`flex-shrink-0 ${t.headerBg} border-b ${t.headerBorder} shadow-sm z-20`}>
          <div className="px-6 h-16 flex items-center justify-between">
            <div className={`flex items-center gap-2 ${t.searchBg} px-4 py-2 rounded-lg border ${t.headerBorder} focus-within:border-[#b39656] transition-all`}>
              <Search size={16} className={t.mutedText} />
              <input type="text" placeholder="Buscar..." className={`bg-transparent border-none text-sm focus:outline-none ${t.text} w-44 placeholder-slate-400`} />
            </div>

            <div className="flex items-center gap-4">
              {/* Notification Bell -> Redirects to Gmail & Shows Badge */}
              <button 
                onClick={handleOpenGmail}
                title="Abrir Bandeja de Gmail"
                className={`relative p-2 rounded-lg transition-colors ${t.mutedText} hover:text-[#6b1c35] ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              >
                <Bell size={20} />
                {notificationCount > 0 && (
                  <span className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                    {notificationCount}
                  </span>
                )}
              </button>

              {/* ⚙ Settings Dropdown */}
              <div className="relative" ref={settingsRef}>
                <button onClick={() => { setIsSettingsOpen(v => !v); setIsDropdownOpen(false); }}
                  className={`p-2 rounded-lg transition-colors ${t.mutedText} hover:text-[#6b1c35] ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <Settings size={20} />
                </button>
                {isSettingsOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50">
                    <p className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Apariencia</p>
                    <button onClick={() => setIsDark(false)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-bold rounded-lg transition-colors ${!isDark ? 'bg-[#f4f1ea] text-[#6b1c35]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><Sun size={14} />Claro Institucional</span>
                      {!isDark && <CheckCircle2 size={13} />}
                    </button>
                    <button onClick={() => setIsDark(true)}
                      className={`w-full flex items-center justify-between px-3 py-2 mt-0.5 text-sm font-bold rounded-lg transition-colors ${isDark ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><Moon size={14} />Oscuro</span>
                      {isDark && <CheckCircle2 size={13} className="text-[#b39656]" />}
                    </button>
                  </div>
                )}
              </div>

              {/* 👤 User Menu */}
              <div className={`relative border-l ${t.headerBorder} pl-4`} ref={userMenuRef}>
                <button onClick={() => { setIsDropdownOpen(v => !v); setIsSettingsOpen(false); }}
                  className="flex items-center gap-2 focus:outline-none group"
                >
                  <div className="w-8 h-8 rounded-full bg-[#f4f1ea] border border-[#b39656] flex items-center justify-center">
                    <UserCircle size={22} className="text-[#6b1c35]" />
                  </div>
                  <span className={`hidden sm:block text-sm font-bold max-w-[120px] truncate ${isDark ? 'text-white' : 'text-slate-700'} group-hover:text-[#6b1c35] transition-colors`}>
                    {userName}
                  </span>
                  <ChevronDown size={14} className={t.mutedText} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                      <p className={`text-[10px] font-bold mt-0.5 capitalize ${isAdmin ? 'text-[#6b1c35]' : 'text-slate-400'}`}>{userRole}</p>
                    </div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-[#6b1c35] font-bold hover:bg-[#f4f1ea] flex items-center gap-2 mt-1 transition-colors">
                      <LogOut size={14} />Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Dynamic Content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 relative">

          {/* ══════════════ PIPELINES ══════════════ */}
          {currentView === 'pipelines' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-[#6b1c35]'}`}>Pipelines Operativos</h2>
                  <p className={`${t.mutedText} text-sm mt-1`}>Solo ves tus proyectos personales y los que comparten contigo.</p>
                </div>
                <button onClick={() => setIsProjectModalOpen(true)} disabled={!userEmail}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#6b1c35] hover:bg-[#581c2f] text-white font-bold text-sm rounded-lg shadow-md shadow-[#6b1c35]/20 transition-colors disabled:opacity-40"
                >
                  <Plus size={16} />Nuevo Proyecto
                </button>
              </div>
              <div className="flex gap-5 overflow-x-auto pb-4 flex-1">
                <KanbanColumn status="pendiente"   accent="border-t-slate-400" />
                <KanbanColumn status="en_progreso" accent="border-t-[#b39656]" />
                <KanbanColumn status="completado"  accent="border-t-[#6b1c35]" />
              </div>
            </div>
          )}

          {/* ══════════════ CONTACTOS ══════════════ */}
          {currentView === 'contactos' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-[#6b1c35]'}`}>Personal del Ayuntamiento</h2>
                  <p className={`${t.mutedText} text-sm mt-1`}>
                    {isAdmin ? 'Vista de Administrador — control total.' : 'Directorio de personal (solo lectura).'}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => setIsAddContactModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#6b1c35] hover:bg-[#581c2f] text-white font-bold text-sm rounded-lg shadow-md transition-colors"
                  >
                    <UserPlus size={16} />Agregar Persona
                  </button>
                )}
              </div>

              <div className={`${t.cardBg} border ${t.cardBorder} rounded-2xl shadow-sm overflow-hidden`}>
                <table className="w-full">
                  <thead>
                    <tr className={`${t.tableTh} border-b ${t.cardBorder}`}>
                      <th className={`px-5 py-3 text-left text-xs font-black uppercase tracking-widest ${t.mutedText}`}>Nombre</th>
                      <th className={`px-5 py-3 text-left text-xs font-black uppercase tracking-widest ${t.mutedText}`}>Correo</th>
                      <th className={`px-5 py-3 text-left text-xs font-black uppercase tracking-widest ${t.mutedText}`}>Rol</th>
                      {isAdmin && <th className={`px-5 py-3 text-right text-xs font-black uppercase tracking-widest ${t.mutedText}`}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingContacts && (
                      <tr><td colSpan={isAdmin ? 4 : 3} className={`px-5 py-10 text-center text-sm ${t.mutedText}`}><Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#b39656]"/>Buscando contactos...</td></tr>
                    )}
                    {!isLoadingContacts && contacts.map(c => (
                      <tr key={c.id || c.email || Math.random().toString()} className={`${t.tableHover} transition-colors`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#f4f1ea] border border-[#b39656] flex items-center justify-center">
                              <UserCircle size={18} className="text-[#6b1c35]" />
                            </div>
                            <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{c.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className={`px-5 py-3.5 text-sm ${t.mutedText}`}>{c.email ?? '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize border ${
                            c.role === 'administrador' ? 'bg-[#6b1c35]/10 text-[#6b1c35] border-[#6b1c35]/20' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>{c.role || 'empleado'}</span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => c.id && handleDeleteContact(c.id)}
                              disabled={!c.id}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!isLoadingContacts && contacts.length === 0 && (
                      <tr><td colSpan={isAdmin ? 4 : 3} className={`px-5 py-10 text-center text-sm ${t.mutedText}`}>Sin contactos registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════ ACTIVIDADES — CALENDAR ══════════════ */}
          {currentView === 'actividades' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                    className={`p-2 rounded-lg ${t.mutedText} ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} hover:text-[#6b1c35] transition-colors`}
                  ><ChevronLeft size={18} /></button>
                  <h2 className={`text-xl font-extrabold capitalize ${isDark ? 'text-white' : 'text-[#6b1c35]'}`}>{monthLabel}</h2>
                  <button onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                    className={`p-2 rounded-lg ${t.mutedText} ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} hover:text-[#6b1c35] transition-colors`}
                  ><ChevronRight size={18} /></button>
                </div>
                <button onClick={() => setIsEventModalOpen(true)} disabled={!userEmail}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#6b1c35] hover:bg-[#581c2f] text-white font-bold text-sm rounded-lg shadow-md transition-colors disabled:opacity-40"
                >
                  <Plus size={16} />Agregar Evento
                </button>
              </div>

              <div className={`${t.cardBg} border ${t.cardBorder} rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col`}>
                <div className={`grid grid-cols-7 border-b ${t.cardBorder} ${t.calHdr}`}>
                  {DAYS_OF_WEEK.map(d => (
                    <div key={d} className={`py-2.5 text-center text-[10px] font-black uppercase tracking-widest ${t.mutedText} border-r ${t.cardBorder} last:border-0`}>{d}</div>
                  ))}
                </div>
                <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: 'minmax(90px, 1fr)' }}>
                  {buildCalendar().map((date, i) => {
                    const events  = date ? eventsOnDay(date) : [];
                    const isToday = date?.toDateString() === new Date().toDateString();
                    return (
                      <div key={i} onClick={() => date && handleDayClick(date)}
                        className={`p-2 border-r border-b ${t.cardBorder} ${date ? `${t.calCell} ${t.calHover} cursor-pointer` : t.calOther} transition-colors overflow-hidden group/cell`}
                      >
                        {date && (
                          <>
                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-[#6b1c35] text-white shadow-sm' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {date.getDate()}
                            </span>
                            <div className="space-y-1">
                              {events.slice(0, 3).map(ev => {
                                const isOwn = ev.creador_email === userEmail;
                                const canShare = isOwn || isAdmin;
                                return (
                                  <div key={ev.id} className={`text-[10px] truncate rounded px-1.5 py-0.5 border font-semibold flex justify-between items-center group/event ${
                                    ev.isExternal 
                                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                      : 'bg-[#6b1c35]/10 text-[#6b1c35] border-[#6b1c35]/15'
                                  }`}>
                                    <span className="truncate">
                                      {new Date(ev.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} {ev.titulo}
                                    </span>
                                    <div className="hidden group-hover/event:flex items-center">
                                      {canShare && !ev.isExternal && (
                                        <button 
                                          onClick={(e) => openShareEventModal(ev, e)}
                                          title="Compartir Evento"
                                          className="ml-1 hover:text-[#581c2f] transition-colors"
                                        >
                                          <Lock size={10} />
                                        </button>
                                      )}
                                      {canShare && !ev.isExternal && (
                                        <button 
                                          onClick={(e) => openDeleteModal(ev.id, 'agenda', ev.titulo, e)}
                                          title="Eliminar Evento"
                                          className="ml-1 text-red-400 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {events.length > 3 && <p className={`text-[10px] font-bold ${t.mutedText} pl-1`}>+{events.length - 3} más</p>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ DASHBOARDS (placeholder) ══════════════ */}
          {currentView === 'dashboards' && (
            <div className="flex flex-col items-center justify-center h-64">
              <LayoutDashboard size={44} className={`${t.mutedText} mb-4`} />
              <h3 className={`text-lg font-bold ${t.mutedText}`}>Dashboards en Desarrollo</h3>
              <p className={`text-sm ${t.mutedText} mt-1`}>Próximamente métricas y reportes interactivos.</p>
            </div>
          )}

          {/* ══════════════ MENSAJES — GMAIL CLIENT ══════════════ */}
          {currentView === 'mensajes' && (
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h2 className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-[#6b1c35]'}`}>Mensajería Institucional</h2>
                  <p className={`${t.mutedText} text-sm mt-1`}>Envía correos oficiales con documentos adjuntos vía Gmail.</p>
                </div>
                <button 
                  onClick={handleOpenGmail} 
                  className="text-sm font-bold text-[#b39656] hover:text-[#6b1c35] transition-colors flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
                >
                  <Mail size={14} /> Abrir Bandeja de Entrada
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-3.5 bg-[#f9f9f9] border-b border-slate-200 flex items-center gap-2">
                  <Mail size={18} className="text-[#6b1c35]" />
                  <span className="font-extrabold text-slate-700 text-sm">Nuevo Mensaje</span>
                </div>
                
                {emailStatus === 'sending' && uploadProgress > 0 && (
                  <div className="w-full h-1 bg-slate-100">
                    <div 
                      className="h-full bg-[#6b1c35] transition-all duration-200 ease-out" 
                      style={{ width: `${uploadProgress}%` }} 
                    />
                  </div>
                )}

                <form onSubmit={handleSendEmail} className="divide-y divide-slate-100">
                  <div className="flex items-center gap-3 px-6 py-3.5">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-14">Para</span>
                    <input
                      type="text"
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      placeholder="correo@municipio.gob.mx"
                      className="flex-1 text-sm font-medium text-black placeholder-slate-400 bg-transparent border-none focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3 px-6 py-3.5">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-14">Asunto</span>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Notificación oficial..."
                      className="flex-1 text-sm font-medium text-black placeholder-slate-400 bg-transparent border-none focus:outline-none"
                      required
                    />
                  </div>
                  <div className="px-6 py-4">
                    <textarea
                      value={emailMessage}
                      onChange={e => setEmailMessage(e.target.value)}
                      rows={8}
                      placeholder="Escribe el contenido del mensaje aquí..."
                      className="w-full text-sm font-medium text-black placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-4 resize-none focus:outline-none focus:border-[#581c2f] focus:ring-1 focus:ring-[#581c2f]"
                      required
                    />
                  </div>
                  
                  {emailFiles.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2">
                      {emailFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                          {f.type.startsWith('image/') ? <ImageIcon size={14} className="text-[#b39656]" /> : <FileText size={14} className="text-[#6b1c35]" />}
                          <span className="text-xs font-bold text-slate-700 max-w-[150px] truncate">{f.name}</span>
                          <button 
                            type="button" 
                            onClick={() => removeFile(i)}
                            className="ml-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300 rounded-lg text-sm font-bold text-slate-600 cursor-pointer transition-colors">
                      <Paperclip size={15} className="text-[#b39656]" />
                      Adjuntar Documento
                      <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                    <div className="flex items-center gap-3 ml-auto">
                      {emailStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-red-500 text-sm font-bold"><X size={14} />{emailError}</span>
                      )}
                      {emailStatus === 'sent' && (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-lg">
                          <CheckCircle2 size={14} />¡Enviado!
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={emailStatus === 'sending' || emailStatus === 'sent'}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#6b1c35] hover:bg-[#581c2f] text-white font-bold text-sm rounded-lg shadow-md transition-all disabled:opacity-50"
                      >
                        {emailStatus === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {emailStatus === 'sending' ? 'Procesando...' : 'Enviar Mensaje'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL — DELETE CONFIRMATION
      ══════════════════════════════════════════════════════ */}
      {isDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 mb-1">¿Eliminar elemento?</h3>
              <p className="text-sm text-slate-500 mb-2">Estás a punto de eliminar permanentemente:</p>
              <p className="text-sm font-bold text-slate-800 px-4 py-2 bg-slate-50 rounded-lg inline-block border border-slate-200 truncate max-w-full">
                {itemToDelete.title}
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
                className="flex-1 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteItem}
                className="flex-1 py-3.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — NUEVO EVENTO
      ══════════════════════════════════════════════════════ */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-[#581c2f] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-extrabold text-white">Nuevo Evento</h3>
              <button onClick={closeEventModal} className="text-[#dfd3c3] hover:text-white text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Título del Evento</label>
                <input type="text" required value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Ej. Reunión de Gabinete" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Fecha y Hora</label>
                <input type="datetime-local" required value={eventDate} onChange={e => setEventDate(e.target.value)} className={INPUT} style={{ colorScheme: 'light' }} />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Tipo de Evento</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className={INPUT}>
                  <option>Reunión</option><option>Tarea</option><option>Audiencia</option><option>Comisión</option>
                </select>
              </div>
              
              {/* Visibilidad de Calendario */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Visibilidad Inicial</label>
                <div className="flex gap-2">
                  {([
                    { val: 'personal',   label: 'Personal',   icon: Lock,  desc: 'Solo yo'         },
                    { val: 'compartido', label: 'Compartir',  icon: Users, desc: 'Con alguien'      },
                    { val: 'global',     label: 'Todos',      icon: Globe, desc: 'Todo el equipo'   },
                  ] as const).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setEventVisibility(opt.val)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${
                        eventVisibility === opt.val
                          ? 'border-[#6b1c35] bg-[#6b1c35]/8 text-[#6b1c35]'
                          : 'border-slate-200 text-slate-500 hover:border-[#b39656]'
                      }`}
                    >
                      <opt.icon size={16} />
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-medium opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {eventVisibility === 'compartido' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Selecciona a quién invitar
                  </label>
                  <ContactsSelect 
                    value={eventShareEmail} 
                    onChange={setEventShareEmail} 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Lista extraída dinámicamente de la base de datos.</p>
                </div>
              )}

              {!showGuests && eventVisibility !== 'compartido' ? (
                <button type="button" onClick={() => setShowGuests(true)} className="flex items-center gap-1.5 text-sm font-bold text-[#b39656] hover:text-[#6b1c35] transition-colors">
                  <Plus size={14} />Agregar descripción de Invitados
                </button>
              ) : (eventVisibility !== 'compartido') && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Nota de Invitados</label>
                  <input type="text" value={eventGuests} onChange={e => setEventGuests(e.target.value)} placeholder="Menciona otros invitados..." className={INPUT} />
                </div>
              )}
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={closeEventModal} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmittingEvent || !userEmail} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#581c2f] hover:bg-[#6b1c35] rounded-lg transition-colors disabled:opacity-50">
                  {isSubmittingEvent ? 'Guardando...' : 'Guardar y Sincronizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — COMPARTIR EVENTO EXISTENTE (AGENDA)
      ══════════════════════════════════════════════════════ */}
      {isShareEventModalOpen && eventToShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-[#6b1c35] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="text-lg font-extrabold text-white">Privacidad del Evento</h3>
                <p className="text-[10px] text-[#dfd3c3] font-bold uppercase tracking-widest mt-0.5 truncate max-w-[280px]">
                  {eventToShare.titulo}
                </p>
              </div>
              <button onClick={() => setIsShareEventModalOpen(false)} className="text-[#dfd3c3] hover:text-white text-2xl leading-none">×</button>
            </div>
            
            <form onSubmit={handleUpdateEventVisibility} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Visibilidad Actual</label>
                <div className="flex gap-2">
                  {([
                    { val: 'personal',   label: 'Personal',   icon: Lock,  desc: 'Solo yo'         },
                    { val: 'compartido', label: 'Compartir',  icon: Users, desc: 'Con alguien'      },
                    { val: 'global',     label: 'Todos',      icon: Globe, desc: 'Todo el equipo'   },
                  ] as const).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setEventVisibility(opt.val)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${
                        eventVisibility === opt.val
                          ? 'border-[#6b1c35] bg-[#6b1c35]/8 text-[#6b1c35]'
                          : 'border-slate-200 text-slate-500 hover:border-[#b39656]'
                      }`}
                    >
                      <opt.icon size={16} />
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-medium opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {eventVisibility === 'compartido' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Miembro Autorizado
                  </label>
                  <ContactsSelect 
                    value={eventShareEmail} 
                    onChange={setEventShareEmail} 
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsShareEventModalOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmittingEvent} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#581c2f] hover:bg-[#6b1c35] rounded-lg transition-colors disabled:opacity-50">
                  {isSubmittingEvent ? 'Actualizando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — NUEVO PROYECTO
      ══════════════════════════════════════════════════════ */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-[#581c2f] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-extrabold text-white">Nuevo Proyecto</h3>
              <button onClick={() => { setIsProjectModalOpen(false); resetProjectForm(); }} className="text-[#dfd3c3] hover:text-white text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleAddProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre del Proyecto</label>
                <input type="text" required value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="Ej. Auditoría Q2" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Descripción (Opcional)</label>
                <textarea value={projectDesc} onChange={e => setProjectDesc(e.target.value)} rows={2} placeholder="Detalles del proyecto..." className={`${INPUT} resize-none`} />
              </div>

              {/* ── Visibility Control ─────────────────── */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Visibilidad Inicial</label>
                <div className="flex gap-2">
                  {([
                    { val: 'personal',   label: 'Personal',   icon: Lock,  desc: 'Solo yo'         },
                    { val: 'compartido', label: 'Compartir',  icon: Users, desc: 'Con alguien'      },
                    { val: 'global',     label: 'Todos',      icon: Globe, desc: 'Todo el equipo'   },
                  ] as const).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setProjectVisibility(opt.val)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${
                        projectVisibility === opt.val
                          ? 'border-[#6b1c35] bg-[#6b1c35]/8 text-[#6b1c35]'
                          : 'border-slate-200 text-slate-500 hover:border-[#b39656]'
                      }`}
                    >
                      <opt.icon size={16} />
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-medium opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {projectVisibility === 'compartido' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Compartir con
                  </label>
                  <ContactsSelect 
                    value={shareWithEmail} 
                    onChange={setShareWithEmail} 
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setIsProjectModalOpen(false); resetProjectForm(); }} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmittingProject || !userEmail} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#581c2f] hover:bg-[#6b1c35] rounded-lg transition-colors disabled:opacity-50">
                  {isSubmittingProject ? 'Guardando...' : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — COMPARTIR PROYECTO EXISTENTE
      ══════════════════════════════════════════════════════ */}
      {isShareModalOpen && projectToShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-[#6b1c35] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="text-lg font-extrabold text-white">Privacidad del Proyecto</h3>
                <p className="text-[10px] text-[#dfd3c3] font-bold uppercase tracking-widest mt-0.5 truncate max-w-[280px]">
                  {projectToShare.titulo}
                </p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-[#dfd3c3] hover:text-white text-2xl leading-none">×</button>
            </div>
            
            <form onSubmit={handleUpdateProjectVisibility} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Visibilidad Actual</label>
                <div className="flex gap-2">
                  {([
                    { val: 'personal',   label: 'Personal',   icon: Lock,  desc: 'Solo yo'         },
                    { val: 'compartido', label: 'Compartir',  icon: Users, desc: 'Con alguien'      },
                    { val: 'global',     label: 'Todos',      icon: Globe, desc: 'Todo el equipo'   },
                  ] as const).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setProjectVisibility(opt.val)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${
                        projectVisibility === opt.val
                          ? 'border-[#6b1c35] bg-[#6b1c35]/8 text-[#6b1c35]'
                          : 'border-slate-200 text-slate-500 hover:border-[#b39656]'
                      }`}
                    >
                      <opt.icon size={16} />
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-medium opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {projectVisibility === 'compartido' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Miembro Autorizado
                  </label>
                  <ContactsSelect 
                    value={shareWithEmail} 
                    onChange={setShareWithEmail} 
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsShareModalOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmittingProject} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#581c2f] hover:bg-[#6b1c35] rounded-lg transition-colors disabled:opacity-50">
                  {isSubmittingProject ? 'Actualizando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — AGREGAR CONTACTO (ADMIN ONLY)
      ══════════════════════════════════════════════════════ */}
      {isAddContactModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-[#581c2f] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-extrabold text-white">Agregar Persona</h3>
              <button onClick={() => setIsAddContactModalOpen(false)} className="text-[#dfd3c3] hover:text-white text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleAddContact} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                <input type="text" required value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ej. María López Sánchez" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Correo Gmail</label>
                <input type="email" required value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="empleado@municipio.gob.mx" className={INPUT} />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddContactModalOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmittingContact} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#581c2f] hover:bg-[#6b1c35] rounded-lg transition-colors disabled:opacity-50">
                  {isSubmittingContact ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
