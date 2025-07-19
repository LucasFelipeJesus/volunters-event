-- ==========================================
-- RESET MÍNIMO - SÓ O ESSENCIAL
-- ==========================================
-- Script super simples que resolve apenas o problema RLS
-- sem mexer em funções do sistema
-- ==========================================

-- 1. DESABILITAR RLS PRIMEIRO
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER APENAS AS POLÍTICAS EXISTENTES (sem erros)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remover políticas da tabela users
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'users' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON users';
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar erros e continuar
            NULL;
        END;
    END LOOP;
    
    -- Remover políticas da tabela events
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON events';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Remover políticas da tabela event_registrations
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'event_registrations' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON event_registrations';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    
    -- Remover políticas da tabela teams
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'teams' LOOP
        BEGIN
            EXECUTE 'DROP POLICY "' || r.policyname || '" ON teams';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END
$$;

-- 3. REMOVER APENAS NOSSAS FUNÇÕES (não as do sistema)
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- 4. CRIAR POLÍTICAS SUPER SIMPLES (sem recursão)

-- USERS: Política que NÃO gera recursão
CREATE POLICY "users_simple_own" ON users
    FOR ALL 
    USING (auth.uid() = id);

-- USERS: Admin usando apenas JWT (sem consultar tabela users)
CREATE POLICY "users_simple_admin" ON users
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- EVENTS: Acesso público para leitura
CREATE POLICY "events_simple_read" ON events
    FOR SELECT 
    USING (true);

-- EVENTS: Admin pode tudo
CREATE POLICY "events_simple_admin" ON events
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- REGISTRATIONS: Próprio usuário
CREATE POLICY "registrations_simple_own" ON event_registrations
    FOR ALL 
    USING (auth.uid() = user_id);

-- REGISTRATIONS: Admin
CREATE POLICY "registrations_simple_admin" ON event_registrations
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- TEAMS: Leitura pública
CREATE POLICY "teams_simple_read" ON teams
    FOR SELECT 
    USING (true);

-- TEAMS: Admin pode tudo
CREATE POLICY "teams_simple_admin" ON teams
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text
        ) = 'admin'
    );

-- 5. REABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 6. RECRIAR TRIGGER SIMPLES
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
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo e criar novo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. VERIFICAÇÃO
SELECT 'RESET MÍNIMO CONCLUÍDO!' as status;
SELECT COUNT(*) as "Políticas Users" FROM pg_policies WHERE tablename = 'users';
SELECT COUNT(*) as "Políticas Events" FROM pg_policies WHERE tablename = 'events';
SELECT COUNT(*) as "Políticas Registrations" FROM pg_policies WHERE tablename = 'event_registrations';
SELECT COUNT(*) as "Políticas Teams" FROM pg_policies WHERE tablename = 'teams';

SELECT 'Sistema pronto! Teste o login agora.' as final_message;
