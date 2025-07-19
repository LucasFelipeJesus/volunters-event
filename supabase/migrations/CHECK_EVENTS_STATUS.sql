-- ================================================================
-- VERIFICAR ESTRUTURA ATUAL DA TABELA EVENTS
-- ================================================================

-- 1. Verificar todas as colunas da tabela events
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar se colunas específicas existem
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'max_volunteers'
    ) THEN '✅ max_volunteers existe' 
    ELSE '❌ max_volunteers NÃO existe' END as max_volunteers_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'registration_start_date'
    ) THEN '✅ registration_start_date existe' 
    ELSE '❌ registration_start_date NÃO existe' END as reg_start_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'registration_end_date'
    ) THEN '✅ registration_end_date existe' 
    ELSE '❌ registration_end_date NÃO existe' END as reg_end_status;

-- 3. Verificar se tabela event_registrations existe
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'event_registrations'
    ) THEN '✅ Tabela event_registrations existe' 
    ELSE '❌ Tabela event_registrations NÃO existe' END as registrations_table_status;

-- 4. Verificar eventos existentes (se houver)
SELECT COUNT(*) as total_eventos FROM events;

-- 5. Verificar estrutura do storage
SELECT 
    id, 
    name, 
    public, 
    file_size_limit,
    array_length(allowed_mime_types, 1) as mime_types_count
FROM storage.buckets 
WHERE id = 'event-images';

-- 6. Verificar políticas de storage
SELECT 
    name, 
    bucket_id, 
    action as operacao,
    target_role as para_quem
FROM storage.policies 
WHERE bucket_id = 'event-images'
ORDER BY action;
