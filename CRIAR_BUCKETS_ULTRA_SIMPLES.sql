-- Script SUPER SIMPLES para criar buckets
-- Execute comando por comando no SQL Editor do Supabase

-- 1. Verificar se storage existe
SELECT 'Storage schema exists' as check, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') 
            THEN 'YES ✅' 
            ELSE 'NO ❌' 
       END as result;

-- 2. Verificar buckets existentes
SELECT 'Existing buckets' as info, id, name, public 
FROM storage.buckets;

-- 3. Deletar buckets se existirem (ignorar se der erro)
DELETE FROM storage.buckets WHERE id = 'profile-images';
DELETE FROM storage.buckets WHERE id = 'event-images';

-- 4. Criar bucket profile-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-images', 'profile-images', true);

-- 5. Criar bucket event-images  
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true);

-- 6. Verificar se foram criados
SELECT 'Buckets após criação' as status, id, name, public, created_at 
FROM storage.buckets 
WHERE id IN ('profile-images', 'event-images');

-- 7. Habilitar RLS (se necessário)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 8. Política simples para leitura pública
CREATE POLICY "allow_public_read" ON storage.objects 
FOR SELECT USING (true);

-- 9. Política simples para upload autenticado
CREATE POLICY "allow_authenticated_upload" ON storage.objects 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 10. Verificação final
SELECT 'FINAL CHECK' as test,
       (SELECT COUNT(*) FROM storage.buckets WHERE id IN ('profile-images', 'event-images')) as buckets_count,
       (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') as policies_count;
