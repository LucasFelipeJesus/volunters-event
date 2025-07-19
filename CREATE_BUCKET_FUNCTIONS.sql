-- Função para criar buckets automaticamente via RPC
-- Execute este script no SQL Editor do Supabase para criar a função

-- 1. Criar função para criar bucket se não existir
CREATE OR REPLACE FUNCTION create_bucket_if_not_exists(
    bucket_id TEXT,
    bucket_name TEXT,
    is_public BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bucket_exists BOOLEAN;
    result JSON;
BEGIN
    -- Verificar se o bucket já existe
    SELECT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = bucket_id
    ) INTO bucket_exists;
    
    IF bucket_exists THEN
        result := json_build_object(
            'success', true,
            'message', 'Bucket já existe',
            'bucket_id', bucket_id,
            'created', false
        );
    ELSE
        -- Tentar criar o bucket
        BEGIN
            INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
            VALUES (
                bucket_id, 
                bucket_name, 
                is_public,
                5242880, -- 5MB
                ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            );
            
            result := json_build_object(
                'success', true,
                'message', 'Bucket criado com sucesso',
                'bucket_id', bucket_id,
                'created', true
            );
            
        EXCEPTION WHEN OTHERS THEN
            result := json_build_object(
                'success', false,
                'message', 'Erro ao criar bucket: ' || SQLERRM,
                'bucket_id', bucket_id,
                'created', false
            );
        END;
    END IF;
    
    RETURN result;
END;
$$;

-- 2. Função para verificar e criar todos os buckets necessários
CREATE OR REPLACE FUNCTION setup_storage_buckets()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_result JSON;
    event_result JSON;
    final_result JSON;
BEGIN
    -- Criar bucket para imagens de perfil
    SELECT create_bucket_if_not_exists('profile-images', 'profile-images', true)
    INTO profile_result;
    
    -- Criar bucket para imagens de eventos
    SELECT create_bucket_if_not_exists('event-images', 'event-images', true)
    INTO event_result;
    
    -- Criar políticas básicas se não existirem
    BEGIN
        -- Política de leitura pública
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' 
            AND tablename = 'objects' 
            AND policyname = 'Public read access'
        ) THEN
            EXECUTE 'CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (true)';
        END IF;
        
        -- Política de upload para usuários autenticados
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' 
            AND tablename = 'objects' 
            AND policyname = 'Authenticated upload'
        ) THEN
            EXECUTE 'CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
        END IF;
        
        -- Política de update para usuários autenticados
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' 
            AND tablename = 'objects' 
            AND policyname = 'Authenticated update'
        ) THEN
            EXECUTE 'CREATE POLICY "Authenticated update" ON storage.objects FOR UPDATE USING (auth.role() = ''authenticated'')';
        END IF;
        
        -- Política de delete para usuários autenticados
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' 
            AND tablename = 'objects' 
            AND policyname = 'Authenticated delete'
        ) THEN
            EXECUTE 'CREATE POLICY "Authenticated delete" ON storage.objects FOR DELETE USING (auth.role() = ''authenticated'')';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar erros de políticas (podem já existir)
        NULL;
    END;
    
    -- Resultado final
    final_result := json_build_object(
        'success', true,
        'message', 'Setup de storage completo',
        'profile_bucket', profile_result,
        'event_bucket', event_result,
        'policies_created', true
    );
    
    RETURN final_result;
END;
$$;

-- 3. Executar setup automático
SELECT setup_storage_buckets();

-- 4. Verificar resultado
SELECT 
    'Buckets após setup:' as info,
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets
WHERE id IN ('profile-images', 'event-images')
ORDER BY id;
