# 🎯 Sistema de Gerenciamento de Voluntários

Sistema completo para gerenciamento de voluntários, eventos e equipes com hierarquia de usuários e avaliações.

## 🏗️ Arquitetura do Sistema

### 👥 Hierarquia de Usuários
- **Volunteer** (Voluntário) - Participa de eventos e equipes
- **Captain** (Capitão) - Lidera equipes e avalia voluntários  
- **Admin** (Administrador) - Gerencia todo o sistema

### 🔄 Fluxo Principal
1. **Admin** cria eventos
2. **Admin** monta equipes para os eventos
3. **Captain** lidera a equipe e avalia voluntários
4. **Admin** avalia capitães
5. Sistema gera notificações automáticas

## ⚡ Setup Inicial (IMPORTANTE)

### 1️⃣ Configurar Banco de Dados

```bash
# Aplicar migration
npx supabase migration up
```

### 2️⃣ Criar Administrador (OBRIGATÓRIO)

⚠️ **O sistema NÃO cria automaticamente um administrador!**

**Opção A: Via Dashboard Supabase**
1. Acesse Authentication > Users
2. Clique "Add user"
3. Email: `admin@sistema.com`, Password: `admin123`
4. Marque "Email confirm" ✅

**Opção B: Via Script**
```bash
npm run setup-admin
```

📖 **Guia Completo**: Consulte `SETUP-INICIAL.md` para instruções detalhadas

## 🚀 Executar Projeto

```bash
# Instalar dependências
npm install

# Iniciar Supabase local
npx supabase start

# Executar aplicação
npm run dev
```

## 📁 Estrutura do Projeto

```
src/
├── components/         # Componentes React
├── contexts/          # Context API (AuthContext)
├── hooks/             # Custom hooks (useSystem)
├── lib/
│   ├── supabase.ts    # Config e tipos Supabase
│   ├── services.ts    # Serviços de API
│   └── errorHandling.ts # Sistema de tratamento de erros
├── pages/             # Páginas da aplicação
└── utils/             # Utilitários (adminSetup)

supabase/
└── migrations/        # Schema do banco de dados
```

## 🛠️ Principais Funcionalidades

### 🔐 Sistema de Autenticação
- Login/Register automático via Supabase Auth
- Criação automática de perfil via trigger
- Controle de primeiro login
- Gerenciamento de roles e permissões

### 📅 Gerenciamento de Eventos
- Criação de eventos (apenas admins)
- Status: draft, published, in_progress, completed, cancelled
- Controle de máximo de equipes por evento

### 👥 Sistema de Equipes
- Montagem de equipes pelos admins
- Controle de membros e capitães
- Contador automático de voluntários

### ⭐ Sistema de Avaliações
- Capitães avaliam voluntários (1-5 estrelas)
- Admins avaliam capitães (1-5 estrelas)
- Comentários obrigatórios
- Histórico completo de avaliações

### 🔔 Sistema de Notificações
- Notificações automáticas via triggers
- Tipos: evaluation_received, team_assignment, event_update
- Controle de leitura/não lidas

## 🛡️ Segurança

### Row Level Security (RLS)
- Políticas baseadas em roles
- Voluntários só veem seus dados
- Capitães gerenciam suas equipes
- Admins têm acesso total

### Validações
- Constraints no banco de dados
- Validação de tipos TypeScript
- Tratamento de erros específicos

## 🔧 Serviços Disponíveis

### userService
- `getProfile()` - Buscar perfil
- `updateProfile()` - Atualizar dados
- `getEventHistory()` - Histórico de eventos
- `getStats()` - Estatísticas do usuário
- `promoteToCaptain()` - Promover usuário

### eventService
- `getPublishedEvents()` - Eventos públicos
- `getEvent()` - Detalhes do evento
- `createEvent()` - Criar evento (admin)
- `updateEvent()` - Atualizar evento

### teamService
- `getTeamDetails()` - Detalhes da equipe
- `createTeam()` - Criar equipe
- `addMember()` - Adicionar membro
- `removeMember()` - Remover membro

### evaluationService
- `createEvaluation()` - Avaliar voluntário
- `getVolunteerEvaluations()` - Avaliações recebidas
- `createAdminEvaluation()` - Avaliar capitão
- `getCaptainEvaluations()` - Avaliações de capitão

### notificationService
- `getUserNotifications()` - Notificações do usuário
- `markAsRead()` - Marcar como lida
- `markAllAsRead()` - Marcar todas como lidas

### authService
- `createUserProfile()` - Criar perfil
- `isFirstLogin()` - Verificar primeiro login
- `setupAdminProfile()` - Configurar admin
- `createAdmin()` - Criar administrador

## 📊 Sistema de Tratamento de Erros

O sistema inclui tratamento avançado de erros do Supabase:

```typescript
import { logSupabaseError, formatSupabaseError } from './lib/errorHandling'

// Log automático com sugestões
logSupabaseError(error, 'Contexto da operação', { dadosAdicionais })

// Formatação de erro para UI
const formattedError = formatSupabaseError(error, 'Contexto')
```

### Códigos de Erro Comuns
- `42501` - Permissão insuficiente  
- `PGRST116` - Recurso não encontrado
- `PGRST202` - Função não encontrada
- `23505` - Conflito de dados únicos
- `23503` - Referência inválida
- `P0001` - Erro em função customizada

## 🗄️ Schema do Banco

### Tabelas Principais
- `users` - Perfis dos usuários
- `events` - Eventos do sistema
- `teams` - Equipes dos eventos
- `team_members` - Membros das equipes
- `evaluations` - Avaliações de voluntários
- `admin_evaluations` - Avaliações de capitães
- `notifications` - Sistema de notificações

### Views
- `user_event_history` - Histórico de participação
- `team_details` - Detalhes completos das equipes
- `evaluation_details` - Avaliações com contexto
- `admin_evaluation_details` - Avaliações de admin com contexto

### Funções
- `setup_admin_profile()` - Configurar administrador
- `promote_to_captain()` - Promover usuário
- `leave_team()` - Sair da equipe
- `get_user_stats()` - Estatísticas do usuário

## 🎯 Próximos Passos

1. Execute a migration: `npx supabase migration up`
2. Crie o administrador seguindo `SETUP-INICIAL.md`
3. Acesse o sistema com as credenciais do admin
4. Comece criando eventos e montando equipes

## 📞 Suporte

- Consulte `SETUP-INICIAL.md` para configuração inicial
- Verifique `CONFIGURACAO-ADMIN.md` para problemas de admin
- Logs detalhados estão disponíveis no console do navegador

---

🎉 **Sistema pronto para uso após configuração inicial!**
