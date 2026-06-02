-- ==========================================
-- PAZSUMA - ESQUEMA DE BASE DE DATOS v3
-- Auth: Supabase Auth nativo (auth.users)
-- Agregado: Columnas de privacidad para la agenda
-- ==========================================

-- ── 1. Tabla de perfil de usuarios (extiende auth.users) ──────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  role text NOT NULL DEFAULT 'empleado' CHECK (role IN ('administrador', 'empleado')),
  image text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email)
);

-- Trigger: crear perfil automáticamente al registrar un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'empleado'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Tablas de Negocio (PazSuma) ────────────────────────────────────────────

-- CHECKLISTS
CREATE TABLE IF NOT EXISTS public.checklists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descripcion text,
  asignado_a uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visibilidad text DEFAULT 'personal' CHECK (visibilidad IN ('personal', 'compartido', 'global')),
  compartido_con uuid[],
  fecha_limite timestamp with time zone,
  estatus text DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'en_progreso', 'completado')),
  creado_en timestamp with time zone DEFAULT now()
);

-- AGENDA
CREATE TABLE IF NOT EXISTS public.agenda (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descripcion text,
  fecha_hora timestamp with time zone NOT NULL,
  creador_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  visibilidad text DEFAULT 'personal' CHECK (visibilidad IN ('personal', 'compartido', 'global')),
  compartido_con uuid[],
  creado_en timestamp with time zone DEFAULT now()
);

-- ── 3. RLS Policies ────────────────────────────────────────────────────────────
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda     ENABLE ROW LEVEL SECURITY;

-- public.users: todos los autenticados pueden ver la lista, solo admins modifican
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
CREATE POLICY "users_insert_admin" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'administrador')
  );

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'administrador')
  );

-- checklists
DROP POLICY IF EXISTS "checklists_all" ON public.checklists;
CREATE POLICY "checklists_all" ON public.checklists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- agenda
DROP POLICY IF EXISTS "agenda_all" ON public.agenda;
CREATE POLICY "agenda_all" ON public.agenda
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. FKs repair (si las tablas ya existían apuntando a public.users) ─────────
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_asignado_a_fkey;
ALTER TABLE public.agenda     DROP CONSTRAINT IF EXISTS agenda_creador_id_fkey;

ALTER TABLE public.checklists
  ADD CONSTRAINT checklists_asignado_a_fkey
  FOREIGN KEY (asignado_a) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.agenda
  ADD CONSTRAINT agenda_creador_id_fkey
  FOREIGN KEY (creador_id) REFERENCES auth.users(id) ON DELETE CASCADE;
