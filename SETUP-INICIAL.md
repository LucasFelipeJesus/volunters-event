# 🚀 Setup Inicial do Sistema

## ⚠️ IMPORTANTE: Administrador NÃO é criado automaticamente

O sistema **NÃO** cria automaticamente um usuário administrador. Após aplicar a migration, você **DEVE** criar manualmente o primeiro administrador.

## 📋 Passo a Passo Completo

### 1️⃣ Aplicar Migration

```bash
# Executar migration para criar todas as tabelas e funções
npx supabase migration up
```

### 2️⃣ Criar Administrador (OBRIGATÓRIO)

O administrador deve ser criado manualmente usando uma das opções abaixo:

#### **Opção A: Via Dashboard do Supabase (RECOMENDADO)**

1. 🌐 Acesse o Dashboard do seu projeto no Supabase
2. 🔐 Vá para **Authentication > Users**
3. ➕ Clique em **"Add user"**
4. 📝 Preencha os dados:
   - **Email**: `admin@sistema.com`
   - **Password**: `admin123`
   - **User Metadata**: `{"full_name": "Administrador do Sistema"}`
   - **Email Confirm**: ✅ **Marcar como confirmado**
5. 💾 Clique em **"Create user"**

#### **Opção B: Via SQL Editor**

1. 🌐 Acesse o Dashboard do Supabase
2. 📊 Vá para **SQL Editor**
3. 📝 Execute os comandos:

```sql
-- 1. Primeiro criar o usuário na tabela auth.users via dashboard

-- 2. Depois configurar como admin (substitua o UUID)
SELECT setup_admin_profile(
  'UUID_DO_USUARIO_CRIADO'::uuid,
  'admin@sistema.com',
  'Administrador do Sistema'
);
```

#### **Opção C: Via Aplicação (Depois do Login)**

Se preferir criar via código depois que o usuário fizer login:

```typescript
import { authService } from './src/lib/services'

// Configurar usuário logado como admin
const userId = 'uuid-do-usuario-logado'
const success = await authService.setupAdminProfile(
  userId,
  'admin@sistema.com',
  'Administrador do Sistema'
)
```

### 3️⃣ Verificar Configuração

Após criar o administrador, verifique se está funcionando:

1. 🔑 Faça login com as credenciais do admin
2. ✅ Verifique se o usuário tem role = 'admin' na tabela users
3. 🎯 Teste criar um evento (só admins podem)

## 🔍 Como Verificar se o Admin foi Criado

Execute no SQL Editor:

```sql
-- Verificar se existe administrador
SELECT id, email, full_name, role, created_at 
FROM users 
WHERE role = 'admin';
```

## 🛠️ Utilitários Disponíveis

O sistema inclui utilitários para facilitar a configuração:

- **`src/utils/adminSetup.ts`** - Script para configurar admin
- **`src/components/AdminSetup.tsx`** - Componente visual para setup
- **`CONFIGURACAO-ADMIN.md`** - Guia detalhado de configuração

## ⚡ Script Automático (Opcional)

Se quiser usar o script automático:

```bash
# No terminal do projeto
npm run setup-admin
```

Ou execute diretamente:

```typescript
import { setupInitialAdmin } from './src/utils/adminSetup'
await setupInitialAdmin()
```

## 🔄 Fluxo Completo

1. **Migration** → Cria tabelas e funções ✅
2. **Trigger** → Cria perfil automaticamente para novos usuários ✅
3. **Admin Manual** → Você deve criar o primeiro admin ⚠️
4. **Sistema Pronto** → Admin pode criar eventos e gerenciar usuários ✅

## 💡 Dicas Importantes

- 🔒 O admin pode promover voluntários a capitães
- 📅 Apenas admins podem criar eventos
- 👥 Admins montam as equipes para os eventos
- 📊 Sistema de avaliações funciona automaticamente
- 🔔 Notificações são criadas automaticamente

## 🆘 Problemas Comuns

### "Função não encontrada"
```
❌ Erro: função setup_admin_profile não encontrada
💡 Solução: Execute a migration primeiro
```

### "Permissão negada"
```
❌ Erro: permissão negada para criar evento
💡 Solução: Verifique se o usuário é admin
```

### "Admin API não disponível"
```
❌ Erro: admin api não disponível
💡 Solução: Use o Dashboard ou SQL para criar admin
```

---

🎉 **Após seguir esses passos, seu sistema estará totalmente configurado e pronto para uso!**
