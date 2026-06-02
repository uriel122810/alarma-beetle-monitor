'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CheckSquare, CalendarDays, Mail,
  Users, Settings, Building2, LogOut, ChevronRight,
  Send
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/overview',
    icon: LayoutDashboard,
    roles: ['admin', 'employee'],
  },
  {
    label: 'Pipelines/Flujos',
    href: '/pipelines',
    icon: CheckSquare,
    roles: ['admin', 'employee'],
  },
  {
    label: 'Contactos',
    href: '/contacts',
    icon: Users,
    roles: ['admin', 'employee'],
  },
  {
    label: 'Actividades',
    href: '/activities',
    icon: CalendarDays,
    roles: ['admin', 'employee'],
  },
  {
    label: 'Dashboards',
    href: '/dashboards',
    icon: LayoutDashboard,
    roles: ['admin', 'employee'],
  },
  {
    label: 'Mensajes',
    href: '/messages',
    icon: Mail,
    roles: ['admin', 'employee'],
  },
  {
    label: 'Configuración',
    href: '/settings',
    icon: Settings,
    roles: ['admin'],
    badge: 'Admin',
  },
];

interface SidebarProps {
  userRole: 'admin' | 'employee';
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
}

export default function Sidebar({ userRole, userName, userEmail, userAvatar }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900/80 border-r border-white/5 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25 flex-shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-lg leading-none">CorpOS</span>
          <p className="text-slate-500 text-xs mt-0.5">v1.0.0</p>
        </div>
      </div>

      {/* Role Badge */}
      {userRole === 'admin' && (
        <div className="mx-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <span className="text-violet-300 text-xs font-medium">Administrador Central</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <item.icon
                size={18}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 font-medium">
                  {item.badge}
                </span>
              )}
              {isActive && <ChevronRight size={14} className="text-violet-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User Card */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors cursor-default">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full ring-2 ring-white/10 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-slate-500 text-xs truncate">{userEmail}</p>
          </div>
          <button
            id="btn-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
