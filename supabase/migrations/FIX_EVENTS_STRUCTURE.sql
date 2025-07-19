-- ================================================================
-- CORRIGIR ESTRUTURA DA TABELA EVENTS
-- ================================================================

-- 1. Adicionar colunas que podem estar faltando na tabela events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS max_volunteers integer DEFAULT 10;

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_start_date date;

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_end_date date;

-- 2. Atualizar valores padrão para eventos existentes
UPDATE events 
SET max_volunteers = COALESCE(max_volunteers, max_teams * 5)
WHERE max_volunteers IS NULL;

UPDATE events 
SET registration_start_date = COALESCE(registration_start_date, created_at::date)
WHERE registration_start_date IS NULL;

UPDATE events 
SET registration_end_date = COALESCE(registration_end_date, event_date - INTERVAL '1 day')
WHERE registration_end_date IS NULL;

-- 3. Verificar se a tabela event_registrations existe (para registros de voluntários)
CREATE TABLE IF NOT EXISTS event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  terms_accepted boolean DEFAULT false,
  terms_accepted_at timestamptz,
  registered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 4. Habilitar RLS na nova tabela
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para event_registrations
CREATE POLICY "Users can read own registrations"
  ON event_registrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own registrations"
  ON event_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own registrations"
  ON event_registrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all registrations"
  ON event_registrations
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.is_user_admin(auth.jwt()->>'email')
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    public.is_user_admin(auth.jwt()->>'email')
  );

-- ================================================================
-- VERIFICAÇÃO DA ESTRUTURA
-- ================================================================

DO $$
DECLARE
    col_count integer;
    reg_table_exists boolean;
BEGIN
    -- Verificar colunas da tabela events
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name IN ('max_volunteers', 'registration_start_date', 'registration_end_date');
    
    -- Verificar se tabela event_registrations existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'event_registrations'
    ) INTO reg_table_exists;
    
    RAISE NOTICE '✅ Estrutura de eventos corrigida!';
    RAISE NOTICE '📊 Colunas adicionadas à events: %', col_count;
    RAISE NOTICE '📋 Tabela event_registrations existe: %', reg_table_exists;
    RAISE NOTICE '🔒 Políticas RLS configuradas';
END;
$$;

-- ================================================================
-- COMANDOS DE VERIFICAÇÃO
-- ================================================================

-- Verificar estrutura da tabela events:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'events' 
-- ORDER BY ordinal_position;

-- Verificar eventos existentes:
-- SELECT id, title, max_volunteers, registration_start_date, registration_end_date 
-- FROM events;
