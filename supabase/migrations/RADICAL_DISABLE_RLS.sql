-- ================================================================
-- CORREÇÃO RADICAL - DESABILITAR TEMPORARIAMENTE TODO RLS
-- ================================================================
-- Use apenas se EMERGENCY_FIX_ALL.sql não resolver

-- ATENÇÃO: Isto remove TEMPORARIAMENTE toda a segurança RLS
-- Use apenas para teste e reabilite o mais rápido possível

-- 1. Desabilitar RLS em todas as tabelas principais
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS em tabelas que podem existir
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;

-- 2. Configurar bucket como completamente público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'event-images';

-- 3. Remover TODAS as políticas de storage para evitar conflitos
DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
DROP POLICY IF EXISTS "Event images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event images authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Event images upload" ON storage.objects;
DROP POLICY IF EXISTS "Event images public read" ON storage.objects;
DROP POLICY IF EXISTS "Event images update" ON storage.objects;
DROP POLICY IF EXISTS "Event images delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images public access" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images update" ON storage.objects;
DROP POLICY IF EXISTS "Allow event images delete" ON storage.objects;
DROP POLICY IF EXISTS "Event images - authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Event images - public read" ON storage.objects;
DROP POLICY IF EXISTS "Event images - authenticated manage" ON storage.objects;

-- 4. Criar UMA política simples para storage
CREATE POLICY "Allow all operations on event images"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'event-images')
WITH CHECK (bucket_id = 'event-images');

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '🚨 ATENÇÃO: RLS FOI COMPLETAMENTE DESABILITADO!';
    RAISE NOTICE '⚠️ Esta é uma medida de emergência temporária';
    RAISE NOTICE '🔓 O sistema não tem mais proteções de segurança';
    RAISE NOTICE '⏰ REABILITE RLS o mais rápido possível';
    RAISE NOTICE '✅ Mas agora o sistema deve funcionar sem erros';
END;
$$;

-- ================================================================
-- PARA REABILITAR RLS APÓS TESTE (IMPORTANTE!)
-- ================================================================

-- Quando o sistema estiver funcionando, execute estes comandos para reabilitar:

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_evaluations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- E depois implemente políticas RLS adequadas
