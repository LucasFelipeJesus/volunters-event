-- ==========================================
-- RESET OTIMIZADO BASEADO NO CÓDIGO REAL
-- ==========================================
-- Baseado na análise completa do código fonte
-- Apenas políticas necessárias para operações reais
-- ==========================================

-- 1. DESABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remover todas as políticas de users
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'users' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON users';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Remover todas as políticas de events
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON events';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Remover todas as políticas de event_registrations
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'event_registrations' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON event_registrations';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Remover todas as políticas de teams
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'teams' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON teams';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END
$$;

-- 3. REMOVER FUNÇÕES PROBLEMÁTICAS
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- ==========================================
-- 4. POLÍTICAS BASEADAS NO CÓDIGO REAL
-- ==========================================

-- USERS: Baseado em userService.getProfile, AdminUsersManagement, AuthProvider
-- Operações identificadas:
-- - SELECT por ID próprio (userService.getProfile)
-- - SELECT todos usuários (AdminUsersManagement.fetchUsers) - ADMIN apenas
-- - UPDATE próprio perfil (userService.updateProfile)
-- - INSERT novos usuários (AuthProvider.createMissingUserProfile)

CREATE POLICY "users_select_own" ON users
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_select_all_users" ON users
    FOR SELECT 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' 
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

CREATE POLICY "admin_update_all_users" ON users
    FOR UPDATE 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' 
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- EVENTS: Baseado em Dashboard.tsx, EventsList.tsx
-- Operações identificadas:
-- - SELECT eventos publicados (Dashboard, EventsList) - PÚBLICO
-- - SELECT/INSERT/UPDATE/DELETE todos eventos - ADMIN apenas

CREATE POLICY "events_public_read" ON events
    FOR SELECT 
    USING (true);  -- Todos podem ver eventos

CREATE POLICY "admin_manage_events" ON events
    FOR ALL 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' 
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- EVENT_REGISTRATIONS: Baseado em Dashboard.tsx, VolunteerDashboard.tsx
-- Operações identificadas:
-- - SELECT próprias inscrições (VolunteerDashboard)
-- - INSERT/UPDATE/DELETE próprias inscrições (VolunteerDashboard)
-- - SELECT todas inscrições - ADMIN (Dashboard.fetchDashboardData)

CREATE POLICY "registrations_own_access" ON event_registrations
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "admin_view_all_registrations" ON event_registrations
    FOR SELECT 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' 
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

CREATE POLICY "admin_manage_all_registrations" ON event_registrations
    FOR INSERT 
    WITH CHECK (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' 
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- TEAMS: Baseado em EditTeam.tsx, EventsList.tsx
-- Operações identificadas:
-- - SELECT times para contagem (EventsList, Dashboard) - PÚBLICO
-- - SELECT/INSERT/UPDATE/DELETE - ADMIN apenas

CREATE POLICY "teams_public_read" ON teams
    FOR SELECT 
    USING (true);  -- Todos podem ver times para contagem

CREATE POLICY "admin_manage_teams" ON teams
    FOR ALL 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' 
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- 5. REABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 6. RECRIAR TRIGGER PARA NOVOS USUÁRIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'volunteer')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. VERIFICAÇÃO FINAL
SELECT 'RESET OTIMIZADO CONCLUÍDO!' as status;

-- Mostrar políticas criadas
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN '🔍'
        WHEN cmd = 'INSERT' THEN '➕'
        WHEN cmd = 'UPDATE' THEN '✏️'
        WHEN cmd = 'DELETE' THEN '🗑️'
        WHEN cmd = 'ALL' THEN '🔧'
        ELSE '❓'
    END as icon
FROM pg_policies 
WHERE tablename IN ('users', 'events', 'event_registrations', 'teams')
ORDER BY tablename, cmd;

-- Contagem das políticas por tabela
SELECT 
    tablename,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename IN ('users', 'events', 'event_registrations', 'teams')
GROUP BY tablename
ORDER BY tablename;

SELECT 
    '✅ Sistema otimizado e funcional!' as final_message,
    'Total de políticas: ' || (
        SELECT COUNT(*) 
        FROM pg_policies 
        WHERE tablename IN ('users', 'events', 'event_registrations', 'teams')
    ) as policies_count;
