-- ==========================================
-- ADICIONAR COLUNA PROFILE_IMAGE_URL NA TABELA USERS
-- ==========================================

-- 1. Verificar estrutura atual da tabela users
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Adicionar a coluna profile_image_url (execute apenas se não existir)
-- IMPORTANTE: Execute este comando no SQL Editor do Supabase
ALTER TABLE users ADD COLUMN profile_image_url TEXT;

-- 3. Verificar se foi adicionada corretamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'profile_image_url';

-- 4. Teste rápido 
SELECT id, email, full_name, profile_image_url 
FROM users 
WHERE id = auth.uid();
