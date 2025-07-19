-- ==========================================
-- SETUP ADMIN APÓS CRIAÇÃO COMPLETA
-- ==========================================
-- Execute este script APÓS o SETUP_COMPLETO_DO_ZERO.sql
-- para criar/promover automaticamente o primeiro admin
-- ==========================================

-- 1. PROMOVER PRIMEIRO USUÁRIO A ADMIN
UPDATE users 
SET role = 'admin' 
WHERE id = (
    SELECT id 
    FROM users 
    ORDER BY created_at ASC 
    LIMIT 1
);

-- 2. ATUALIZAR METADATA DO AUTH PARA O ADMIN
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = (
    SELECT id 
    FROM users 
    WHERE role = 'admin' 
    LIMIT 1
);

-- 3. VERIFICAR RESULTADO
SELECT 
    '✅ ADMIN CONFIGURADO!' as status,
    email,
    full_name,
    role,
    'Este é o administrador do sistema' as obs
FROM users 
WHERE role = 'admin';

-- 4. MOSTRAR TODOS OS USUÁRIOS
SELECT 
    'Lista de usuários:' as info;

SELECT 
    email,
    full_name,
    role,
    is_active,
    created_at
FROM users 
ORDER BY created_at;

-- 5. VERIFICAR METADATA DO AUTH
SELECT 
    'Metadata do Auth (JWT):' as info;

SELECT 
    email,
    raw_user_meta_data->>'role' as jwt_role,
    created_at
FROM auth.users 
WHERE id IN (SELECT id FROM users WHERE role = 'admin');

SELECT 
    '🎉 SETUP ADMIN COMPLETO!' as final_message,
    'Agora faça LOGOUT e LOGIN novamente' as instrucao;
