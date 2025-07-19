-- Script de diagnóstico completo para buckets do Supabase Storage
-- Execute este script no SQL Editor do Supabase para diagnosticar o problema

-- 1. Verificar se a extensão storage está habilitada
SELECT 
    'Storage Extension Status' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_storage') 
        THEN 'HABILITADA ✅' 
        ELSE 'NÃO HABILITADA ❌' 
    END as status;

-- 2. Verificar esquema storage
SELECT 
    'Storage Schema' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') 
        THEN 'EXISTE ✅' 
        ELSE 'NÃO EXISTE ❌' 
    END as status;

-- 3. Verificar tabela buckets
SELECT 
    'Buckets Table' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') 
        THEN 'EXISTE ✅' 
        ELSE 'NÃO EXISTE ❌' 
    END as status;

-- 4. Listar TODOS os buckets existentes
SELECT 
    'Existing Buckets' as info,
    COALESCE(
        (SELECT string_agg(id, ', ') FROM storage.buckets),
        'NENHUM BUCKET ENCONTRADO'
    ) as buckets;

-- 5. Verificar buckets específicos necessários
SELECT 
    bucket_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = bucket_name) 
        THEN 'EXISTE ✅' 
        ELSE 'NÃO EXISTE ❌' 
    END as status
FROM (VALUES 
    ('profile-images'),
    ('event-images')
) AS required_buckets(bucket_name);

-- 6. Verificar permissões RLS na tabela storage.buckets
SELECT 
    'RLS on storage.buckets' as check_type,
    CASE 
        WHEN relrowsecurity = true 
        THEN 'HABILITADO (pode bloquear acesso)' 
        ELSE 'DESABILITADO' 
    END as status
FROM pg_class 
WHERE relname = 'buckets' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage');

-- 7. Verificar políticas existentes para storage.objects
SELECT 
    'Storage Policies' as info,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL THEN 'HAS CONDITIONS' 
        ELSE 'NO CONDITIONS' 
    END as conditions
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- 8. Tentar criar buckets novamente (forçando)
-- Primeiro, vamos deletar se existir (apenas para reset)
DELETE FROM storage.buckets WHERE id IN ('profile-images', 'event-images');

-- Recriar buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('profile-images', 'profile-images', true, 5242880, 
     ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('event-images', 'event-images', true, 5242880, 
     ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 9. Verificação final - listar buckets criados
SELECT 
    'Final Verification' as info,
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id IN ('profile-images', 'event-images')
ORDER BY id;

-- 10. Verificar se há algum problema de permissions
SELECT 
    'Bucket Permissions Check' as info,
    has_table_privilege('storage.buckets', 'SELECT') as can_select,
    has_table_privilege('storage.buckets', 'INSERT') as can_insert,
    has_table_privilege('storage.buckets', 'UPDATE') as can_update;
