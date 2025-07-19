-- ==========================================
-- FIX IMEDIATO: Força remoção de tudo
-- ==========================================
-- Use este se o RESET_USERS_COMPLETE.sql ainda der erro
-- ==========================================

-- 1. LISTAR TODAS AS POLÍTICAS EXISTENTES PRIMEIRO
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';

-- 2. DESABILITAR RLS PRIMEIRO (para evitar conflitos)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 3. FORÇAR REMOÇÃO DE TODAS AS POLÍTICAS (com CASCADE)
DROP POLICY IF EXISTS "Users can view their own profile" ON users CASCADE;
DROP POLICY IF EXISTS "Users can update their own profile" ON users CASCADE;
DROP POLICY IF EXISTS "Admin users can view all profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Admin users can update all profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Admin users can insert profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Admin users can delete profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON users CASCADE;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users CASCADE;
DROP POLICY IF EXISTS "Allow admin to view all users" ON users CASCADE;
DROP POLICY IF EXISTS "Allow admin to update all users" ON users CASCADE;
DROP POLICY IF EXISTS "Allow admin to insert users" ON users CASCADE;
DROP POLICY IF EXISTS "Allow admin to delete users" ON users CASCADE;
DROP POLICY IF EXISTS "Users can read own profile" ON users CASCADE;
DROP POLICY IF EXISTS "Users can update own profile" ON users CASCADE;
DROP POLICY IF EXISTS "Admins can read all profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Admins can update all profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Admins can insert profiles" ON users CASCADE;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON users CASCADE;
DROP POLICY IF EXISTS "Enable update for users based on email" ON users CASCADE;
DROP POLICY IF EXISTS "users_select_own" ON users CASCADE;
DROP POLICY IF EXISTS "users_update_own" ON users CASCADE;
DROP POLICY IF EXISTS "users_insert_own" ON users CASCADE;
DROP POLICY IF EXISTS "admin_full_access" ON users CASCADE;
DROP POLICY IF EXISTS "emergency_users_access" ON users CASCADE;
DROP POLICY IF EXISTS "simple_users_select" ON users CASCADE;
DROP POLICY IF EXISTS "simple_users_insert" ON users CASCADE;
DROP POLICY IF EXISTS "simple_users_update" ON users CASCADE;
DROP POLICY IF EXISTS "basic_user_access" ON users CASCADE;
DROP POLICY IF EXISTS "Service role can read all users" ON users CASCADE;
DROP POLICY IF EXISTS "Service role can update users" ON users CASCADE;
DROP POLICY IF EXISTS "Admins can read all users (safe)" ON users CASCADE;
DROP POLICY IF EXISTS "Admins can update user roles (safe)" ON users CASCADE;
DROP POLICY IF EXISTS "Allow admin creation during setup" ON users CASCADE;
DROP POLICY IF EXISTS "allow_own_access" ON users CASCADE;
DROP POLICY IF EXISTS "allow_admin_access" ON users CASCADE;

-- 4. REMOVER TODAS AS FUNÇÕES COM CASCADE
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- 5. VERIFICAR SE AINDA EXISTEM POLÍTICAS
SELECT 'Políticas restantes:' as info;
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';

-- 6. CRIAR AS 2 POLÍTICAS FINAIS SIMPLES
CREATE POLICY "final_own_access" ON users
    FOR ALL 
    USING (auth.uid() = id);

CREATE POLICY "final_admin_access" ON users
    FOR ALL 
    USING (
        (auth.jwt() ->> 'role') = 'admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- 7. REABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 8. RESULTADO FINAL
SELECT 'FIX FORÇADO CONCLUÍDO!' as status;
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';
