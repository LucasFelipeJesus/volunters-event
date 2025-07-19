-- Script para criar bucket profile-images no Supabase Storage
-- Execute este script no SQL Editor do seu projeto Supabase

-- 1. Criar bucket para imagens de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images', 
    'profile-images', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de acesso para o bucket profile-images

-- Política para visualização pública das imagens
CREATE POLICY "Public Access for Profile Images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-images');

-- Política para usuários autenticados poderem fazer upload das próprias imagens
CREATE POLICY "Users can upload own profile images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'profile-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para usuários poderem atualizar suas próprias imagens
CREATE POLICY "Users can update own profile images" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'profile-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para usuários poderem deletar suas próprias imagens
CREATE POLICY "Users can delete own profile images" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'profile-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Verificar se o bucket foi criado
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'profile-images';

-- 4. Verificar políticas criadas
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%profile%';
