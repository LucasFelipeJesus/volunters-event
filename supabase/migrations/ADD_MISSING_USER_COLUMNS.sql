-- Migration para adicionar colunas faltantes na tabela users
-- Para resolver o erro "Could not find the 'address' column"

-- Adicionar colunas de endereço e informações pessoais se não existirem
DO $$ 
BEGIN
    -- CPF
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'cpf') THEN
        ALTER TABLE users ADD COLUMN cpf text;
    END IF;

    -- Data de nascimento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'birth_date') THEN
        ALTER TABLE users ADD COLUMN birth_date date;
    END IF;

    -- Endereço
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address') THEN
        ALTER TABLE users ADD COLUMN address text;
    END IF;

    -- Cidade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
        ALTER TABLE users ADD COLUMN city text;
    END IF;

    -- Estado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'state') THEN
        ALTER TABLE users ADD COLUMN state text;
    END IF;

    -- CEP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'postal_code') THEN
        ALTER TABLE users ADD COLUMN postal_code text;
    END IF;

    -- Contato de emergência - nome
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emergency_contact_name') THEN
        ALTER TABLE users ADD COLUMN emergency_contact_name text;
    END IF;

    -- Contato de emergência - telefone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emergency_contact_phone') THEN
        ALTER TABLE users ADD COLUMN emergency_contact_phone text;
    END IF;

    -- Tipo de veículo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vehicle_type') THEN
        ALTER TABLE users ADD COLUMN vehicle_type text CHECK (vehicle_type IN ('car', 'motorcycle', 'bicycle', 'none'));
    END IF;

    -- Modelo do veículo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vehicle_model') THEN
        ALTER TABLE users ADD COLUMN vehicle_model text;
    END IF;

    -- Placa do veículo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vehicle_plate') THEN
        ALTER TABLE users ADD COLUMN vehicle_plate text;
    END IF;

    -- Carteira de habilitação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'has_drivers_license') THEN
        ALTER TABLE users ADD COLUMN has_drivers_license boolean DEFAULT false;
    END IF;

    -- URL da imagem de perfil
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_image_url') THEN
        ALTER TABLE users ADD COLUMN profile_image_url text;
    END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state);
CREATE INDEX IF NOT EXISTS idx_users_postal_code ON users(postal_code);

-- Comentário para documentar a migração
COMMENT ON TABLE users IS 'Tabela de usuários expandida com informações de perfil completo, endereço e veículo';
