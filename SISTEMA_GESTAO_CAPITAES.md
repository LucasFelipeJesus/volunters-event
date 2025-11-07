# 🔄 Sistema de Gestão de Capitães - Implementado

Sistema completo de gestão automática e manual de capitães, implementando ciclo de vida de roles baseado em eventos.

## ✅ Funcionalidades Implementadas

### 🤖 **Demoção Automática**
- **Quando**: Eventos são marcados como "completed" (finalizados)
- **O que acontece**: Todos os capitães que lideraram equipes no evento voltam automaticamente a "volunteer"
- **Exceção**: Administradores não são afetados
- **Onde**: Implementado no `EventDetails.tsx` quando status é alterado

### 👨‍💼 **Gestão Manual de Roles (Admin)**
- **Interface**: Painel administrativo em `/admin/users`
- **Funções**:
  - ✅ Promover voluntários a capitães
  - ✅ Demover capitães a voluntários
  - ✅ Visualizar histórico de usuários
- **Permissões**: Apenas administradores podem executar

### 🎯 **Capitães Podem se Inscrever**
- **Antes**: Apenas voluntários podiam se inscrever em eventos
- **Agora**: Capitães também podem participar como voluntários
- **Onde**: Removida restrição nos dashboards de Captain e Volunteer

### 🔧 **Backend Services**

#### **userService.ts - Novas Funções:**
```typescript
// Demover usuário específico
demoteToVolunteer(userId: string): Promise<boolean>

// Demover capitães após evento finalizado
demoteCaptainsAfterEvent(eventId: string): Promise<number>
```

#### **AuthProvider.tsx - Contexto Atualizado:**
```typescript
// Disponível para toda a aplicação
demoteUser(userId: string): Promise<boolean>
demoteCaptainsAfterEvent(eventId: string): Promise<number>
```

## 🔄 **Fluxo Completo do Sistema**

### 1. **Promoção (Manual)**
```
Voluntário → Admin promove → Capitão
```
- Interface: Painel administrativo
- Ação: Clique em "Promover a Capitão"
- Resultado: Usuário vira capitão e pode liderar equipes

### 2. **Participação em Eventos**
```
Capitão → Se inscreve como voluntário → Participa do evento
```
- Interface: Dashboard do capitão
- Ação: Clique em "Inscrever-se" nos eventos disponíveis
- Resultado: Capitão participa como membro de equipe

### 3. **Demoção Automática**
```
Evento finalizado → Sistema demove capitães → Voltam a voluntários
```
- Trigger: Admin marca evento como "completed"
- Ação: Sistema busca capitães que lideraram equipes do evento
- Resultado: Capitães voltam a ser voluntários automaticamente

### 4. **Nova Promoção**
```
Voluntário (ex-capitão) → Admin promove novamente → Capitão
```
- Ciclo recomeça para próximos eventos

## 📁 **Arquivos Modificados**

### **Frontend:**
- ✅ `src/lib/services.ts` - Funções de demoção
- ✅ `src/contexts/AuthProvider.tsx` - Contexto atualizado
- ✅ `src/contexts/AuthContext.ts` - Tipos atualizados
- ✅ `src/pages/Captain/CaptainDashboard.tsx` - Permitir inscrição
- ✅ `src/pages/Volunteer/VolunteerDashboard.tsx` - Permitir inscrição
- ✅ `src/pages/Admin/UsersManagement.tsx` - Interface melhorada
- ✅ `src/pages/Events/EventDetails.tsx` - Demoção automática

### **Backend/SQL:**
- ✅ `supabase/migrations/SISTEMA_DEMOCAO_CAPITAES.sql` - Funções SQL

## 🎮 **Como Usar**

### **Para Administradores:**
1. **Promover usuário**: Admin → Usuários → Buscar voluntário → "Promover a Capitão"
2. **Demover usuário**: Admin → Usuários → Buscar capitão → "Demover a Voluntário" 
3. **Finalizar evento**: Eventos → Detalhes → Editar → Status: "Completed"

### **Para Capitães:**
1. **Liderar equipe**: Criar/gerenciar equipes nos eventos
2. **Participar como voluntário**: Dashboard → Eventos Disponíveis → "Inscrever-se"
3. **Após evento**: Automaticamente volta a voluntário

### **Para Voluntários:**
1. **Participar**: Se inscrever em eventos normalmente
2. **Aguardar promoção**: Admin pode promover baseado em desempenho

## ⚡ **Benefícios do Sistema**

### **Administrativos:**
- ✅ **Controle total**: Admin decide quem lidera
- ✅ **Automação**: Demoção automática após eventos
- ✅ **Flexibilidade**: Capitães podem participar como voluntários
- ✅ **Transparência**: Histórico de ações visível

### **Para Usuários:**
- ✅ **Oportunidades**: Capitães não ficam limitados apenas a liderar
- ✅ **Justiça**: Sistema transparente de promoção/demoção
- ✅ **Motivação**: Possibilidade de ser promovido novamente

### **Para Eventos:**
- ✅ **Qualidade**: Líderes são escolhidos pelo admin
- ✅ **Participação**: Mais pessoas podem participar
- ✅ **Organização**: Ciclo claro de responsabilidades

## 🔍 **Exemplo Prático:**

```
1. João é voluntário
2. Admin promove João a capitão para evento "Natal 2025"
3. João lidera equipe no evento Natal
4. Admin marca evento Natal como "completed"
5. Sistema automaticamente demove João de volta a voluntário
6. João pode se inscrever em outros eventos como voluntário
7. Admin pode promover João novamente para liderar outro evento
```

## 🛠️ **Próximos Passos (Opcionais):**

- [ ] **Notificações**: Sistema de notificações para promoções/demoções
- [ ] **Histórico**: Log detalhado de mudanças de role
- [ ] **Critérios**: Sistema de critérios para promoção automática
- [ ] **Badges**: Sistema de reconhecimento para ex-capitães
- [ ] **Dashboard**: Métricas de performance de liderança

---

**Sistema implementado com sucesso! 🎉**
Capitães agora têm um ciclo de vida dinâmico e podem participar ativamente de todos os aspectos da plataforma.