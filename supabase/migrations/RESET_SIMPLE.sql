-- ==========================================
-- RESET SIMPLES E DIRETO
-- ==========================================
-- Script alternativo mais simples para reset completo
-- ==========================================

-- 1. DESABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS (ignorar erros)
DO $$
DECLARE
    policy_record record;
BEGIN
    -- Remove todas as políticas da tabela users
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'users'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON users';
    END LOOP;
    
    -- Remove todas as políticas da tabela events
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'events'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON events';
    END LOOP;
    
    -- Remove todas as políticas da tabela event_registrations
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'event_registrations'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON event_registrations';
    END LOOP;
    
    -- Remove todas as políticas da tabela teams
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'teams'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON teams';
    END LOOP;
END
$$;

-- 3. REMOVER FUNÇÕES PROBLEMÁTICAS
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- 4. CRIAR APENAS 2 POLÍTICAS SIMPLES PARA USERS
CREATE POLICY "allow_own_profile" ON users
    FOR ALL 
    USING (auth.uid() = id);

CREATE POLICY "allow_admin_all" ON users
    FOR ALL 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- 5. POLÍTICAS SIMPLES PARA OUTRAS TABELAS
CREATE POLICY "events_read_all" ON events FOR SELECT USING (true);
CREATE POLICY "events_admin_write" ON events FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
);

CREATE POLICY "registrations_own" ON event_registrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "registrations_admin" ON event_registrations FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
);

CREATE POLICY "teams_read_all" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_admin_write" ON teams FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
);

-- 6. REABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 7. CRIAR TRIGGER PARA NOVOS USUÁRIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        role = COALESCE(EXCLUDED.role, users.role);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. VERIFICAÇÃO FINAL
SELECT 'RESET SIMPLES CONCLUÍDO!' as status;
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('users', 'events', 'event_registrations', 'teams')
ORDER BY tablename;
