# Script para Popular Perguntas dos Termos - Exemplo Churrasco

Este script pode ser executado no console do Supabase para criar perguntas de exemplo para um evento de churrasco.

## Exemplo: Evento de Churrasco

```sql
-- 1. Inserir pergunta sobre preferências de área
INSERT INTO event_terms_questions (
    event_id, 
    question_text, 
    question_type, 
    allow_multiple, 
    question_order, 
    is_required
) VALUES (
    'SEU_EVENT_ID_AQUI', -- Substituir pelo ID real do evento
    'Qual área de sua preferência? Pode escolher mais de uma opção (não é certeza que você será alocado nessa área, é apenas um indicativo)',
    'multiple_choice',
    true, -- Permite múltiplas seleções
    1,
    true -- Obrigatória
) RETURNING id;

-- 2. Inserir opções para a pergunta (usar o ID retornado acima)
INSERT INTO event_terms_question_options (question_id, option_text, option_value, option_order) VALUES 
    ('ID_DA_PERGUNTA_AQUI', 'Parrilla', 'parrilla', 1),
    ('ID_DA_PERGUNTA_AQUI', 'Fogo de chão', 'fogo_chao', 2),
    ('ID_DA_PERGUNTA_AQUI', 'Pitsmoker (defumação)', 'pitsmoker', 3),
    ('ID_DA_PERGUNTA_AQUI', 'Burger', 'burger', 4),
    ('ID_DA_PERGUNTA_AQUI', 'Carreteiro', 'carreteiro', 5),
    ('ID_DA_PERGUNTA_AQUI', 'Pão de alho', 'pao_alho', 6),
    ('ID_DA_PERGUNTA_AQUI', 'Sobremesa', 'sobremesa', 7),
    ('ID_DA_PERGUNTA_AQUI', 'Tortilla', 'tortilla', 8),
    ('ID_DA_PERGUNTA_AQUI', 'Macarrão campeiro', 'macarrao_campeiro', 9),
    ('ID_DA_PERGUNTA_AQUI', 'Não tenho preferência', 'sem_preferencia', 10);

-- 3. Pergunta adicional sobre experiência
INSERT INTO event_terms_questions (
    event_id, 
    question_text, 
    question_type, 
    allow_multiple, 
    question_order, 
    is_required
) VALUES (
    'SEU_EVENT_ID_AQUI',
    'Qual seu nível de experiência com churrasco?',
    'single_choice',
    false,
    2,
    true
) RETURNING id;

-- 4. Opções para experiência
INSERT INTO event_terms_question_options (question_id, option_text, option_value, option_order) VALUES 
    ('ID_DA_PERGUNTA_EXPERIENCIA_AQUI', 'Iniciante - primeira vez', 'iniciante', 1),
    ('ID_DA_PERGUNTA_EXPERIENCIA_AQUI', 'Básico - já participei algumas vezes', 'basico', 2),
    ('ID_DA_PERGUNTA_EXPERIENCIA_AQUI', 'Intermediário - tenho boa experiência', 'intermediario', 3),
    ('ID_DA_PERGUNTA_EXPERIENCIA_AQUI', 'Avançado - muito experiente', 'avancado', 4);

-- 5. Pergunta sobre disponibilidade de horário
INSERT INTO event_terms_questions (
    event_id, 
    question_text, 
    question_type, 
    allow_multiple, 
    question_order, 
    is_required
) VALUES (
    'SEU_EVENT_ID_AQUI',
    'Em quais horários você pode contribuir? (Múltiplas seleções permitidas)',
    'multiple_choice',
    true,
    3,
    true
) RETURNING id;

-- 6. Opções para horários
INSERT INTO event_terms_question_options (question_id, option_text, option_value, option_order) VALUES 
    ('ID_DA_PERGUNTA_HORARIO_AQUI', 'Preparação inicial (manhã cedo)', 'preparacao_manha', 1),
    ('ID_DA_PERGUNTA_HORARIO_AQUI', 'Almoço (meio-dia)', 'almoco', 2),
    ('ID_DA_PERGUNTA_HORARIO_AQUI', 'Tarde', 'tarde', 3),
    ('ID_DA_PERGUNTA_HORARIO_AQUI', 'Jantar', 'jantar', 4),
    ('ID_DA_PERGUNTA_HORARIO_AQUI', 'Limpeza final', 'limpeza', 5),
    ('ID_DA_PERGUNTA_HORARIO_AQUI', 'Disponível o dia todo', 'dia_todo', 6);

-- 7. Pergunta de texto livre para observações
INSERT INTO event_terms_questions (
    event_id, 
    question_text, 
    question_type, 
    allow_multiple, 
    question_order, 
    is_required
) VALUES (
    'SEU_EVENT_ID_AQUI',
    'Há algo específico que você gostaria de compartilhar sobre suas habilidades, restrições alimentares, ou outras observações?',
    'text',
    false,
    4,
    false -- Não obrigatória
);
```

## Como usar:

1. **Substituir os IDs**: 
   - `SEU_EVENT_ID_AQUI` pelo ID real do evento
   - `ID_DA_PERGUNTA_AQUI` pelos IDs retornados nas queries de inserção

2. **Executar no Supabase SQL Editor**:
   - Acesse o painel administrativo do Supabase
   - Vá para SQL Editor
   - Execute cada bloco de SQL sequencialmente

3. **Verificar no sistema**:
   - As perguntas aparecerão automaticamente no modal de termos
   - Administradores podem gerenciar via interface

## Estrutura das Perguntas Criadas:

### **1. Preferência de Área (Múltipla Escolha)**
- ✅ Permite múltiplas seleções
- ✅ Obrigatória
- 🍖 Opções: Parrilla, Fogo de chão, Pitsmoker, Burger, etc.

### **2. Nível de Experiência (Escolha Única)**
- ✅ Apenas uma seleção
- ✅ Obrigatória  
- 📊 Opções: Iniciante, Básico, Intermediário, Avançado

### **3. Disponibilidade de Horário (Múltipla Escolha)**
- ✅ Permite múltiplas seleções
- ✅ Obrigatória
- ⏰ Opções: Manhã, Almoço, Tarde, Jantar, Limpeza, Dia todo

### **4. Observações (Texto Livre)**
- ✅ Campo aberto para texto
- ❌ Não obrigatória
- 📝 Para comentários e observações especiais

## Benefícios:

- **📋 Coleta Organizada**: Informações estruturadas dos voluntários
- **🎯 Melhor Alocação**: Dados para otimizar distribuição de tarefas
- **📊 Relatórios**: Dados para análise e melhoria de eventos futuros
- **💡 Flexibilidade**: Sistema adaptável para diferentes tipos de evento
