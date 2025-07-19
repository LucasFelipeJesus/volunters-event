-- Script simplificado para criar buckets - Versão Compatível
-- Execute este script no SQL Editor do Supabase

-- PASSO 1: Verificar se o storage está configurado
SELECT 'Storage check' as test, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets')
            THEN 'Storage disponível ✅'
            ELSE 'Storage não configurado ❌'
       END as result;

-- PASSO 2: Verificar e criar buckets de forma mais simples
-- Deletar buckets existentes para recriação limpa
DELETE FROM storage.buckets WHERE id IN ('profile-images', 'event-images');

-- Criar buckets básicos (sem limitações avançadas primeiro)
INSERT INTO storage.buckets (id, name, public) VALUES 
('profile-images', 'profile-images', true),
('event-images', 'event-images', true);

-- PASSO 3: Remover políticas existentes (para recriação limpa)
DROP POLICY IF EXISTS "Public Access for Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;

-- PASSO 4: Criar políticas básicas e funcionais
-- Acesso público para leitura
CREATE POLICY "Enable read access for all users" ON storage.objects
FOR SELECT USING (true);

-- Upload para usuários autenticados
CREATE POLICY "Enable upload for authenticated users" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update para usuários autenticados  
CREATE POLICY "Enable update for authenticated users" ON storage.objects
FOR UPDATE USING (auth.role() = 'authenticated');

-- Delete para usuários autenticados
CREATE POLICY "Enable delete for authenticated users" ON storage.objects
FOR DELETE USING (auth.role() = 'authenticated');

-- PASSO 5: Verificação final
SELECT 
    'Buckets criados:' as status,
    id,
    name,
    public,
    created_at
FROM storage.buckets 
WHERE id IN ('profile-images', 'event-images')
ORDER BY id;

-- PASSO 6: Verificar políticas
SELECT 
    'Políticas ativas:' as status,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;
