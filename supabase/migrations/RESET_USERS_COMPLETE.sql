-- ==========================================
-- RESET COMPLETO DA TABELA USERS
-- ==========================================
-- Este script faz um reset total da tabela users,
-- removendo todas as políticas RLS problemáticas
-- e recriando a estrutura do zero
-- ==========================================

-- 1. BACKUP: Salvar dados existentes (opcional)
-- Descomente as linhas abaixo se quiser fazer backup:
-- CREATE TABLE users_backup AS SELECT * FROM users;

-- 2. REMOVER TODAS AS POLÍTICAS RLS EXISTENTES
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

-- 3. REMOVER FUNÇÕES PROBLEMÁTICAS (agora que as políticas foram removidas)
DROP FUNCTION IF EXISTS is_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- 4. DESABILITAR RLS TEMPORARIAMENTE
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 5. LIMPAR DADOS EXISTENTES (CUIDADO!)
-- Descomente apenas se quiser APAGAR TODOS OS USUÁRIOS:
-- TRUNCATE TABLE users CASCADE;

-- 6. RECRIAR ESTRUTURA DA TABELA (caso necessário)
-- A tabela já existe, então apenas garantimos que está correta
-- (Esta parte não apaga dados existentes)

-- 7. CRIAR POLÍTICAS RLS SIMPLES E FUNCIONAIS
-- Política básica para acesso próprio
CREATE POLICY "allow_own_access" ON users
    FOR ALL 
    USING (auth.uid() = id);

-- Política para administradores (usando JWT diretamente)
CREATE POLICY "allow_admin_access" ON users
    FOR ALL 
    USING (
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text,
            (auth.jwt() -> 'app_metadata' ->> 'role')::text,
            'user'
        ) = 'admin'
    );

-- 8. REABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 9. VERIFICAR RESULTADO
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- 10. TESTE DE INSERÇÃO (para verificar se funciona)
-- Isso será feito pela aplicação, não execute aqui

-- 11. STATUS FINAL
SELECT 'RESET COMPLETO EXECUTADO COM SUCESSO!' as status,
       'Apenas 2 políticas RLS criadas: own_access + admin_access' as info,
       'Teste o login agora' as next_step;
