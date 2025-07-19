# Sistema de Formulários nos Termos dos Eventos

## 🎯 **Visão Geral**

Foi implementado um sistema completo de formulários integrado aos termos e condições dos eventos. Agora os administradores podem criar perguntas personalizadas que os voluntários devem responder durante o processo de aceitação dos termos.

---

## 🏗️ **Arquitetura do Sistema**

### **1. Estrutura do Banco de Dados**

#### **Tabela: `event_terms_questions`**
Armazena as perguntas dos eventos:
```sql
- id (UUID, PK)
- event_id (UUID, FK → events)
- question_text (TEXT) - Texto da pergunta
- question_type (VARCHAR) - 'multiple_choice', 'single_choice', 'text'
- is_required (BOOLEAN) - Se a pergunta é obrigatória
- allow_multiple (BOOLEAN) - Para múltipla escolha, permite múltiplas seleções
- question_order (INTEGER) - Ordem de exibição
- is_active (BOOLEAN) - Se a pergunta está ativa
```

#### **Tabela: `event_terms_question_options`**
Armazena as opções das perguntas de múltipla/única escolha:
```sql
- id (UUID, PK)
- question_id (UUID, FK → event_terms_questions)
- option_text (TEXT) - Texto da opção
- option_value (VARCHAR) - Valor interno para processamento
- option_order (INTEGER) - Ordem de exibição
```

#### **Tabela: `event_terms_responses`**
Armazena as respostas dos usuários:
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- event_id (UUID, FK → events)
- question_id (UUID, FK → event_terms_questions)
- selected_options (JSONB) - Array de option_ids selecionadas
- text_response (TEXT) - Para perguntas de texto livre
- responded_at (TIMESTAMP)
```

---

## 🎨 **Interface do Usuário**

### **Para Voluntários:**

#### **1. Modal de Termos Atualizado**
- **Seção de Termos**: Exibe o conteúdo original dos termos
- **Seção de Formulário**: Mostra as perguntas quando existem
- **Validação**: Bloqueia aceitação até todas as respostas obrigatórias serem preenchidas

#### **2. Tipos de Pergunta Suportados:**

##### **📋 Múltipla Escolha (allow_multiple = true)**
```
□ Parrilla
□ Fogo de chão  
□ Pitsmoker (defumação)
□ Burger
□ Carreteiro
```

##### **🎯 Escolha Única (allow_multiple = false)**
```
○ Iniciante
○ Básico  
○ Intermediário
○ Avançado
```

##### **✏️ Texto Livre**
```
┌─────────────────────────────────────┐
│ Digite sua resposta aqui...         │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### **Para Administradores:**

#### **Interface de Gerenciamento** (`EventTermsManager.tsx`)
- ✅ **Criar Perguntas**: Formulário completo para novas perguntas
- ✅ **Editar Opções**: Adicionar/remover opções de múltipla escolha
- ✅ **Ordenação**: Controle da ordem de exibição
- ✅ **Ativação/Desativação**: Controle de visibilidade
- ✅ **Exclusão**: Remoção segura com confirmação

---

## 🔧 **Funcionalidades Técnicas**

### **1. Validação Inteligente**
```typescript
// Validação automática conforme tipo de pergunta
if (question.is_required) {
  if (question.question_type === 'text') {
    // Valida se texto não está vazio
    if (!response.textResponse?.trim()) {
      errors.push('Resposta em texto obrigatória')
    }
  } else {
    // Valida se pelo menos uma opção foi selecionada
    if (response.selectedOptions.length === 0) {
      errors.push('Selecione pelo menos uma opção')
    }
  }
}
```

### **2. Scroll Forçado Mantido**
O sistema mantém a funcionalidade original de scroll obrigatório nos termos, adicionando validação do formulário:

```typescript
const canAccept = hasAccepted && hasScrolledToEnd && formIsValid
```

### **3. Armazenamento de Respostas**
```typescript
// Salva respostas com estrutura flexível
const responseData = {
  user_id: user.id,
  event_id: eventId,
  question_id: questionId,
  selected_options: selectedOptionIds, // Array JSON
  text_response: textResponse || null,
  responded_at: new Date().toISOString()
}
```

---

## 📊 **Fluxo de Uso**

