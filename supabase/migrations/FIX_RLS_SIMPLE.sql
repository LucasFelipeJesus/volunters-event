-- ================================================================
-- CORREÇÃO RÁPIDA PARA TIMEOUT RLS - VERSÃO SIMPLIFICADA
-- ================================================================
-- Esta é uma solução mais simples que temporariamente remove as políticas
-- problemáticas e recria versões mais eficientes

-- 1. Temporariamente desabilitar RLS na tabela users para permitir correção
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas da tabela users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update user roles" ON users;
DROP POLICY IF EXISTS "Admins can read all users - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can update user roles - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can manage all user operations" ON users;
DROP POLICY IF EXISTS "Emergency admin access" ON users;

-- 3. Criar política simples e eficiente para acesso próprio
CREATE POLICY "Users access own data"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Criar política simples para service_role (bypass completo)
CREATE POLICY "Service role full access"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Reabilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 6. Verificar se funcionou
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'users';
  
  IF policy_count > 0 THEN
    RAISE NOTICE '✅ Correção RLS simples aplicada com sucesso!';
    RAISE NOTICE 'Políticas ativas: %', policy_count;
  ELSE
    RAISE EXCEPTION 'Erro: Nenhuma política encontrada após correção!';
  END IF;
END;
$$;

-- ================================================================
-- NOTA IMPORTANTE:
-- Esta correção simplificada remove temporariamente o acesso de admin
-- a todos os usuários via RLS. Para restaurar funcionalidades admin,
-- use o arquivo FIX_RLS_TIMEOUT.sql (versão completa)
-- ================================================================
