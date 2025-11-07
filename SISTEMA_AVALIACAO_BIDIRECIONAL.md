# 🎯 Sistema de Avaliação Bidirecional

Sistema completo de avaliações mútuas entre voluntários e capitães, permitindo feedback 360° para melhoria contínua.

## 📋 Funcionalidades Implementadas

### 🔄 Avaliação Bidirecional
- **Capitães → Voluntários**: Avaliação detalhada de desempenho
- **Voluntários → Capitães**: Avaliação de liderança e suporte

### 📊 Componentes Criados

#### Para Capitães
1. **`AvaliarEquipe.tsx` (Melhorado)**
   - Formulário completo com múltiplos critérios
   - Avaliação por estrelas (1-5) para cada competência
   - Campos de texto para feedback detalhado
   - Interface moderna e intuitiva

2. **`MinhasAvaliacoes.tsx`**
   - Dashboard para visualizar avaliações recebidas de voluntários
   - Estatísticas e gráficos de competências
   - Filtros por período e qualidade
   - Modal com detalhes completos

#### Para Voluntários
1. **`AvaliarCapitao.tsx`**
   - Avaliação de liderança dos capitães
   - Critérios específicos para avaliação de líderes
   - Interface intuitiva com sistema de estrelas
   - Feedback construtivo

2. **`MinhasAvaliacoes.tsx`**
   - Dashboard para visualizar avaliações recebidas de capitães
   - Estatísticas de desempenho
   - Acompanhamento de evolução
   - Detalhes de cada avaliação

### 🗄️ Estrutura do Banco de Dados

#### Tabela `evaluations` (Capitães → Voluntários)
```sql
- rating (1-5): Avaliação geral
- punctuality_rating (1-5): Pontualidade
- teamwork_rating (1-5): Trabalho em equipe
- communication_rating (1-5): Comunicação
- initiative_rating (1-5): Iniciativa
- quality_of_work_rating (1-5): Qualidade do trabalho
- reliability_rating (1-5): Confiabilidade
- positive_aspects: Aspectos positivos
- improvement_suggestions: Sugestões de melhoria
- comments: Comentários gerais
- specific_skills: Habilidades demonstradas
- would_work_again: Trabalharia novamente
- recommend_for_future: Recomenda para eventos futuros
```

#### Tabela `volunteer_evaluations` (Voluntários → Capitães)
```sql
- leadership_rating (1-5): Liderança
- communication_rating (1-5): Comunicação
- support_rating (1-5): Suporte à equipe
- organization_rating (1-5): Organização
- motivation_rating (1-5): Motivação da equipe
- problem_solving_rating (1-5): Resolução de problemas
- overall_rating (1-5): Avaliação geral
- positive_aspects: Aspectos positivos
- improvement_suggestions: Sugestões de melhoria
- comments: Comentários
- felt_supported: Se sentiu apoiado
- clear_instructions: Instruções claras
- would_work_again: Trabalharia novamente
- recommend_captain: Recomenda o capitão
```

### 📈 Views e Estatísticas

#### Views Criadas
- **`evaluation_details`**: Avaliações de voluntários com detalhes completos
- **`captain_evaluation_details`**: Avaliações de capitães com detalhes completos
- **`volunteer_evaluation_stats`**: Estatísticas de desempenho de voluntários
- **`captain_evaluation_stats`**: Estatísticas de liderança de capitães

#### Funções Úteis
- **`get_evaluable_captains_for_volunteer()`**: Lista capitães que um voluntário pode avaliar
- **`can_volunteer_evaluate_captain()`**: Verifica se voluntário pode avaliar capitão
- **`calculate_volunteer_average_rating()`**: Calcula média ponderada das avaliações

### 🔐 Segurança e Políticas

#### Políticas RLS (Row Level Security)
- Voluntários só podem avaliar capitães com quem trabalharam
- Capitães só podem avaliar voluntários de suas equipes
- Usuários podem ver suas próprias avaliações (dadas e recebidas)
- Admins têm acesso completo para moderação

#### Regras de Negócio
- Avaliações só podem ser feitas após eventos finalizados
- Uma avaliação por voluntário/capitão por evento
- Período de 7 dias para edição de avaliações
- Validação de relacionamento em equipes

### 🚀 Como Usar