### **1. Administrador Cria Perguntas**
```mermaid
Admin → EventTermsManager → Criar Pergunta → Adicionar Opções → Ativar
```

### **2. Voluntário Se Inscreve**
```mermaid
Voluntário → Clica "Inscrever-se" → Modal de Termos → 
Lê Termos → Responde Formulário → Aceita → Inscrição Confirmada
```

### **3. Processamento de Dados**
```mermaid
Respostas → Banco de Dados → Relatórios → Análise → Melhores Decisões
```

---

## 🎯 **Exemplo Prático: Evento de Churrasco**

### **Pergunta 1: Preferências de Área**
```
Qual área de sua preferência? Pode escolher mais de uma opção 
(não é certeza que você será alocado nessa área, é apenas um indicativo)

☑️ Parrilla
☑️ Fogo de chão
☐ Pitsmoker (defumação)
☐ Burger
☐ Carreteiro
☐ Pão de alho
☐ Sobremesa
☐ Tortilla
☐ Macarrão campeiro
☐ Não tenho preferência
```

### **Pergunta 2: Nível de Experiência**
```
Qual seu nível de experiência com churrasco?

● Iniciante - primeira vez
○ Básico - já participei algumas vezes  
○ Intermediário - tenho boa experiência
○ Avançado - muito experiente
```

### **Pergunta 3: Observações**
```
Há algo específico que você gostaria de compartilhar sobre suas 
habilidades, restrições alimentares, ou outras observações?

┌─────────────────────────────────────────────────────────────┐
│ Sou vegetariano e tenho experiência com churrascos veganos.│
│ Posso ajudar com preparação de opções vegetarianas.        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 **Benefícios do Sistema**

### **🎯 Para Organizadores:**
- **Dados Estruturados**: Informações organizadas para melhor planejamento
- **Alocação Inteligente**: Distribuição baseada em preferências e experiência
- **Flexibilidade**: Perguntas customizáveis para cada tipo de evento
- **Relatórios**: Base de dados para análises futuras

### **✨ Para Voluntários:**
- **Processo Integrado**: Formulário junto com os termos, sem etapas extras
- **Interface Intuitiva**: Tipos variados de pergunta com validação clara
- **Transparência**: Sabem exatamente que informações estão fornecendo

### **🚀 Para o Sistema:**
- **Escalabilidade**: Estrutura suporta qualquer tipo de evento
- **Manutenibilidade**: Código modular e bem organizado
- **Segurança**: RLS (Row Level Security) implementado
- **Performance**: Queries otimizadas com índices adequados

---

## 🔄 **Processo de Implementação Concluído**

### **✅ Estrutura de Dados**
- [x] Tabelas criadas com relacionamentos corretos
- [x] Políticas RLS implementadas  
- [x] Índices para performance adicionados

### **✅ Interface de Usuário**
- [x] `TermsQuestionsForm` - Componente de formulário
- [x] `EventTermsModal` - Modal atualizado com formulário
- [x] `EventTermsManager` - Interface administrativa

### **✅ Lógica de Negócio**
- [x] Validação de formulários
- [x] Armazenamento de respostas
- [x] Integração com processo de inscrição

### **✅ Funcionalidades Avançadas**
- [x] Múltiplos tipos de pergunta
- [x] Validação obrigatória/opcional
- [x] Scroll forçado mantido
- [x] Interface administrativa completa

---

## 🚀 **Como Usar**

### **1. Para Criar Perguntas:**
1. Acesse a interface de administração de eventos
2. Abra o `EventTermsManager` para o evento desejado
3. Clique em "Adicionar Nova Pergunta"
4. Configure tipo, obrigatoriedade e opções
5. Salve e ative a pergunta

### **2. Para os Voluntários:**
1. As perguntas aparecerão automaticamente no modal de termos
2. Scroll obrigatório nos termos mantido
3. Formulário deve ser preenchido antes da aceitação
4. Sistema valida respostas obrigatórias automaticamente

---

## 🎉 **Resultado Final**

O sistema agora oferece uma experiência completa e integrada:

**🔥 Antes:** Apenas termos de texto para aceitar
**🌟 Depois:** Termos + Formulário inteligente com validação

Isso permite coleta de dados valiosos para melhor organização dos eventos, mantendo a experiência do usuário fluida e intuitiva! 🎯✨
