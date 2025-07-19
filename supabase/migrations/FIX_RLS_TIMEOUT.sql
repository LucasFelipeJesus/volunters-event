-- ================================================================
-- CORREÇÃO PARA TIMEOUT RLS - DEPENDÊNCIA CIRCULAR
-- ================================================================
-- Problema: As políticas RLS estão causando consultas recursivas na tabela users
-- Solução: Recriar políticas usando auth.jwt() para evitar dependência circular

-- 1. Remover políticas problemáticas da tabela users
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update user roles" ON users;

-- 2. Criar função helper para verificar role do usuário atual via JWT
CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt()->>'user_role',
    'volunteer'
  );
$$;

-- 3. Criar função para verificar se o usuário é admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.current_user_role() = 'admin';
$$;

-- 4. Recriar política para admins lerem todos os usuários (sem dependência circular)
CREATE POLICY "Admins can read all users - no circular dependency"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    -- Permite que usuários vejam seu próprio perfil OU se for admin via JWT
    auth.uid() = id OR auth.is_admin()
  );

-- 5. Recriar política para admins atualizarem roles (sem dependência circular)
CREATE POLICY "Admins can update user roles - no circular dependency"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    -- Permite que usuários atualizem seu próprio perfil OU se for admin via JWT
    auth.uid() = id OR auth.is_admin()
  );

-- 6. Política adicional para admins gerenciarem usuários completamente
CREATE POLICY "Admins can manage all user operations"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- 7. Função para atualizar JWT token com role do usuário
CREATE OR REPLACE FUNCTION update_user_jwt_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar claims do JWT quando role do usuário mudar
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}')::jsonb || 
        jsonb_build_object('user_role', NEW.role)
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Trigger para manter JWT sincronizado com role
DROP TRIGGER IF EXISTS update_user_jwt_claims_trigger ON users;
CREATE TRIGGER update_user_jwt_claims_trigger
  AFTER UPDATE OF role ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_jwt_claims();

-- 9. Atualizar JWT claims para usuários existentes
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}')::jsonb || 
    jsonb_build_object('user_role', 
      COALESCE((SELECT role FROM public.users WHERE id = auth.users.id), 'volunteer')
    )
WHERE id IN (SELECT id FROM public.users);

-- 10. Política de backup para garantir acesso durante problemas RLS
CREATE POLICY "Emergency admin access"
  ON users
  FOR ALL
  TO authenticated
  USING (
    -- Acesso de emergência via email específico (substituir por seu email admin)
    auth.jwt()->>'email' = 'admin@exemplo.com' OR
    -- Ou se o usuário já tiver role admin no JWT
    auth.jwt()->>'user_role' = 'admin'
  )
  WITH CHECK (
    auth.jwt()->>'email' = 'admin@exemplo.com' OR
    auth.jwt()->>'user_role' = 'admin'
  );

-- ================================================================
-- VERIFICAÇÕES DE INTEGRIDADE
-- ================================================================

-- Verificar se as políticas foram criadas corretamente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Admins can read all users - no circular dependency'
  ) THEN
    RAISE EXCEPTION 'Política de leitura para admins não foi criada!';
  END IF;
  
  RAISE NOTICE '✅ Correção RLS aplicada com sucesso!';
  RAISE NOTICE '💡 Lembre-se de atualizar o email admin na política de emergência se necessário';
END;
$$;

-- ================================================================
-- COMANDOS PARA TESTE
-- ================================================================

-- Para testar se as políticas estão funcionando:
-- SELECT * FROM users WHERE id = auth.uid(); -- Deve funcionar sempre
-- SELECT * FROM users; -- Deve funcionar apenas para admins

-- Se ainda houver problemas, execute:
-- SELECT auth.current_user_role();
-- SELECT auth.is_admin();
-- SELECT auth.jwt();