#### 1. Instalar Schema do Banco
```bash
# Execute o arquivo SQL no Supabase
psql -f supabase/migrations/SISTEMA_AVALIACAO_BIDIRECIONAL.sql
```

#### 2. Adicionar Rotas (Exemplo)
```tsx
// Para Capitães
<Route path="/captain/avaliar-equipe" component={AvaliarEquipe} />
<Route path="/captain/minhas-avaliacoes" component={MinhasAvaliacoes} />

// Para Voluntários
<Route path="/volunteer/avaliar-capitao" component={AvaliarCapitao} />
<Route path="/volunteer/minhas-avaliacoes" component={MinhasAvaliacoes} />
```

#### 3. Integrar no Menu de Navegação
```tsx
// Menu do Capitão
{user.role === 'captain' && (
  <>
    <Link to="/captain/avaliar-equipe">Avaliar Voluntários</Link>
    <Link to="/captain/minhas-avaliacoes">Minhas Avaliações</Link>
  </>
)}

// Menu do Voluntário
{user.role === 'volunteer' && (
  <>
    <Link to="/volunteer/avaliar-capitao">Avaliar Capitão</Link>
    <Link to="/volunteer/minhas-avaliacoes">Minhas Avaliações</Link>
  </>
)}
```

### 📱 Interface do Usuário

#### Recursos da Interface
- **Design Responsivo**: Funciona em desktop e mobile
- **Sistema de Estrelas**: Avaliação visual intuitiva
- **Filtros Avançados**: Por período, qualidade, etc.
- **Estatísticas Visuais**: Gráficos e barras de progresso
- **Modais Detalhados**: Visualização completa das avaliações
- **Feedback em Tempo Real**: Mensagens de sucesso/erro
- **Acessibilidade**: Títulos, labels e navegação por teclado

#### Experiência do Usuário
- **Onboarding**: Instruções claras sobre como avaliar
- **Progresso Visual**: Indicadores de avaliações pendentes/completas
- **Histórico Completo**: Todas as avaliações em um local
- **Insights**: Estatísticas para acompanhar evolução
- **Privacidade**: Avaliações visíveis apenas para envolvidos

### 🎯 Benefícios do Sistema

#### Para Organizações
- **Melhoria Contínua**: Feedback constante para evolução
- **Identificação de Talentos**: Voluntários e capitães de destaque
- **Qualidade dos Eventos**: Melhor organização e execução
- **Retenção**: Voluntários se sentem valorizados

#### Para Voluntários
- **Desenvolvimento Pessoal**: Feedback para crescimento
- **Reconhecimento**: Valorização do trabalho realizado
- **Transparência**: Critérios claros de avaliação
- **Motivação**: Sistema de recompensas baseado em desempenho

#### Para Capitães
- **Liderança**: Feedback sobre habilidades de liderança
- **Gestão de Equipe**: Insights sobre dinâmica da equipe
- **Autoavaliação**: Oportunidade de reflexão e melhoria
- **Mentoria**: Orientação personalizada para voluntários

### 🔄 Fluxo de Avaliação

1. **Evento Finalizado**: Status do evento muda para "completed"
2. **Período de Avaliação**: Janela de 30 dias para avaliações
3. **Notificações**: Lembretes automáticos para avaliar
4. **Avaliação Mútua**: Capitães e voluntários se avaliam
5. **Feedback**: Resultados disponíveis para visualização
6. **Melhoria**: Insights aplicados em eventos futuros

### 🛠️ Configurações Avançadas

#### Personalização de Critérios
O sistema permite ajustar os critérios de avaliação:
- Adicionar/remover competências
- Alterar pesos das avaliações
- Criar critérios específicos por tipo de evento
- Configurar limites de tempo para avaliações

#### Integrações Futuras
- **Gamificação**: Sistema de badges e rankings
- **IA/ML**: Sugestões automáticas de melhoria
- **Relatórios**: Dashboards executivos
- **Mobile App**: Aplicativo dedicado para avaliações

### 📧 Suporte

Para dúvidas ou sugestões sobre o sistema de avaliação:
- 📧 Email: suporte@voluntarios.com
- 📱 WhatsApp: (11) 99999-9999
- 🌐 Documentação: /docs/avaliacoes

---

**Sistema de Avaliação Bidirecional** - Promovendo excelência através do feedback construtivo! 🌟