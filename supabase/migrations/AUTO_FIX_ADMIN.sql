-- ==========================================
-- CORREÇÃO AUTOMÁTICA DE ADMIN
-- ==========================================
-- Este script corrige automaticamente o primeiro usuário como admin
-- ==========================================

-- 1. IDENTIFICAR E PROMOVER O PRIMEIRO USUÁRIO COMO ADMIN
DO $$
DECLARE
    first_user_id uuid;
    first_user_email text;
BEGIN
    -- Encontrar o primeiro usuário cadastrado (provavelmente o admin)
    SELECT id, email INTO first_user_id, first_user_email
    FROM users 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF first_user_id IS NOT NULL THEN
        -- Atualizar para admin
        UPDATE users 
        SET role = 'admin' 
        WHERE id = first_user_id;
        
        RAISE NOTICE 'Usuário % (%) promovido a admin', first_user_email, first_user_id;
    ELSE
        RAISE NOTICE 'Nenhum usuário encontrado para promover';
    END IF;
END
$$;

-- 2. VERIFICAR RESULTADO
SELECT 
    '✅ ADMIN CORRIGIDO AUTOMATICAMENTE' as status,
    email,
    full_name,
    role,
    'Primeiro usuário promovido a admin' as obs
FROM users 
WHERE role = 'admin'
LIMIT 1;

-- 3. MOSTRAR TODOS OS USUÁRIOS
SELECT 
    email,
    full_name,
    role,
    is_active,
    created_at
FROM users 
ORDER BY created_at;

-- 4. ATUALIZAR METADATA NO AUTH (PARA GARANTIR JWT CORRETO)
DO $$
DECLARE
    admin_email text;
BEGIN
    -- Obter email do admin
    SELECT email INTO admin_email
    FROM users 
    WHERE role = 'admin'
    LIMIT 1;
    
    IF admin_email IS NOT NULL THEN
        -- Atualizar metadata do auth
        UPDATE auth.users 
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
        WHERE email = admin_email;
        
        RAISE NOTICE 'Metadata atualizado para %', admin_email;
    END IF;
END
$$;

SELECT 'CORREÇÃO AUTOMÁTICA CONCLUÍDA! Faça logout e login novamente.' as final_message;
