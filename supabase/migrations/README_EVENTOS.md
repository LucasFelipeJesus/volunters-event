# 🎯 Correção para Criação de Eventos

## 🚨 Problemas Identificados

### 1. ⚠️ Warning DOM Nesting
**Problema:** `<div> cannot appear as a descendant of <p>`
**Status:** ✅ **CORRIGIDO** - Alterado `<p>` para `<div>` na linha do upload

### 2. 🚫 Erro de Upload de Imagem
**Problema:** `new row violates row-level security policy`
**Causa:** Bucket `event-images` não existe ou sem políticas adequadas

## 🛠️ Soluções Necessárias

### 📝 **Passo 1: Corrigir Estrutura da Tabela Events**
**Arquivo:** `FIX_EVENTS_STRUCTURE.sql`

**O que faz:**
- Adiciona colunas `max_volunteers`, `registration_start_date`, `registration_end_date`
- Cria tabela `event_registrations` para inscrições
- Configura políticas RLS adequadas

### 📸 **Passo 2: Criar Storage para Imagens**
**Arquivo:** `CREATE_EVENT_STORAGE.sql`

**O que faz:**
- Cria bucket `event-images` 
- Configura políticas para upload/download
- Permite acesso público para visualização

### 🔍 **Passo 3: Verificar Estrutura (Opcional)**
**Arquivo:** `CHECK_AND_FIX_EVENTS.sql`

**O que faz:**
- Verifica se tudo está configurado corretamente
- Diagnósticos detalhados

## 📋 Ordem de Execução

1. **Primeiro:** Execute `FIX_EVENTS_STRUCTURE.sql`
2. **Segundo:** Execute `CREATE_EVENT_STORAGE.sql`
3. **Teste:** Tente criar um evento com imagem
4. **Se necessário:** Execute `CHECK_AND_FIX_EVENTS.sql` para diagnóstico

## 🧪 Como Testar

### No Supabase:
```sql
-- Verificar estrutura da tabela events
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events';

-- Verificar bucket
SELECT * FROM storage.buckets WHERE id = 'event-images';

-- Verificar políticas de storage
SELECT * FROM storage.policies WHERE bucket_id = 'event-images';
```

### Na Aplicação:
1. Vá para "Criar Evento"
2. Preencha os campos obrigatórios
3. Adicione uma imagem
4. Clique em "Criar Evento"
5. ✅ Deve funcionar sem erros

## 🎯 Resultados Esperados

### ✅ **Após correção:**
- Formulário de criação de evento funciona
- Upload de imagem funciona
- Eventos são salvos no banco
- Sem warnings no console F12
- Imagens são exibidas corretamente

### 🔧 **Estrutura Esperada:**

**Tabela `events`:**
- Todas as colunas necessárias
- Políticas RLS funcionando

**Storage:**
- Bucket `event-images` criado
- Políticas de upload/download ativas
- Acesso público para visualização

**Tabela `event_registrations`:**
- Para inscrições de voluntários
- Políticas adequadas

## 🚨 Problemas Comuns

### ❌ **Se ainda houver erro 403:**
1. Verifique se bucket foi criado: `SELECT * FROM storage.buckets;`
2. Verifique políticas: `SELECT * FROM storage.policies;`
3. Confirme que usuário está autenticado

### ❌ **Se coluna não existe:**
1. Execute novamente `FIX_EVENTS_STRUCTURE.sql`
2. Verifique estrutura: `\d events` no SQL Editor

### ❌ **Se RLS bloqueia:**
1. Verifique se políticas existem: `SELECT * FROM pg_policies WHERE tablename = 'events';`
2. Se necessário, execute correção de RLS novamente

## 📞 Suporte

Se algum problema persistir:
1. Verifique logs do Supabase Dashboard
2. Confirme que migrações foram aplicadas
3. Teste com usuário admin
4. Verifique permissões do projeto no Supabase
