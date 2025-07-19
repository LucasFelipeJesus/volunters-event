-- ================================================================
-- CORRIGIR APENAS POLÍTICAS DE STORAGE PARA EVENT-IMAGES
-- ================================================================
-- Use este script quando o bucket já existe mas há erro de permissão

-- 1. Remover políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
DROP POLICY IF EXISTS "Event images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event images authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Event images upload" ON storage.objects;
DROP POLICY IF EXISTS "Event images public read" ON storage.objects;
DROP POLICY IF EXISTS "Event images update" ON storage.objects;
DROP POLICY IF EXISTS "Event images delete" ON storage.objects;

-- 2. Criar políticas simples e funcionais
CREATE POLICY "Allow event images upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Allow event images public access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

CREATE POLICY "Allow event images update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images');

CREATE POLICY "Allow event images delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-images');

-- 3. Verificar se bucket está configurado como público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'event-images';

-- ================================================================
-- VERIFICAÇÃO DAS POLÍTICAS
-- ================================================================

DO $$
DECLARE
    bucket_exists boolean;
    bucket_is_public boolean;
    policy_count integer;
BEGIN
    -- Verificar se bucket existe e é público
    SELECT EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'event-images'
    ) INTO bucket_exists;
    
    SELECT public INTO bucket_is_public
    FROM storage.buckets 
    WHERE id = 'event-images';
    
    -- Contar políticas ativas
    SELECT COUNT(*) INTO policy_count
    FROM storage.policies 
    WHERE bucket_id = 'event-images';
    
    RAISE NOTICE '✅ Correção de políticas de storage concluída!';
    RAISE NOTICE '🪣 Bucket event-images existe: %', bucket_exists;
    RAISE NOTICE '🌐 Bucket é público: %', bucket_is_public;
    RAISE NOTICE '🔒 Políticas ativas: %', policy_count;
    
    IF NOT bucket_exists THEN
        RAISE EXCEPTION 'Erro: Bucket event-images não existe!';
    END IF;
    
    IF policy_count < 3 THEN
        RAISE WARNING 'Atenção: Poucas políticas criadas (%). Esperado pelo menos 3.', policy_count;
    END IF;
END;
$$;

-- ================================================================
-- COMANDOS PARA VERIFICAÇÃO MANUAL
-- ================================================================

-- Verificar detalhes do bucket:
-- SELECT id, name, public, file_size_limit, allowed_mime_types 
-- FROM storage.buckets 
-- WHERE id = 'event-images';

-- Verificar todas as políticas:
-- SELECT name, bucket_id, action, target_role 
-- FROM storage.policies 
-- WHERE bucket_id = 'event-images';

-- Testar upload (na aplicação):
-- const { data, error } = await supabase.storage
--   .from('event-images')
--   .upload('test.jpg', file);
