-- ==========================================
-- CORRIGIR ROLE DO ADMIN
-- ==========================================
-- Script para promover usuário a admin e corrigir metadata
-- ==========================================

-- 1. PRIMEIRO: Identifique o email do admin que precisa ser corrigido
-- Substitua 'SEU_EMAIL_ADMIN@exemplo.com' pelo email real do admin

-- VERSÃO 1: Se você souber o email do admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'SEU_EMAIL_ADMIN@exemplo.com';

-- VERSÃO 2: Se você não souber o email, liste todos os usuários primeiro
SELECT id, email, full_name, role, created_at 
FROM users 
ORDER BY created_at;

-- 2. APÓS IDENTIFICAR O USUÁRIO, ATUALIZE O ROLE
-- Substitua o ID do usuário que deve ser admin:
-- UPDATE users SET role = 'admin' WHERE id = 'INSERIR_ID_AQUI';

-- 3. VERIFICAR SE A ATUALIZAÇÃO FUNCIONOU
SELECT id, email, full_name, role, created_at 
FROM users 
WHERE role = 'admin';

-- 4. ATUALIZAR METADATA DO USUÁRIO NO AUTH (OPCIONAL)
-- Isso vai garantir que o JWT também tenha o role correto
-- Execute isso no Supabase SQL Editor para o usuário específico:

/*
UPDATE auth.users 
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'SEU_EMAIL_ADMIN@exemplo.com';
*/

-- 5. SE QUISER CRIAR UM ADMIN COMPLETAMENTE NOVO
-- Descomente e edite as linhas abaixo:

/*
-- Primeiro criar o usuário no auth
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    is_super_admin,
    role
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@sistema.com',
    crypt('admin123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"role": "admin", "full_name": "Administrador do Sistema"}'::jsonb,
    false,
    'authenticated'
);

-- Depois criar o perfil na tabela users
INSERT INTO users (id, email, full_name, role, is_active)
SELECT 
    id, 
    email, 
    'Administrador do Sistema', 
    'admin', 
    true
FROM auth.users 
WHERE email = 'admin@sistema.com';
*/

-- 6. VERIFICAÇÃO FINAL
SELECT 
    '✅ Verificação de Admin' as status,
    COUNT(*) as total_admins
FROM users 
WHERE role = 'admin';

SELECT 
    'Usuários cadastrados:' as info,
    email,
    full_name,
    role,
    is_active
FROM users 
ORDER BY role DESC, created_at;
