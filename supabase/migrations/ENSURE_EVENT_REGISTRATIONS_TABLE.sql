-- ================================================================
-- VERIFICAR E CRIAR TABELA DE REGISTROS DE EVENTOS
-- ================================================================

-- 1. Verificar se a tabela event_registrations existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'event_registrations'
    ) THEN
        -- Criar tabela event_registrations se não existir
        CREATE TABLE event_registrations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'withdrawn')) DEFAULT 'confirmed',
            terms_accepted BOOLEAN DEFAULT false,
            terms_accepted_at TIMESTAMP WITH TIME ZONE,
            registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            notes TEXT,
            UNIQUE(event_id, user_id)
        );

        -- Criar índices
        CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
        CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);
        CREATE INDEX idx_event_registrations_status ON event_registrations(status);

        -- Habilitar RLS
        ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

        -- Políticas RLS
        CREATE POLICY "Usuários podem ver suas próprias inscrições" ON event_registrations
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Usuários podem criar suas próprias inscrições" ON event_registrations
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Usuários podem atualizar suas próprias inscrições" ON event_registrations
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Admins podem ver todas as inscrições" ON event_registrations
            FOR SELECT USING (auth.uid() IN (
                SELECT id FROM users WHERE role IN ('admin', 'captain')
            ));

        CREATE POLICY "Admins podem gerenciar todas as inscrições" ON event_registrations
            FOR ALL USING (auth.uid() IN (
                SELECT id FROM users WHERE role IN ('admin', 'captain')
            ));

        -- Trigger para updated_at
        CREATE TRIGGER update_event_registrations_updated_at 
            BEFORE UPDATE ON event_registrations 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        RAISE NOTICE '✅ Tabela event_registrations criada com sucesso!';
    ELSE
        -- Verificar se colunas terms_accepted e terms_accepted_at existem
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'event_registrations' 
            AND column_name = 'terms_accepted'
        ) THEN
            ALTER TABLE event_registrations ADD COLUMN terms_accepted BOOLEAN DEFAULT false;
            RAISE NOTICE '✅ Coluna terms_accepted adicionada!';
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'event_registrations' 
            AND column_name = 'terms_accepted_at'
        ) THEN
            ALTER TABLE event_registrations ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE '✅ Coluna terms_accepted_at adicionada!';
        END IF;

        RAISE NOTICE '✅ Tabela event_registrations já existe e foi verificada!';
    END IF;
END;
$$;
