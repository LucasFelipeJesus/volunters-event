-- ================================================================
-- CRIAR BUCKETS DE STORAGE PARA EVENTOS
-- ================================================================

-- 1. Criar bucket para imagens de eventos (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images', 
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Remover políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
DROP POLICY IF EXISTS "Event images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event images authenticated" ON storage.objects;

-- 3. Política para permitir upload de imagens de eventos por usuários autenticados
CREATE POLICY "Event images upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- 4. Política para permitir leitura pública de imagens de eventos
CREATE POLICY "Event images public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- 5. Política para permitir atualização de imagens por usuários autenticados
CREATE POLICY "Event images update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images');

-- 6. Política para permitir exclusão de imagens por usuários autenticados
CREATE POLICY "Event images delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-images');

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

DO $$
DECLARE
    bucket_exists boolean := false;
    policy_count integer := 0;
BEGIN
    -- Verifica de forma segura se as tabelas do schema `storage` existem
    IF to_regclass('storage.buckets') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM storage.buckets 
            WHERE id = 'event-images'
        ) INTO bucket_exists;
    ELSE
        bucket_exists := false;
    END IF;

    IF to_regclass('storage.policies') IS NOT NULL THEN
        SELECT COUNT(*) INTO policy_count
        FROM storage.policies 
        WHERE bucket_id = 'event-images';
    ELSE
        policy_count := 0;
    END IF;

    IF bucket_exists THEN
        RAISE NOTICE '✅ Bucket event-images criado/atualizado com sucesso!';
        RAISE NOTICE '🔒 Políticas configuradas: %', policy_count;
    ELSE
        -- Não falhar a migration se o schema/storage não estiver disponível (ex: execução local sem extensão Storage)
        RAISE NOTICE '⚠️ Bucket event-images não foi criado ou o schema storage não está disponível nesta instância.';
        RAISE NOTICE 'Execute o SQL de criação de buckets no Dashboard do Supabase ou verifique se o Storage está habilitado no projeto.';
    END IF;
END;
$$;

-- ================================================================
-- COMANDOS PARA VERIFICAÇÃO MANUAL
-- ================================================================

-- Para verificar buckets:
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'event-images';

-- Para verificar políticas:
-- SELECT name, bucket_id, action, target FROM storage.policies WHERE bucket_id = 'event-images';

-- Para testar upload (no código da aplicação):
-- supabase.storage.from('event-images').upload('test.jpg', file)
