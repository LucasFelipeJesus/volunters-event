-- ================================================================
-- CORREÇÃO PARA TIMEOUT RLS - VERSÃO SEM SCHEMA AUTH
-- ================================================================
-- Problema: As políticas RLS estão causando consultas recursivas na tabela users
-- Solução: Recriar políticas sem usar schema auth (apenas public)

-- 1. Remover políticas problemáticas da tabela users
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update user roles" ON users;
DROP POLICY IF EXISTS "Admins can read all users - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can update user roles - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can manage all user operations" ON users;
DROP POLICY IF EXISTS "Emergency admin access" ON users;

-- 2. Criar função helper no schema public para verificar se é admin via email
CREATE OR REPLACE FUNCTION public.is_user_admin(user_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT user_email IN (
    'admin@exemplo.com',  -- Substitua pelo email do seu admin
    'admin@voluntarios.com',
    'administrador@sistema.com'
  );
$$;

-- 3. Política simples para usuários acessarem próprio perfil
CREATE POLICY "Users can access own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 4. Política para usuários atualizarem próprio perfil
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 5. Política para inserir próprio perfil
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 6. Política para admins (usando email, sem dependência circular)
CREATE POLICY "Admins can manage all users by email"
  ON users
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = id OR 
    public.is_user_admin(auth.jwt()->>'email')
  )
  WITH CHECK (
    auth.uid() = id OR 
    public.is_user_admin(auth.jwt()->>'email')
  );

-- 7. Política de service_role para bypass completo
CREATE POLICY "Service role full access"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- ATUALIZAR ROLE DO USUÁRIO ADMIN ATUAL
-- ================================================================

-- Atualizar role para admin baseado no email (substitua pelo seu email)
UPDATE users 
SET role = 'admin', updated_at = now()
WHERE email IN (
  'admin@sistema.com'
) AND role != 'admin';

-- ================================================================
-- VERIFICAÇÕES DE INTEGRIDADE
-- ================================================================

-- Verificar se as políticas foram criadas corretamente
DO $$
DECLARE
  policy_count integer;
  admin_count integer;
BEGIN
  -- Contar políticas criadas
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'users';
  
  -- Contar admins
  SELECT COUNT(*) INTO admin_count
  FROM users 
  WHERE role = 'admin';
  
  IF policy_count >= 4 THEN
    RAISE NOTICE '✅ Correção RLS aplicada com sucesso!';
    RAISE NOTICE '📊 Políticas criadas: %', policy_count;
    RAISE NOTICE '👤 Administradores encontrados: %', admin_count;
    RAISE NOTICE '💡 Lembre-se de atualizar os emails admin na função is_user_admin';
  ELSE
    RAISE EXCEPTION 'Erro: Poucas políticas foram criadas. Esperado >= 4, encontrado: %', policy_count;
  END IF;
END;
$$;

-- ================================================================
-- INSTRUÇÕES IMPORTANTES
-- ================================================================

-- ANTES DE EXECUTAR:
-- 1. Substitua 'admin@exemplo.com' pelo email real do seu administrador
-- 2. Execute este script no Supabase SQL Editor
-- 3. Teste fazendo login com o usuário admin

-- APÓS EXECUTAR:
-- 1. Faça login no sistema
-- 2. Verifique se o dashboard carrega
-- 3. Teste acesso ao perfil
-- 4. Teste funcionalidades admin

-- ================================================================
-- COMANDOS PARA TESTE
-- ================================================================

-- Para testar se as políticas estão funcionando:
-- SELECT * FROM users WHERE id = auth.uid(); -- Deve funcionar sempre
-- SELECT count(*) FROM users; -- Deve funcionar para todos
-- SELECT email, role FROM users WHERE role = 'admin'; -- Ver admins

-- Para verificar o email atual do usuário logado:
-- SELECT auth.jwt()->>'email';

-- Para verificar se função está funcionando:
-- SELECT public.is_user_admin('admin@exemplo.com');
