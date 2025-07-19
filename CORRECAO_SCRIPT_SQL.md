# 🔧 Correção do Script SQL - Sistema de Formulários

## ❌ **Problema Identificado:**
O script original tentava usar `events.created_by`, mas a tabela `events` tem a coluna `events.admin_id`.

## ✅ **Solução Implementada:**

### **1. Coluna Corrigida:**
- ❌ **Antes:** `events.created_by` 
- ✅ **Depois:** `events.admin_id`

### **2. Scripts Corrigidos:**
Criados dois arquivos com as correções:
- `create_terms_forms_fixed.sql` - Versão completa
- `SCRIPT_SQL_CORRIGIDO.sql` - Versão simplificada

---

## 🚀 **Como Executar o Script:**

### **Método 1: Supabase SQL Editor**
1. **Acesse o Supabase Dashboard**
2. **Vá para SQL Editor**
3. **Copie e cole este script:**

```sql
-- ✅ SCRIPT CORRIGIDO - Execute no Supabase SQL Editor

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
```

4. **Execute em partes:** Execute primeiro as tabelas, depois os índices e políticas

### **Método 2: Executar em Blocos Separados**

#### **Bloco 1: Criar Tabelas**
```sql
-- Execute primeiro
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

CREATE TABLE event_terms_question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES event_terms_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_value VARCHAR(100) NOT NULL,
  option_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
```

#### **Bloco 2: Criar Índices**
```sql
-- Execute depois das tabelas
CREATE INDEX idx_event_terms_questions_event_id ON event_terms_questions(event_id);
CREATE INDEX idx_event_terms_questions_active ON event_terms_questions(is_active) WHERE is_active = true;
CREATE INDEX idx_event_terms_question_options_question_id ON event_terms_question_options(question_id);
CREATE INDEX idx_event_terms_responses_user_event ON event_terms_responses(user_id, event_id);
CREATE INDEX idx_event_terms_responses_question ON event_terms_responses(question_id);
```

#### **Bloco 3: Habilitar RLS**
```sql
-- Execute para habilitar segurança
ALTER TABLE event_terms_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_terms_responses ENABLE ROW LEVEL SECURITY;
```

#### **Bloco 4: Políticas RLS (Execute uma por vez)**
```sql
-- Política 1: Admins podem gerenciar perguntas
CREATE POLICY "Admins can manage terms questions" ON event_terms_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Política 2: Admins do evento podem ver suas perguntas
CREATE POLICY "Event admins can view their event questions" ON event_terms_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_terms_questions.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- Continue com as demais políticas...
```

---

## 🎯 **Principais Correções Aplicadas:**

### **1. Referências de Coluna:**
- ✅ `events.admin_id` (correto)
- ❌ `events.created_by` (não existe)

### **2. Políticas RLS Corrigidas:**
```sql
-- ❌ ANTES (Quebrado)
WHERE events.created_by = auth.uid()

-- ✅ DEPOIS (Funcionando)  
WHERE events.admin_id = auth.uid()
```

### **3. Estrutura da Tabela:**
```sql
-- ✅ Coluna corrigida
admin_id UUID REFERENCES users(id)  -- Correto
-- created_by UUID REFERENCES users(id)  -- Removido
```

---

## ✅ **Validação do Script:**

Após executar, você deve ver estas tabelas criadas:
- `event_terms_questions` - Perguntas dos eventos
- `event_terms_question_options` - Opções das perguntas  
- `event_terms_responses` - Respostas dos usuários

**Teste rápido:**
```sql
-- Verificar se as tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'event_terms%';
```

---

## 🚀 **Próximos Passos:**

1. ✅ **Execute o script corrigido**
2. ✅ **Valide a criação das tabelas**
3. ✅ **Teste a interface no frontend**
4. ✅ **Crie perguntas de exemplo**

O sistema de formulários estará pronto para uso! 🎉
