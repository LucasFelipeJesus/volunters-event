# 🛠️ Correção para Timeout RLS - Sistema de Voluntários

## 🚨 Problema Identificado
O sistema está apresentando erro de **Timeout RLS** causado por dependência circular nas políticas de Row Level Security da tabela `users`.

### 📋 Sintomas:
- Erro: `Timeout RLS - Execute correção SQL`
- Console mostra: `TIMEOUT RLS DETECTADO!`
- Usuários não conseguem acessar seus perfis
- Dashboard não carrega informações do usuário

## 🔧 Soluções Disponíveis

### 1. 🎯 **Correção Sem Schema Auth (RECOMENDADA AGORA)**
**Arquivo:** `FIX_RLS_NO_AUTH_SCHEMA.sql`

**O que faz:**
- Corrige dependência circular SEM usar schema auth
- Funciona com permissões padrão do Supabase
- Usa verificação por email para admins
- Mantém funcionalidades básicas

**Como usar:**
1. **IMPORTANTE:** Edite o arquivo e substitua `'admin@exemplo.com'` pelo seu email real
2. Abra o Supabase Dashboard
3. Vá para SQL Editor
4. Cole o conteúdo de `FIX_RLS_NO_AUTH_SCHEMA.sql`
5. Execute o script

### 2. ⚡ **Correção Ultra Simples (TESTE RÁPIDO)**
**Arquivo:** `FIX_RLS_ULTRA_SIMPLE.sql`

**O que faz:**
- Remove TODAS as políticas problemáticas
- Cria apenas políticas básicas de acesso próprio
- Resolve o timeout imediatamente
- Remove temporariamente funcionalidades admin

**Como usar:**
1. Execute para teste rápido
2. Confirma se o timeout foi resolvido
3. Depois aplique uma solução mais completa

### 3. 🔧 **Correção Completa** 
**Arquivo:** `FIX_RLS_TIMEOUT.sql`

**⚠️ ERRO:** Requer permissões no schema `auth` que não estão disponíveis

### 4. ⚡ **Correção Rápida**
**Arquivo:** `FIX_RLS_SIMPLE.sql`

**O que faz:**
- Remove políticas problemáticas
- Implementa políticas básicas funcionais
- Solução intermediária

### 5. 🚨 **Correção de Emergência (ÚLTIMO RECURSO)**
**Arquivo:** `EMERGENCY_DISABLE_RLS.sql`

**⚠️ ATENÇÃO:** Esta opção **REMOVE COMPLETAMENTE** a segurança RLS!

**Quando usar:**
- Apenas em situação de emergência
- Quando outras soluções não funcionam
- Sistema de produção travado

**Como usar:**
1. Execute apenas se as outras opções falharem
2. **REABILITE RLS** assim que possível
3. Implemente políticas corretas depois

## 📊 Ordem de Execução Recomendada

1. **Primeira tentativa:** `FIX_RLS_ULTRA_SIMPLE.sql` (para teste rápido)
2. **Se funcionou:** `FIX_RLS_NO_AUTH_SCHEMA.sql` (solução completa)
3. **Se falhou:** `FIX_RLS_SIMPLE.sql`  
4. **Emergência:** `EMERGENCY_DISABLE_RLS.sql`

## ⚠️ IMPORTANTE: Configurar Email Admin

Para as correções funcionarem com permissões admin, você deve:

1. **Editar o arquivo** `FIX_RLS_NO_AUTH_SCHEMA.sql`
2. **Substituir** `'admin@exemplo.com'` pelo email real do administrador
3. **Procurar por** estas linhas e alterar:

```sql
-- Linha 24: Na função is_user_admin
'admin@exemplo.com',  -- Substitua pelo email do seu admin

-- Linha 75: No UPDATE para tornar usuário admin
WHERE email IN (
  'admin@exemplo.com',  -- Substitua pelo email do seu admin
```

## 🧪 Como Testar se a Correção Funcionou

### No Supabase SQL Editor:
```sql
-- Teste 1: Verificar se consegue acessar próprio perfil
SELECT * FROM users WHERE id = auth.uid();

-- Teste 2: Verificar políticas ativas
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Teste 3: Verificar funções (apenas para correção completa)
SELECT auth.current_user_role();
SELECT auth.is_admin();
```

### No Sistema:
1. Faça login
2. Acesse o Dashboard
3. Vá para Perfil
4. Verifique se carrega sem erros

## 🎯 Resultados Esperados

### ✅ **Após correção bem-sucedida:**
- Login funciona normalmente
- Dashboard carrega estatísticas
- Perfil do usuário é acessível
- Admins conseguem ver gerenciamento de usuários
- Sem erros de timeout no console

### ❌ **Se ainda houver problemas:**
1. Verifique se o script foi executado completamente
2. Olhe logs do Supabase para erros
3. Execute a próxima solução da lista
4. Entre em contato com suporte se necessário

## 📝 Notas Importantes

- **Backup:** Sempre faça backup antes de executar correções
- **Teste:** Execute primeiro em ambiente de desenvolvimento
- **Monitoramento:** Verifique logs após aplicar correções
- **Segurança:** Reabilite RLS o mais rápido possível se usar a opção de emergência

## 🔄 Reversão

Se algo der errado, você pode reverter executando:
```sql
-- Para voltar às políticas originais
-- (execute as políticas da migração original)
```

## 📞 Suporte

Se nenhuma das soluções funcionar:
1. Verifique os logs detalhados do Supabase
2. Confirme que as tabelas existem
3. Verifique permissões do usuário
4. Considere recriar as tabelas em último caso
