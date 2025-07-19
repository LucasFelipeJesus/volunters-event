-- ==========================================
-- RESET EXTREMO - APENAS SE O NORMAL FALHAR
-- ==========================================
-- Este script APAGA E RECRIA a tabela users
-- completamente do zero. Use apenas em último caso!
-- ==========================================

-- ATENÇÃO: ESTE SCRIPT APAGA TODOS OS DADOS!
-- Execute apenas se o RESET_USERS_COMPLETE.sql não funcionar

-- 1. FAZER BACKUP DOS DADOS
CREATE TABLE users_backup_emergency AS SELECT * FROM users;

-- 2. REMOVER TODAS AS DEPENDÊNCIAS PRIMEIRO
-- (Comentado para não apagar dados relacionados)
-- DELETE FROM team_members WHERE user_id IN (SELECT id FROM users);
-- DELETE FROM evaluations WHERE volunteer_id IN (SELECT id FROM users) OR captain_id IN (SELECT id FROM users);
-- DELETE FROM admin_evaluations WHERE captain_id IN (SELECT id FROM users) OR admin_id IN (SELECT id FROM users);

-- 3. DESABILITAR RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 4. APAGAR TABELA COMPLETAMENTE
DROP TABLE IF EXISTS users CASCADE;

-- 5. RECRIAR TABELA DO ZERO (versão limpa da migration original)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'captain', 'admin')),
  bio text,
  skills text[],
  availability text[],
  is_first_login boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Campos adicionais da migration expand_user_profile
  cpf text,
  birth_date date,
  address text,
  city text,
  state text,
  postal_code text,
  emergency_contact_name text,
  emergency_contact_phone text,
  vehicle_type text CHECK (vehicle_type IN ('car', 'motorcycle', 'bicycle', 'none')),
  vehicle_model text,
  vehicle_plate text,
  has_drivers_license boolean DEFAULT false,
  profile_image_url text
);

-- 6. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state);

-- 7. ATIVAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 8. CRIAR APENAS 2 POLÍTICAS SUPER SIMPLES
CREATE POLICY "users_own_data" ON users
    FOR ALL 
    USING (auth.uid() = id);

CREATE POLICY "admin_all_data" ON users
    FOR ALL 
    USING (
        (auth.jwt() ->> 'role') = 'admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- 9. RESTAURAR DADOS DO BACKUP (se existir)
-- INSERT INTO users SELECT * FROM users_backup_emergency;
-- DROP TABLE users_backup_emergency;

-- 10. VERIFICAR
SELECT 'RESET EXTREMO CONCLUÍDO!' as status,
       'Tabela recriada do zero com apenas 2 políticas' as info;
