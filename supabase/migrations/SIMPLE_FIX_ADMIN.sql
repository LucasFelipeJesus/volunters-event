-- ==========================================
-- CORREÇÃO SIMPLES DE ADMIN
-- ==========================================
-- Versão simples para corrigir o role do admin
-- ==========================================

-- 1. MOSTRAR TODOS OS USUÁRIOS PRIMEIRO
SELECT 
    'Lista de usuários cadastrados:' as info;
    
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM users 
ORDER BY created_at;

-- 2. PROMOVER O PRIMEIRO USUÁRIO A ADMIN (assumindo que é você)
UPDATE users 
SET role = 'admin' 
WHERE id = (
    SELECT id 
    FROM users 
    ORDER BY created_at ASC 
    LIMIT 1
);

-- 3. OU PROMOVER POR EMAIL (substitua pelo seu email)
-- UPDATE users SET role = 'admin' WHERE email = 'SEU_EMAIL@exemplo.com';

-- 4. ATUALIZAR METADATA NO AUTH
UPDATE auth.users 
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = (
    SELECT id 
    FROM users 
    WHERE role = 'admin' 
    LIMIT 1
);

-- 5. VERIFICAR RESULTADO
SELECT 
    '✅ RESULTADO FINAL:' as status;

SELECT 
    email,
    full_name,
    role,
    is_active,
    'ESTE É O ADMIN' as obs
FROM users 
WHERE role = 'admin';

-- 6. MOSTRAR METADATA DO AUTH PARA VERIFICAR
SELECT 
    email,
    raw_user_meta_data->>'role' as metadata_role,
    raw_user_meta_data
FROM auth.users 
WHERE id IN (
    SELECT id FROM users WHERE role = 'admin'
);

SELECT 'CORREÇÃO CONCLUÍDA! Faça LOGOUT e LOGIN novamente para aplicar as mudanças.' as instrucao;
