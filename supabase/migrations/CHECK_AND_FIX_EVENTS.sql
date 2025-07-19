-- ================================================================
-- VERIFICAR E CORRIGIR ESTRUTURA PARA EVENTOS
-- ================================================================

-- 1. Verificar se a tabela events existe
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- 2. Verificar se há registros na tabela events
SELECT COUNT(*) as total_events FROM events;

-- 3. Verificar policies da tabela events
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'events';

-- 4. Verificar se RLS está habilitado
SELECT 
  schemaname, 
  tablename, 
  rowsecurity, 
  forcerowsecurity
FROM pg_tables 
WHERE tablename = 'events';

-- ================================================================
-- COMANDOS PARA VERIFICAR STORAGE
-- ================================================================

-- Para verificar buckets (execute no Supabase Dashboard):
-- SELECT * FROM storage.buckets;

-- Para verificar políticas de storage:
-- SELECT * FROM storage.policies;

-- ================================================================
-- CRIAÇÃO DE BUCKET E POLÍTICAS SE NECESSÁRIO
-- ================================================================

-- Criar bucket event-images se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images', 
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de imagens de eventos
CREATE POLICY "Users can upload event images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images' AND
  (storage.foldername(name))[1] = 'event-images'
);

-- Política para permitir leitura pública de imagens de eventos
CREATE POLICY "Public can view event images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Política para permitir exclusão de próprias imagens
CREATE POLICY "Users can delete own event images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-images');

-- ================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Verificação e correção de eventos concluída!';
  RAISE NOTICE '🔍 Execute os SELECT acima para verificar a estrutura';
  RAISE NOTICE '📸 Bucket event-images criado/verificado';
  RAISE NOTICE '🔒 Políticas de storage configuradas';
END;
$$;
