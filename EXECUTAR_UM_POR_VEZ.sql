-- SCRIPT SUPER SIMPLES - Execute comando por comando
-- No SQL Editor do Supabase

-- 1. Verificar se storage existe
SELECT COUNT(*) as storage_tables 
FROM information_schema.tables 
WHERE table_schema = 'storage';

-- 2. Ver buckets existentes
SELECT * FROM storage.buckets;

-- 3. Criar bucket profile-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-images', 'profile-images', true);

-- 4. Criar bucket event-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true);

-- 5. Verificar se foram criados
SELECT * FROM storage.buckets 
WHERE id IN ('profile-images', 'event-images');

-- 6. Política básica para leitura (execute separadamente)
CREATE POLICY "allow_public_read" ON storage.objects 
FOR SELECT USING (true);

-- 7. Política básica para upload (execute separadamente)
CREATE POLICY "allow_auth_upload" ON storage.objects 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
