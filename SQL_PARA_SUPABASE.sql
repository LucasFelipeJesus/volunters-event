-- EXECUTE ESTE SQL NO SUPABASE DASHBOARD -> SQL EDITOR

-- 1. Política para administradores verem todos os usuários
DROP POLICY IF EXISTS "User access policy" ON users;

CREATE POLICY "User access policy" ON users
FOR SELECT
TO authenticated
USING (
    -- Usuários podem ver seu próprio perfil
    auth.uid() = id
    OR
    -- Administradores identificados via claim JWT 'user_role' = 'admin'
    (auth.jwt() ->> 'user_role') = 'admin'
);

-- 2. Função RPC para administradores (alternativa)
CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    role text,
    phone text,
    avatar_url text,
    profile_image_url text,
    bio text,
    skills text[],
    is_active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    cpf text,
    birth_date text,
    address text,
    city text,
    state text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Verificar se o usuário atual é admin via claim JWT 'user_role'
    IF NOT ((auth.jwt() ->> 'user_role') = 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
    END IF;

    -- Retornar todos os usuários
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.phone,
        u.avatar_url,
        u.profile_image_url,
        u.bio,
        u.skills,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.cpf,
        u.birth_date,
        u.address,
        u.city,
        u.state
    FROM users u
    ORDER BY u.created_at DESC;
END;
$$;
