-- Execute este script no SQL Editor do Supabase
-- Sistema de Formulários para Termos - Versão Corrigida

-- 1. Tabela para perguntas dos termos
CREATE TABLE event_terms_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL DEFAULT 'multiple_choice',
  is_required BOOLEAN NOT NULL DEFAULT true,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  question_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  admin_id UUID REFERENCES users(id)
);

-- 2. Tabela para opções das perguntas
CREATE TABLE event_terms_question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES event_terms_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_value VARCHAR(100) NOT NULL,
  option_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela para respostas dos usuários
CREATE TABLE event_terms_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES event_terms_questions(id) ON DELETE CASCADE,
  selected_options JSONB NOT NULL DEFAULT '[]',
  text_response TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id, question_id)
);

-- 4. Índices para performance
CREATE INDEX idx_event_terms_questions_event_id ON event_terms_questions(event_id);
CREATE INDEX idx_event_terms_questions_active ON event_terms_questions(is_active) WHERE is_active = true;
CREATE INDEX idx_event_terms_question_options_question_id ON event_terms_question_options(question_id);
CREATE INDEX idx_event_terms_responses_user_event ON event_terms_responses(user_id, event_id);
CREATE INDEX idx_event_terms_responses_question ON event_terms_responses(question_id);

-- 5. Habilitar RLS
ALTER TABLE event_terms_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_question_options ENABLE ROW LEVEL SECURITY;  
ALTER TABLE event_terms_responses ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para event_terms_questions

-- Administradores podem fazer tudo
CREATE POLICY "Admins can manage terms questions" ON event_terms_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Administradores do evento podem ver perguntas dos seus eventos  
CREATE POLICY "Event admins can view their event questions" ON event_terms_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_terms_questions.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- Voluntários podem ver perguntas ativas
CREATE POLICY "Volunteers can view active questions" ON event_terms_questions
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'volunteer'
    )
  );

-- 7. Políticas RLS para event_terms_question_options

-- Administradores podem fazer tudo
CREATE POLICY "Admins can manage question options" ON event_terms_question_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Administradores do evento podem ver opções das perguntas dos seus eventos
CREATE POLICY "Event admins can view their event question options" ON event_terms_question_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_terms_questions etq
      JOIN events e ON e.id = etq.event_id
      WHERE etq.id = event_terms_question_options.question_id 
      AND e.admin_id = auth.uid()
    )
  );

-- Voluntários podem ver opções ativas
CREATE POLICY "Volunteers can view active options" ON event_terms_question_options
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'volunteer'
    ) AND
    EXISTS (
      SELECT 1 FROM event_terms_questions etq
      WHERE etq.id = event_terms_question_options.question_id 
      AND etq.is_active = true
    )
  );

-- 8. Políticas RLS para event_terms_responses

-- Usuários podem gerenciar suas próprias respostas
CREATE POLICY "Users can manage their own responses" ON event_terms_responses
  FOR ALL USING (user_id = auth.uid());

-- Administradores podem ver todas as respostas
CREATE POLICY "Admins can view all responses" ON event_terms_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Administradores do evento podem ver respostas dos seus eventos
CREATE POLICY "Event admins can view their event responses" ON event_terms_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_terms_responses.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- 9. Função para trigger de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 10. Trigger para updated_at
CREATE TRIGGER update_event_terms_questions_updated_at
  BEFORE UPDATE ON event_terms_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
