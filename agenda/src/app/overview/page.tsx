import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OverviewClient from './OverviewClient';

export default async function PazSumaOverviewPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Verify session
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) redirect('/login');

  const { user } = session;

  // 2. Fetch role from public.users profile table
  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single();

  // 3. Pass both user and role to the client component
  return (
    <OverviewClient
      user={user}
      userRole={(profile?.role as 'administrador' | 'empleado') ?? 'empleado'}
      userName={profile?.name ?? user.email ?? 'Operador'}
    />
  );
}
