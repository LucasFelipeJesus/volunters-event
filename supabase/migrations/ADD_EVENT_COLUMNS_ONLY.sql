-- ================================================================
-- ADICIONAR APENAS COLUNAS NECESSÁRIAS PARA EVENTS
-- ================================================================

-- 1. Adicionar coluna max_volunteers se não existir
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS max_volunteers integer DEFAULT 10;

-- 2. Adicionar colunas de registro se não existirem
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_start_date date;

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_end_date date;

-- 3. Atualizar valores para eventos existentes
UPDATE events 
SET max_volunteers = COALESCE(max_volunteers, 10)
WHERE max_volunteers IS NULL;

UPDATE events 
SET registration_start_date = COALESCE(registration_start_date, CURRENT_DATE)
WHERE registration_start_date IS NULL;

UPDATE events 
SET registration_end_date = COALESCE(registration_end_date, event_date - INTERVAL '1 day')
WHERE registration_end_date IS NULL;

-- ================================================================
-- VERIFICAÇÃO SIMPLES
-- ================================================================

DO $$
DECLARE
    col_count integer;
BEGIN
    -- Contar colunas adicionadas
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name IN ('max_volunteers', 'registration_start_date', 'registration_end_date');
    
    RAISE NOTICE '✅ Colunas de eventos verificadas!';
    RAISE NOTICE '📊 Colunas encontradas: %', col_count;
    
    IF col_count >= 3 THEN
        RAISE NOTICE '🎯 Tabela events está completa!';
    ELSE
        RAISE NOTICE '⚠️ Algumas colunas podem estar faltando';
    END IF;
END;
$$;
