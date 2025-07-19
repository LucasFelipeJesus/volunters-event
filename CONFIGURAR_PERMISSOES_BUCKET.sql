-- ==========================================
-- VERIFICAR E CONFIGURAR PERMISSÕES DO BUCKET
-- ==========================================

-- 1. Verificar se os buckets existem
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id IN ('profile-image', 'event-image')
ORDER BY created_at;

-- 2. Verificar políticas RLS para o bucket profile-image
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- 3. Verificar se há políticas específicas para os buckets
SELECT * FROM storage.buckets WHERE id = 'profile-image';

-- 4. Criar política para permitir upload de imagens (se não existir)
-- IMPORTANTE: Execute apenas se não houver políticas configuradas

-- Política para SELECT (visualizar imagens)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'profile_images_select_policy'
    ) THEN
        CREATE POLICY "profile_images_select_policy" ON storage.objects
        FOR SELECT USING (bucket_id = 'profile-image');
        RAISE NOTICE 'Política SELECT criada para profile-image';
    ELSE
        RAISE NOTICE 'Política SELECT já existe para profile-image';
    END IF;
END $$;

-- Política para INSERT (upload de imagens)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'profile_images_insert_policy'
    ) THEN
        CREATE POLICY "profile_images_insert_policy" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'profile-image' AND auth.uid()::text = (storage.foldername(name))[1]);
        RAISE NOTICE 'Política INSERT criada para profile-image';
    ELSE
        RAISE NOTICE 'Política INSERT já existe para profile-image';
    END IF;
END $$;

-- Política para UPDATE (atualizar imagens)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'profile_images_update_policy'
    ) THEN
        CREATE POLICY "profile_images_update_policy" ON storage.objects
        FOR UPDATE USING (bucket_id = 'profile-image' AND auth.uid()::text = (storage.foldername(name))[1]);
        RAISE NOTICE 'Política UPDATE criada para profile-image';
    ELSE
        RAISE NOTICE 'Política UPDATE já existe para profile-image';
    END IF;
END $$;

-- Política para DELETE (deletar imagens)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'profile_images_delete_policy'
    ) THEN
        CREATE POLICY "profile_images_delete_policy" ON storage.objects
        FOR DELETE USING (bucket_id = 'profile-image' AND auth.uid()::text = (storage.foldername(name))[1]);
        RAISE NOTICE 'Política DELETE criada para profile-image';
    ELSE
        RAISE NOTICE 'Política DELETE já existe para profile-image';
    END IF;
END $$;

-- 5. Verificar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%profile_images%'
ORDER BY policyname;

-- 6. Teste final - verificar se bucket está acessível
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'profile-image') 
        THEN '✅ Bucket profile-image existe'
        ELSE '❌ Bucket profile-image não encontrado'
    END as status_bucket;
