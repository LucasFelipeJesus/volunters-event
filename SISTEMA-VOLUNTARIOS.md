# Sistema de Gerenciamento de Voluntários

## Visão Geral

Este sistema foi redesenhado para gerenciar voluntários de forma hierárquica com três níveis de usuários:

- **Voluntários**: Participam de eventos em equipes
- **Capitães**: Lideram equipes e avaliam voluntários  
- **Administradores**: Gerenciam eventos, equipes e usuários

## Estrutura do Banco de Dados

### Tabelas Principais

#### `users`
- **Finalidade**: Perfis de todos os usuários do sistema
- **Roles**: `volunteer`, `captain`, `admin`
- **Campos importantes**:
  - `role`: Define o nível de acesso do usuário
  - `is_first_login`: Controla se é o primeiro acesso
  - `is_active`: Status da conta do usuário

#### `events`
- **Finalidade**: Eventos criados pelos administradores
- **Relacionamentos**: 
  - Criado por `admin_id` (administrador)
  - Contém múltiplas `teams`

#### `teams`
- **Finalidade**: Equipes montadas para cada evento
- **Relacionamentos**:
  - Pertence a um `event_id`
  - Liderada por `captain_id`
  - Criada por administrador (`created_by`)

#### `team_members`
- **Finalidade**: Membros das equipes (voluntários e capitães)
- **Status**: `active`, `inactive`, `removed`
- **Roles na equipe**: `captain`, `volunteer`

#### `evaluations`
- **Finalidade**: Avaliações de voluntários feitas pelos capitães
- **Campos**: rating (1-5), comentários, habilidades demonstradas

#### `admin_evaluations`
- **Finalidade**: Avaliações de capitães feitas pelos administradores
- **Campos**: múltiplas ratings de liderança, gestão, comunicação

#### `notifications`
- **Finalidade**: Sistema de notificações
- **Tipos**: `info`, `success`, `warning`, `error`, `evaluation`

### Views Criadas

#### `user_event_history`
- Histórico completo de participação em eventos
- Inclui informações da equipe e status

#### `team_details`
- Detalhes completos das equipes com membros
- Informações agregadas para dashboards

#### `evaluation_details` e `admin_evaluation_details`
- Avaliações com informações completas dos envolvidos
- Facilita exibição em interfaces

## Fluxo do Sistema

### 1. Cadastro de Usuário
- Novo usuário sempre começa como `volunteer`
- `is_first_login = true` para forçar configuração inicial
- Administrador padrão criado automaticamente (email: admin@sistema.com, senha: admin123)

### 2. Gestão de Eventos (Administradores)
- Criar eventos
- Montar equipes para cada evento
- Definir capitão para cada equipe
- Adicionar voluntários às equipes

### 3. Participação em Eventos
- Voluntários são adicionados às equipes pelos administradores
- Podem sair das equipes quando necessário
- Histórico mantido mesmo após saída

### 4. Sistema de Avaliações
- **Capitães avaliam voluntários**: rating, comentários, habilidades
- **Administradores avaliam capitães**: múltiplas dimensões de liderança
- Notificações automáticas quando avaliações são criadas

### 5. Promoções
- Administradores podem promover voluntários a capitães
- Função `promote_to_captain()` com notificação automática

## Funcionalidades por Perfil

### Voluntários
- ✅ Ver eventos disponíveis
- ✅ Ver histórico de participação
- ✅ Calendário de eventos
- ✅ Gerenciar perfil pessoal
- ✅ Sair de equipes
- ✅ Ver suas avaliações
- ✅ Deletar conta

### Capitães
- ✅ Todas as funcionalidades de voluntário
- ✅ Ver equipe designada para eventos
- ✅ Avaliar voluntários da equipe
- ✅ Ver avaliações recebidas de administradores
- ✅ Dashboard de liderança da equipe

### Administradores
- ✅ Todas as funcionalidades anteriores
- ✅ Criar e gerenciar eventos
- ✅ Montar equipes
- ✅ Promover usuários
- ✅ Avaliar capitães
- ✅ Dashboard administrativo completo
- ✅ Gerenciar todos os usuários

## Segurança (RLS)

### Políticas Implementadas
- Usuários só veem seus próprios dados
- Capitães veem dados de suas equipes
- Administradores têm acesso total
- Avaliações só visíveis para envolvidos
- Notificações privadas por usuário

## Funções Utilitárias

### `promote_to_captain(user_id)`
- Promove voluntário a capitão
- Cria notificação automática

### `leave_team(user_id, team_id)`
- Remove usuário da equipe
- Atualiza contadores automaticamente

### `delete_user_account(user_id)`
- Desativa conta (soft delete)
- Remove de equipes ativas

### `get_user_stats(user_id)`
- Retorna estatísticas do usuário
- Total de eventos, média de avaliações, etc.

## Triggers Automáticos

### Contadores
- `current_volunteers` atualizado automaticamente
- `current_teams` atualizado automaticamente

### Notificações
- Criadas automaticamente para avaliações
- Sistema extensível para outros eventos

### Timestamps
- `updated_at` atualizado automaticamente
- Auditoria completa de mudanças

## Integração com Frontend

### Services (`src/lib/services.ts`)
- `userService`: Gestão de usuários
- `eventService`: Gestão de eventos
- `teamService`: Gestão de equipes
- `evaluationService`: Sistema de avaliações
- `notificationService`: Notificações
- `authService`: Autenticação

### Context (`src/contexts/AuthContext.tsx`)
- Estado global de autenticação
- Funções de login/logout
- Verificação de primeiro acesso
- Gestão de perfil

### Tipos TypeScript (`src/lib/supabase.ts`)
- Interfaces para todas as tabelas
- Tipos para views e funções
- Utilitários de verificação de role

## Próximos Passos

1. **Implementar telas do frontend** baseadas nos wireframes
2. **Sistema de calendário** para visualização de eventos
3. **Dashboard analítico** com métricas e gráficos
4. **Sistema de chat** para comunicação entre equipes
5. **Notificações push** para eventos importantes
6. **Upload de imagens** para perfis e eventos
7. **Relatórios** de participação e performance

## Credenciais de Acesso Inicial

- **Email**: admin@sistema.com
- **Senha**: admin123
- **Primeiro acesso**: Solicita mudança de senha

Este administrador pode criar outros usuários e gerenciar o sistema completo.
