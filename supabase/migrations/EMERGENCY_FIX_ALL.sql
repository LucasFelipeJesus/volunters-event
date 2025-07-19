-- ================================================================
-- CORREÇÃO DE EMERGÊNCIA - RESOLVER TIMEOUT RLS IMEDIATAMENTE
-- ================================================================
-- Esta correção resolve o timeout RLS de forma definitiva

-- 1. DESABILITAR RLS TEMPORARIAMENTE para resolver o bloqueio
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Remover TODAS as políticas da tabela users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update user roles" ON users;
DROP POLICY IF EXISTS "Users can access own profile" ON users;
DROP POLICY IF EXISTS "Simple user access" ON users;
DROP POLICY IF EXISTS "Service role bypass" ON users;
DROP POLICY IF EXISTS "Admins can read all users - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can update user roles - no circular dependency" ON users;
DROP POLICY IF EXISTS "Admins can manage all user operations" ON users;
DROP POLICY IF EXISTS "Emergency admin access" ON users;
DROP POLICY IF EXISTS "Admins can manage all users by email" ON users;
DROP POLICY IF EXISTS "Service role full access" ON users;

-- 3. Limpar função que pode estar causando problema
DROP FUNCTION IF EXISTS public.is_user_admin(text);

-- 4. REABILITAR RLS com políticas simples e funcionais
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Criar apenas UMA política ultra simples
CREATE POLICY "Users full access to own data"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. Política para service_role (Supabase interno)
CREATE POLICY "Service role complete access"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ================================================================
-- CORREÇÃO DE STORAGE PARA EVENT-IMAGES
-- ================================================================

-- 7. Limpar políticas conflitantes de storage
DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
DROP POLICY IF EXISTS "Event images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event images authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Event images upload" ON storage.objects;
DROP POLICY IF EXISTS "Event images public read" ON storage.objects;
DROP POLICY IF EXISTS "Event images update" ON storage.objects;
DROP POLICY IF EXISTS "Event images delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images public access" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images update" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images delete" ON storage.objects;

-- 8. Garantir que bucket é público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'event-images';

-- 9. Criar políticas de storage ultra simples
CREATE POLICY "Event images - authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Event images - public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

CREATE POLICY "Event images - authenticated manage"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'event-images')
WITH CHECK (bucket_id = 'event-images');

-- ================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================

DO $$
DECLARE
    user_policies_count integer;
    storage_policies_count integer;
    bucket_is_public boolean;
BEGIN
    -- Contar políticas da tabela users
    SELECT COUNT(*) INTO user_policies_count
    FROM pg_policies 
    WHERE tablename = 'users';
    
    -- Contar políticas de storage
    SELECT COUNT(*) INTO storage_policies_count
    FROM storage.policies 
    WHERE bucket_id = 'event-images';
    
    -- Verificar se bucket é público
    SELECT public INTO bucket_is_public
    FROM storage.buckets 
    WHERE id = 'event-images';
    
    RAISE NOTICE '🚨 CORREÇÃO DE EMERGÊNCIA APLICADA!';
    RAISE NOTICE '👤 Políticas de usuários: %', user_policies_count;
    RAISE NOTICE '📸 Políticas de storage: %', storage_policies_count;
    RAISE NOTICE '🌐 Bucket público: %', bucket_is_public;
    RAISE NOTICE '✅ Sistema deve funcionar agora!';
    
    IF user_policies_count < 2 THEN
        RAISE WARNING 'Poucas políticas de usuário. Pode precisar de ajustes.';
    END IF;
    
    IF storage_policies_count < 2 THEN
        RAISE WARNING 'Poucas políticas de storage. Pode precisar de ajustes.';
    END IF;
END;
$$;

-- ================================================================
-- INSTRUÇÕES IMPORTANTES
-- ================================================================

-- APÓS EXECUTAR ESTE SCRIPT:
-- 1. Faça logout e login novamente no sistema
-- 2. Teste acessar o dashboard
-- 3. Teste criar um evento com imagem
-- 4. Se ainda houver problemas, verifique os logs do Supabase

-- ESTE SCRIPT É UMA CORREÇÃO DE EMERGÊNCIA
-- Ele resolve os problemas mas remove funcionalidades avançadas de admin
-- Para recuperar funcionalidades completas, implemente políticas mais específicas depois
