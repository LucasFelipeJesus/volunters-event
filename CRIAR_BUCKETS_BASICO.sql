-- Script básico para criar buckets - SEM extensões
-- Execute este script no SQL Editor do Supabase

-- PASSO 1: Verificar se o esquema storage existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        RAISE EXCEPTION 'Esquema storage não encontrado. O Storage pode não estar habilitado neste projeto.';
    END IF;
END $$;

-- PASSO 2: Verificar se a tabela buckets existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        RAISE EXCEPTION 'Tabela storage.buckets não encontrada. O Storage pode não estar configurado.';
    END IF;
END $$;

-- PASSO 3: Deletar buckets existentes (para recriação limpa)
DELETE FROM storage.buckets WHERE id IN ('profile-images', 'event-images');

-- PASSO 4: Criar buckets básicos
INSERT INTO storage.buckets (id, name, public) VALUES 
('profile-images', 'profile-images', true),
('event-images', 'event-images', true);

-- PASSO 5: Remover políticas existentes (ignorar erros se não existirem)
DO $$
BEGIN
    -- Remover políticas antigas
    DROP POLICY IF EXISTS "Public Access for Profile Images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own profile images" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
    DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
    DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros (políticas podem não existir)
    NULL;
END $$;

-- PASSO 6: Criar políticas básicas e funcionais
-- Acesso público para leitura de todos os buckets
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (true);

-- Upload para usuários autenticados em buckets específicos
CREATE POLICY "Authenticated upload profile images" ON storage.objects
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND bucket_id = 'profile-images'
);

CREATE POLICY "Authenticated upload event images" ON storage.objects
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND bucket_id = 'event-images'
);

-- Update para usuários autenticados
CREATE POLICY "Authenticated update profile images" ON storage.objects
FOR UPDATE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'profile-images'
);

CREATE POLICY "Authenticated update event images" ON storage.objects
FOR UPDATE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'event-images'
);

-- Delete para usuários autenticados
CREATE POLICY "Authenticated delete profile images" ON storage.objects
FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'profile-images'
);

CREATE POLICY "Authenticated delete event images" ON storage.objects
FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND bucket_id = 'event-images'
);

-- PASSO 7: Verificação final - Buckets criados
SELECT 
    'BUCKETS CRIADOS' as status,
    id,
    name,
    public,
    created_at
FROM storage.buckets 
WHERE id IN ('profile-images', 'event-images')
ORDER BY id;

-- PASSO 8: Verificação final - Políticas ativas
SELECT 
    'POLÍTICAS ATIVAS' as status,
    policyname,
    cmd as operacao
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (policyname LIKE '%profile%' OR policyname LIKE '%event%' OR policyname LIKE '%read%')
ORDER BY policyname;

-- PASSO 9: Teste básico de inserção (opcional)
-- Este bloco vai testar se conseguimos inserir na tabela buckets
DO $$
DECLARE
    bucket_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bucket_count 
    FROM storage.buckets 
    WHERE id IN ('profile-images', 'event-images');
    
    RAISE NOTICE 'Total de buckets necessários criados: %', bucket_count;
    
    IF bucket_count = 2 THEN
        RAISE NOTICE '✅ SUCCESS: Todos os buckets foram criados com sucesso!';
    ELSE
        RAISE NOTICE '❌ ERRO: Alguns buckets não foram criados. Count: %', bucket_count;
    END IF;
END $$;
