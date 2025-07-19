-- ==========================================
-- RESET COMPLETO DO BANCO DE DADOS
-- ==========================================
-- Este script reconstrói todo o banco desde o início
-- removendo todos os problemas RLS e dependências
-- ==========================================

-- 1. REMOVER TODAS AS POLÍTICAS RLS DE TODAS AS TABELAS
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admin users can view all profiles" ON users;
DROP POLICY IF EXISTS "Admin users can update all profiles" ON users;
DROP POLICY IF EXISTS "Admin users can insert profiles" ON users;
DROP POLICY IF EXISTS "Admin users can delete profiles" ON users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;
DROP POLICY IF EXISTS "Allow admin to view all users" ON users;
DROP POLICY IF EXISTS "Allow admin to update all users" ON users;
DROP POLICY IF EXISTS "Allow admin to insert users" ON users;
DROP POLICY IF EXISTS "Allow admin to delete users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON users;
DROP POLICY IF EXISTS "Admins can insert profiles" ON users;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON users;
DROP POLICY IF EXISTS "Enable update for users based on email" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "admin_full_access" ON users;
DROP POLICY IF EXISTS "emergency_users_access" ON users;
DROP POLICY IF EXISTS "simple_users_select" ON users;
DROP POLICY IF EXISTS "simple_users_insert" ON users;
DROP POLICY IF EXISTS "simple_users_update" ON users;
DROP POLICY IF EXISTS "basic_user_access" ON users;
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update users" ON users;
DROP POLICY IF EXISTS "Admins can read all users (safe)" ON users;
DROP POLICY IF EXISTS "Admins can update user roles (safe)" ON users;
DROP POLICY IF EXISTS "Allow admin creation during setup" ON users;

-- Políticas para outras tabelas
DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON events;
DROP POLICY IF EXISTS "Enable update for users based on email" ON events;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON events;

DROP POLICY IF EXISTS "Enable read access for all users" ON event_registrations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON event_registrations;
DROP POLICY IF EXISTS "Enable update for users based on email" ON event_registrations;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON event_registrations;

DROP POLICY IF EXISTS "Enable read access for all users" ON teams;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON teams;
DROP POLICY IF EXISTS "Enable update for users based on email" ON teams;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON teams;

-- 2. REMOVER APENAS AS FUNÇÕES CRIADAS POR NÓS (não as do sistema)
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;
-- NÃO remover auth.uid() e auth.jwt() - são funções do sistema Supabase

-- 3. DESABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teams DISABLE ROW LEVEL SECURITY;

-- 4. REMOVER TRIGGERS PROBLEMÁTICOS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 5. RECREAR TABELAS (preservando dados se existirem)

-- Tabela users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    phone TEXT,
    birth_date DATE,
    address TEXT,
    emergency_contact TEXT,
    medical_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    max_volunteers INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela event_registrations
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'cancelled')),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Tabela teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    leader_id UUID REFERENCES users(id),
    max_members INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CRIAR ÍNDICES NECESSÁRIOS
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);

-- 7. CRIAR POLÍTICAS RLS SIMPLES E FUNCIONAIS

-- Políticas para users (apenas 2 políticas simples)
CREATE POLICY "users_own_access" ON users
    FOR ALL 
    USING (auth.uid() = id);

CREATE POLICY "users_admin_access" ON users
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Políticas para events (acesso público para leitura)
CREATE POLICY "events_public_read" ON events
    FOR SELECT 
    USING (true);

CREATE POLICY "events_admin_all" ON events
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Políticas para event_registrations
CREATE POLICY "registrations_own_access" ON event_registrations
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "registrations_admin_access" ON event_registrations
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Políticas para teams
CREATE POLICY "teams_public_read" ON teams
    FOR SELECT 
    USING (true);

CREATE POLICY "teams_admin_all" ON teams
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 8. REABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 9. CRIAR TRIGGER PARA CRIAÇÃO AUTOMÁTICA DE PERFIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. CRIAR BUCKET PARA IMAGENS (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Política para bucket de imagens
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'event-images' 
    AND EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- 11. VERIFICAR RESULTADO
SELECT 'RESET COMPLETO EXECUTADO!' as status;

SELECT 'Políticas criadas:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename IN ('users', 'events', 'event_registrations', 'teams')
ORDER BY tablename, policyname;

-- 12. INSERIR USUÁRIO ADMIN PADRÃO (opcional)
-- Descomente se quiser criar um admin padrão:
/*
INSERT INTO auth.users (
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    created_at, 
    updated_at,
    raw_user_meta_data
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@sistema.com',
    crypt('admin123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"role": "admin", "full_name": "Administrador"}'
) ON CONFLICT (email) DO NOTHING;
*/

SELECT 'DATABASE RESET COMPLETO FINALIZADO!' as final_status,
       'Sistema pronto para uso' as message,
       'Teste o login agora' as next_step;
