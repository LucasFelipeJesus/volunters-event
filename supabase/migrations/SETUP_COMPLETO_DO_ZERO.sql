-- ==========================================
-- SETUP COMPLETO DO ZERO - SISTEMA DE VOLUNTÁRIOS
-- ==========================================
-- Baseado no arquivo original mas com correções RLS
-- Este script cria todo o sistema funcional desde o início
-- ==========================================

-- 1. LIMPAR ESTADO ANTERIOR (se existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS setup_admin_profile(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;
-- Remover triggers de updated_at se existirem (evita erro ao recriar)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS update_evaluations_updated_at ON evaluations;
DROP TRIGGER IF EXISTS update_admin_evaluations_updated_at ON admin_evaluations;

-- Remover todas as políticas se existirem
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        BEGIN
            EXECUTE 'ALTER TABLE ' || r.tablename || ' DISABLE ROW LEVEL SECURITY';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON ' || r.tablename;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END
$$;

-- 2. CRIAR TABELAS PRINCIPAIS

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'captain', 'admin')),
  bio text,
  skills text[],
  availability text[],
  is_first_login boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de eventos
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_teams integer NOT NULL DEFAULT 1,
  max_volunteers integer DEFAULT 50,
  current_teams integer NOT NULL DEFAULT 0,
  admin_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
  requirements text,
  category text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de inscrições em eventos
CREATE TABLE IF NOT EXISTS event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'cancelled')),
  registered_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- Tabela de equipes
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  captain_id uuid REFERENCES users(id) ON DELETE SET NULL,
  max_volunteers integer NOT NULL DEFAULT 5,
  current_volunteers integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'complete', 'active', 'finished')),
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de membros da equipe
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role_in_team text NOT NULL DEFAULT 'volunteer' CHECK (role_in_team IN ('captain', 'volunteer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  UNIQUE(team_id, user_id)
);

-- Tabela de avaliações
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  captain_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments text,
  skills_demonstrated text[],
  areas_for_improvement text,
  would_work_again boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(volunteer_id, captain_id, event_id)
);

-- Tabela de avaliações de capitães
CREATE TABLE IF NOT EXISTS admin_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captain_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  leadership_rating integer NOT NULL CHECK (leadership_rating >= 1 AND leadership_rating <= 5),
  team_management_rating integer NOT NULL CHECK (team_management_rating >= 1 AND team_management_rating <= 5),
  communication_rating integer NOT NULL CHECK (communication_rating >= 1 AND communication_rating <= 5),
  overall_rating integer NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  comments text,
  strengths text,
  areas_for_improvement text,
  promotion_ready boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(captain_id, admin_id, event_id)
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'evaluation')),
  related_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  related_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_volunteer_id ON evaluations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- 4. CRIAR FUNÇÕES UTILITÁRIAS

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers de updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_admin_evaluations_updated_at BEFORE UPDATE ON admin_evaluations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Função para criar perfil automaticamente (SEM RECURSÃO)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_first_login, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'volunteer'),
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;

-- Função para setup de admin
CREATE OR REPLACE FUNCTION setup_admin_profile(admin_user_id uuid, admin_email text, admin_name text)
RETURNS boolean AS $$
BEGIN
  INSERT INTO users (id, email, full_name, role, is_first_login, is_active)
  VALUES (
    admin_user_id,
    admin_email,
    admin_name,
    'admin',
    true,
    true
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = 'admin',
    is_active = true,
    updated_at = now();
  
  -- Atualizar metadata do auth
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = admin_user_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ language 'plpgsql';
-- Garantir que a função rode com privilégios do owner para evitar bloqueios por RLS
ALTER FUNCTION setup_admin_profile(uuid, text, text) OWNER TO postgres;
ALTER FUNCTION setup_admin_profile(uuid, text, text) SECURITY DEFINER;

-- 5. POLÍTICAS RLS OTIMIZADAS (SEM RECURSÃO)

-- USERS: Políticas baseadas em JWT (evita recursão)
CREATE POLICY "users_own_access" ON users
    FOR ALL 
    USING (auth.uid() = id);

CREATE POLICY "admin_users_access" ON users
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- EVENTS: Acesso público para leitura, admin para gestão
CREATE POLICY "events_public_read" ON events
    FOR SELECT 
    USING (true);

CREATE POLICY "admin_events_manage" ON events
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- EVENT_REGISTRATIONS: Usuário próprio + admin
CREATE POLICY "registrations_own_access" ON event_registrations
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "admin_registrations_access" ON event_registrations
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- TEAMS: Leitura pública, gestão admin
CREATE POLICY "teams_public_read" ON teams
    FOR SELECT 
    USING (true);

CREATE POLICY "admin_teams_manage" ON teams
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- TEAM_MEMBERS: Próprio usuário + admin + captain
CREATE POLICY "team_members_own_access" ON team_members
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "admin_team_members_access" ON team_members
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) IN ('admin', 'captain')
    );

-- EVALUATIONS: Voluntário + capitão + admin
CREATE POLICY "evaluations_stakeholder_access" ON evaluations
    FOR SELECT 
    USING (
        auth.uid() = volunteer_id 
        OR auth.uid() = captain_id 
        OR COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

CREATE POLICY "captain_evaluations_manage" ON evaluations
    FOR ALL 
    USING (
        auth.uid() = captain_id 
        OR COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- ADMIN_EVALUATIONS: Capitão + admin
CREATE POLICY "admin_evaluations_access" ON admin_evaluations
    FOR SELECT 
    USING (
        auth.uid() = captain_id 
        OR auth.uid() = admin_id 
        OR COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

CREATE POLICY "admin_evaluations_manage" ON admin_evaluations
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- NOTIFICATIONS: Usuário próprio
CREATE POLICY "notifications_own_access" ON notifications
    FOR ALL 
    USING (auth.uid() = user_id);

-- 6. HABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 7. CRIAR TRIGGER PARA NOVOS USUÁRIOS
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 8. CRIAR BUCKET DE STORAGE (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- 9. VERIFICAÇÃO FINAL
SELECT 'SETUP COMPLETO DO ZERO FINALIZADO!' as status;

-- Mostrar estrutura criada
SELECT 
    'Tabelas criadas:' as info,
    table_name,
    'OK' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'events', 'event_registrations', 'teams', 'team_members', 'evaluations', 'admin_evaluations', 'notifications')
ORDER BY table_name;

-- Mostrar políticas RLS
SELECT 
    'Políticas RLS:' as info,
    tablename,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename IN ('users', 'events', 'event_registrations', 'teams', 'team_members', 'evaluations', 'admin_evaluations', 'notifications')
GROUP BY tablename
ORDER BY tablename;

SELECT 
    '✅ SISTEMA PRONTO!' as final_status,
    'Agora você pode fazer login e criar o primeiro admin' as next_step;
