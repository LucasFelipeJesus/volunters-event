-- ================================================================
-- CORREÇÃO ULTRA SIMPLES PARA TIMEOUT RLS
-- ================================================================
-- Esta é a solução mais básica possível - sem dependências circulares

-- 1. Remover TODAS as políticas da tabela users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update user roles" ON users;
DROP POLICY IF EXISTS "Admins can read all users - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can update user roles - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can manage all user operations" ON users;
DROP POLICY IF EXISTS "Emergency admin access" ON users;
DROP POLICY IF EXISTS "Users can access own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users by email" ON users;
DROP POLICY IF EXISTS "Service role full access" ON users;

-- 2. Criar apenas UMA política simples para acesso próprio
CREATE POLICY "Simple user access"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Política para service_role (Supabase interno)
CREATE POLICY "Service role bypass"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- VERIFICAÇÃO SIMPLES
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Correção ULTRA SIMPLES aplicada!';
  RAISE NOTICE '📋 Apenas 2 políticas básicas foram criadas';
  RAISE NOTICE '🔒 Cada usuário só acessa seu próprio perfil';
  RAISE NOTICE '⚠️ Funcionalidades de admin podem precisar de ajustes posteriores';
END;
$$;

-- ================================================================
-- NOTA IMPORTANTE:
-- Esta solução resolve o timeout RLS mas remove temporariamente
-- as funcionalidades específicas de admin. 
-- O sistema funcionará normalmente para usuários individuais.
-- ================================================================
