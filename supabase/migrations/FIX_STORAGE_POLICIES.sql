-- ================================================================
-- CORRIGIR POLÍTICAS DE STORAGE PARA EVENT-IMAGES
-- ================================================================

-- 1. Remover políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de imagens" ON storage.objects;
DROP POLICY IF EXISTS "Imagens são públicas para visualização" ON storage.objects;
DROP POLICY IF EXISTS "event_images_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "event_images_view_policy" ON storage.objects;
DROP POLICY IF EXISTS "event_images_delete_policy" ON storage.objects;

-- 2. Verificar se o bucket existe, se não, criar
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-images',
    'event-images',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 3. Criar políticas simples e funcionais
CREATE POLICY "Anyone can upload to event-images bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Anyone can view event-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can update event-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete event-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');

-- ================================================================
-- VERIFICAÇÃO DAS POLÍTICAS
-- ================================================================

DO $$
DECLARE
    policy_count integer;
    bucket_exists boolean;
BEGIN
    -- Verificar se o bucket existe
    SELECT EXISTS(
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) INTO bucket_exists;
    
    -- Contar políticas do bucket
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%event%';
    
    RAISE NOTICE '✅ Verificação de Storage concluída!';
    RAISE NOTICE '📁 Bucket event-images existe: %', bucket_exists;
    RAISE NOTICE '🔐 Políticas encontradas: %', policy_count;
    
    IF bucket_exists AND policy_count >= 3 THEN
        RAISE NOTICE '🎯 Storage configurado corretamente!';
    ELSE
        RAISE NOTICE '⚠️ Possíveis problemas na configuração';
    END IF;
END;
$$;
