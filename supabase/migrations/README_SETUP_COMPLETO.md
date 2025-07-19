# 🚀 GUIA COMPLETO: SETUP DO ZERO

## 📋 **Ordem de Execução:**

### **PASSO 1: Setup Completo**
```sql
-- Execute: SETUP_COMPLETO_DO_ZERO.sql
-- Este script cria todo o sistema desde o início
```

### **PASSO 2: Configurar Admin**
```sql
-- Execute: SETUP_ADMIN_FINAL.sql
-- Este script promove o primeiro usuário a admin
```

## ✅ **O que cada script faz:**

### **SETUP_COMPLETO_DO_ZERO.sql:**
- ✅ Remove configurações anteriores problemáticas
- ✅ Cria todas as tabelas do sistema
- ✅ Cria índices para performance
- ✅ Cria funções utilitárias
- ✅ Cria políticas RLS otimizadas (SEM RECURSÃO)
- ✅ Habilita RLS em todas as tabelas
- ✅ Cria trigger para novos usuários
- ✅ Configura storage bucket

### **SETUP_ADMIN_FINAL.sql:**
- ✅ Promove primeiro usuário a admin
- ✅ Atualiza metadata do JWT
- ✅ Verifica configuração final

## 🎯 **Políticas RLS Criadas (otimizadas):**

### **USERS:**
- `users_own_access` - Usuário acessa próprio perfil
- `admin_users_access` - Admin acessa todos usuários

### **EVENTS:**
- `events_public_read` - Todos podem ver eventos
- `admin_events_manage` - Admin gerencia eventos

### **EVENT_REGISTRATIONS:**
- `registrations_own_access` - Usuário gerencia próprias inscrições
- `admin_registrations_access` - Admin gerencia todas inscrições

### **TEAMS:**
- `teams_public_read` - Todos podem ver times
- `admin_teams_manage` - Admin gerencia times

### **TEAM_MEMBERS:**
- `team_members_own_access` - Usuário gerencia própria participação
- `admin_team_members_access` - Admin/Captain gerenciam membros

### **EVALUATIONS:**
- `evaluations_stakeholder_access` - Voluntário/Capitão/Admin veem avaliações
- `captain_evaluations_manage` - Capitão/Admin gerenciam avaliações

### **ADMIN_EVALUATIONS:**
- `admin_evaluations_access` - Capitão/Admin veem avaliações admin
- `admin_evaluations_manage` - Admin gerencia avaliações

### **NOTIFICATIONS:**
- `notifications_own_access` - Usuário gerencia próprias notificações

## 🔧 **Principais Melhorias:**

1. **❌ SEM RECURSÃO RLS** - Políticas baseadas em JWT evitam recursão infinita
2. **⚡ PERFORMANCE** - Índices otimizados para todas as consultas
3. **🔒 SEGURANÇA** - Políticas precisas baseadas no código real
4. **🛠️ MANUTENIBILIDADE** - Funções simples e diretas
5. **📊 COMPATIBILIDADE** - Baseado no arquivo original mas corrigido

## 🎉 **Após Execução:**

1. ✅ Sistema completamente funcional
2. ✅ Login/logout funcionando
3. ✅ Dashboard carregando
4. ✅ Admin promovido automaticamente
5. ✅ Sem erros RLS
6. ✅ Performance otimizada

## 📝 **Notas Importantes:**

- ⚠️ Os "erros" do VS Code são apenas do linter - o SQL está correto
- ✅ Execute na ordem: `SETUP_COMPLETO_DO_ZERO.sql` → `SETUP_ADMIN_FINAL.sql`
- 🔄 Após execução, faça LOGOUT e LOGIN para aplicar as mudanças
- 🎯 O primeiro usuário será automaticamente promovido a admin

## 🚨 **Se algo der errado:**

Execute novamente `SETUP_COMPLETO_DO_ZERO.sql` - ele limpa tudo e recria do zero.
