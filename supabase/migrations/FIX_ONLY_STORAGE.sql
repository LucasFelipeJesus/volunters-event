-- ================================================================
-- CORREÇÃO SIMPLES APENAS PARA UPLOAD DE IMAGENS DE EVENTOS
-- ================================================================
-- Ignora RLS de usuários, foca apenas no storage

-- 1. Garantir que bucket é público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'event-images';

-- 2. Remover políticas conflitantes de storage
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
DROP POLICY IF EXISTS "Event images - authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Event images - public read" ON storage.objects;
DROP POLICY IF EXISTS "Event images - authenticated manage" ON storage.objects;

-- 3. Criar política simples que sempre funciona
CREATE POLICY "Event images full access"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'event-images')
WITH CHECK (bucket_id = 'event-images');

-- ================================================================
-- VERIFICAÇÃO APENAS DO STORAGE
-- ================================================================

DO $$
DECLARE
    bucket_is_public boolean;
    storage_policies_count integer;
BEGIN
    -- Verificar se bucket é público
    SELECT public INTO bucket_is_public
    FROM storage.buckets 
    WHERE id = 'event-images';
    
    -- Contar políticas de storage
    SELECT COUNT(*) INTO storage_policies_count
    FROM storage.policies 
    WHERE bucket_id = 'event-images';
    
    RAISE NOTICE '✅ Correção de storage aplicada!';
    RAISE NOTICE '📸 Bucket event-images público: %', bucket_is_public;
    RAISE NOTICE '🔒 Políticas de storage: %', storage_policies_count;
    RAISE NOTICE '🎯 Upload de imagens deve funcionar agora!';
END;
$$;
