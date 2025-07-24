-- ================================================================
-- IMPLEMENTAR SISTEMA COMPLETO DE TERMOS E QUESTIONÁRIOS
-- ================================================================

-- 1. Criar tabela de termos dos eventos
CREATE TABLE IF NOT EXISTS event_terms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    terms_content TEXT NOT NULL,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 2. Criar tabela de perguntas dos termos
CREATE TABLE IF NOT EXISTS event_terms_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'single_choice', 'text')),
    is_required BOOLEAN DEFAULT true,
    allow_multiple BOOLEAN DEFAULT false,
    question_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 3. Criar tabela de opções das perguntas
CREATE TABLE IF NOT EXISTS event_terms_question_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES event_terms_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_value TEXT NOT NULL,
    option_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Criar tabela de respostas dos usuários
CREATE TABLE IF NOT EXISTS event_terms_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES event_terms_questions(id) ON DELETE CASCADE,
    selected_options TEXT[], -- Array de option_ids
    text_response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id, question_id)
);

-- 5. Criar tabela de aceitação dos termos
CREATE TABLE IF NOT EXISTS event_terms_acceptance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    terms_accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    UNIQUE(user_id, event_id)
);

-- ================================================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_event_terms_event_id ON event_terms(event_id);
CREATE INDEX IF NOT EXISTS idx_event_terms_questions_event_id ON event_terms_questions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_terms_question_options_question_id ON event_terms_question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_event_terms_responses_user_event ON event_terms_responses(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_terms_acceptance_user_event ON event_terms_acceptance(user_id, event_id);

-- ================================================================
-- CONFIGURAR RLS (ROW LEVEL SECURITY)
-- ================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE event_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Políticas para event_terms
CREATE POLICY "Usuários podem visualizar termos de eventos ativos" ON event_terms
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins podem gerenciar termos" ON event_terms
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('admin', 'captain')
    ));

-- Políticas para event_terms_questions
CREATE POLICY "Usuários podem visualizar perguntas ativas" ON event_terms_questions
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins podem gerenciar perguntas" ON event_terms_questions
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('admin', 'captain')
    ));

-- Políticas para event_terms_question_options
CREATE POLICY "Usuários podem visualizar opções ativas" ON event_terms_question_options
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins podem gerenciar opções" ON event_terms_question_options
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('admin', 'captain')
    ));

-- Políticas para event_terms_responses
CREATE POLICY "Usuários podem visualizar suas próprias respostas" ON event_terms_responses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar/atualizar suas próprias respostas" ON event_terms_responses
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins podem visualizar todas as respostas" ON event_terms_responses
    FOR SELECT USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('admin', 'captain')
    ));

-- Políticas para event_terms_acceptance
CREATE POLICY "Usuários podem visualizar sua própria aceitação" ON event_terms_acceptance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar/atualizar sua própria aceitação" ON event_terms_acceptance
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins podem visualizar todas as aceitações" ON event_terms_acceptance
    FOR SELECT USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('admin', 'captain')
    ));

-- ================================================================
-- CRIAR TRIGGERS PARA UPDATED_AT
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_event_terms_updated_at BEFORE UPDATE ON event_terms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_terms_questions_updated_at BEFORE UPDATE ON event_terms_questions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================

DO $$
DECLARE
    table_count integer;
    policy_count integer;
BEGIN
    -- Contar tabelas criadas
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'event_terms%';
    
    -- Contar políticas criadas
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename LIKE 'event_terms%';
    
    RAISE NOTICE '✅ Sistema de Termos implementado!';
    RAISE NOTICE '📊 Tabelas criadas: %', table_count;
    RAISE NOTICE '🔐 Políticas RLS criadas: %', policy_count;
    
    IF table_count >= 5 AND policy_count >= 10 THEN
        RAISE NOTICE '🎯 Sistema de Termos está completo!';
    ELSE
        RAISE NOTICE '⚠️ Possíveis problemas na implementação';
    END IF;
END;
$$;
