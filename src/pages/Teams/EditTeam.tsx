import React, { useState, useEffect, useCallback } from 'react'

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notificationService } from '../../lib/services'
import { useAuth } from '../../hooks/useAuth'
import {
  ArrowLeft,
  Save,
  Users,
  Trash2,
  UserMinus,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react'

interface TeamMember {
  id: string
  user_id: string
  team_id: string
  role_in_team: 'captain' | 'volunteer'
  status: 'active' | 'inactive' | 'removed'
  joined_at: string
  left_at?: string
  user?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

interface Team {
  id: string;
  name: string;
  description?: string;
  event_id: string;
  captain_id: string;
  max_volunteers: number;
  status: string;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
  event?: {
    id: string;
    title: string;
    admin_id: string;
  };
}

export const EditTeam: React.FC = () => {
  // Hooks de estado principais SEMPRE primeiro
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para edição
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    max_volunteers: 0,
    arrival_time: '',
    status: 'forming'
  });

  // Estado para voluntários disponíveis
  const [availableVolunteers, setAvailableVolunteers] = useState<UserProfile[]>([]);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  // Buscar voluntários disponíveis para inclusão
  useEffect(() => {
    const fetchAvailableVolunteers = async () => {
      if (!team?.event_id) return;
      // Buscar apenas usuários que se inscreveram neste evento (event_registrations)
      // Consideramos status 'confirmed' e 'pending' como inscritos.
      const { data: registrationsData, error: regsError } = await supabase
        .from('event_registrations')
        .select('user:users(id, full_name, email, role, is_active), status')
        .eq('event_id', team.event_id)
        .in('status', ['confirmed', 'pending'])

      if (regsError) {
        console.error('Erro ao buscar inscrições do evento:', regsError)
      }

      // Extrair apenas os usuários ativos com role 'volunteer'
      // Capitães não devem aparecer na lista de voluntários disponíveis
      const allVolunteers = (registrationsData || [])
        .map((r: any) => r.user)
        .filter((u: any) => u && u.role === 'volunteer' && u.is_active)

      // Buscar IDs das equipes deste evento
      const { data: eventTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('event_id', team.event_id);
      const eventTeamIds = eventTeams?.map((t: { id: string }) => t.id) || [];
      const { filterValidUUIDs } = await import('../../lib/utils')
      const eventTeamIdsFiltered = filterValidUUIDs(eventTeamIds)

      // Buscar membros ativos de todas as equipes deste evento
      let allocatedIds: string[] = [];
      if (eventTeamIdsFiltered.length > 0) {
        const { data: eventMembers } = await supabase
          .from('team_members')
          .select('user_id, team_id, status')
          .in('status', ['active'])
          .in('team_id', eventTeamIdsFiltered);
        allocatedIds = eventMembers?.map((m: { user_id: string }) => m.user_id) || [];
      }

      // IDs de membros removidos/inativos desta equipe
      const thisTeamInactiveIds = team?.members?.filter((m) => m.status !== 'active').map((m) => m.user_id) || [];

      // Disponíveis: não alocados OU removidos/inativos desta equipe
      const available = (allVolunteers || []).filter((v) =>
        !allocatedIds.includes(v.id) || thisTeamInactiveIds.includes(v.id)
      );
      setAvailableVolunteers(available);
    };
    fetchAvailableVolunteers();
  }, [team]);

  // Adicionar voluntário selecionado
  const handleAddVolunteer = async () => {
    if (!selectedVolunteerId || !team) return;
    setError(null);
    if (team.event?.status === 'completed') {
      setError('Não é possível adicionar voluntários: o evento já foi finalizado.')
      return
    }
    try {
      // Verifica se já existe registro para esse user_id nesta equipe
      const existing = team.members?.find((m) => m.user_id === selectedVolunteerId);
      if (existing) {
        // Se já existe, apenas reativa
        const user = (availableVolunteers || []).find(v => v.id === selectedVolunteerId)
        const roleInTeam = user && user.role === 'captain' ? 'captain' : 'volunteer'
        await supabase
          .from('team_members')
          .update({ status: 'active', left_at: null, role_in_team: roleInTeam })
          .eq('id', existing.id);
      } else {
        // Se não existe, cria novo
        const user = (availableVolunteers || []).find(v => v.id === selectedVolunteerId)
        const roleInTeam = user && user.role === 'captain' ? 'captain' : 'volunteer'
        await supabase
          .from('team_members')
          .insert({
            team_id: team.id,
            user_id: selectedVolunteerId,
            role_in_team: roleInTeam,
            status: 'active',
            joined_at: new Date().toISOString()
          });
      }
      // Criar notificação para o voluntário alocado
      try {
        await notificationService.createNotification({
          user_id: selectedVolunteerId,
          title: `Você foi alocado na equipe ${team.name}`,
          message: `Você foi incluído na equipe ${team.name} do evento ${team.event?.title || ''}. Veja os detalhes na aba de notificações.`,
          type: 'info',
          related_event_id: team.event_id,
          related_team_id: team.id,
          read: false
        })
      } catch (err) {
        console.error('Erro ao criar notificação de alocação:', err)
      }
      setSuccess('Voluntário adicionado à equipe!');
      setSelectedVolunteerId('');
      await fetchTeamDetails();
    } catch {
      setError('Erro ao adicionar voluntário.');
    }
  };
  // ...restante do componente permanece igual...

  const fetchTeamDetails = useCallback(async () => {
    try {
      setLoading(true)

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          *,
          event:events(*),
          members:team_members(
            *,
            user:users(*)
          )
        `)
        .eq('id', id)
        .single()

      if (teamError) throw teamError

      setTeam(teamData)
      setEditData({
        name: teamData.name,
        description: teamData.description || '',
        max_volunteers: teamData.max_volunteers,
        arrival_time: teamData.arrival_time || '',
        status: teamData.status
      })

    } catch (error: unknown) {
      console.error('Erro ao buscar detalhes da equipe:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar equipe'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchTeamDetails()
    }
  }, [id, fetchTeamDetails])

  const handleSaveChanges = async () => {
    try {
      setError(null)

      if (team?.event?.status === 'completed') {
        setError('Não é possível editar esta equipe: o evento associado já foi finalizado.')
        return
      }

      // Validações básicas
      if (!editData.name) {
        throw new Error('Nome da equipe é obrigatório')
      }

      if (editData.max_volunteers < 1) {
        throw new Error('O número máximo de voluntários deve ser pelo menos 1')
      }

      // Verificar se o número de voluntários atuais não excede o novo máximo
      const currentVolunteers = team?.members?.filter(m => m.status === 'active').length || 0
      if (editData.max_volunteers < currentVolunteers) {
        throw new Error(`Não é possível reduzir o máximo para ${editData.max_volunteers}. A equipe já tem ${currentVolunteers} voluntários ativos.`)
      }

      // Atualizar equipe
      const { error: updateError } = await supabase
        .from('teams')
        .update({
          name: editData.name,
          description: editData.description,
          max_volunteers: editData.max_volunteers,
          arrival_time: editData.arrival_time || null,
          status: editData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) throw updateError

      setSuccess('Equipe atualizada com sucesso!')
      await fetchTeamDetails() // Recarregar dados

    } catch (error: unknown) {
      console.error('Erro ao atualizar equipe:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar equipe'
      setError(errorMessage)
    }
  }

  const handleMarkComplete = async () => {
    if (!team) return
    if (!window.confirm('Marcar esta equipe como completa? Esta ação não pode ser desfeita facilmente.')) return

    try {
      setError(null)
      // Verifica contagem de membros ativos antes de marcar como 'complete'
      const { data: activeMembers } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('status', 'active')

      const activeCount = (activeMembers || []).length || 0
      if (activeCount < 1) {
        setError('Não é possível marcar como completa: a equipe precisa ter pelo menos 1 membro ativo.')
        return
      }

      // Atualiza status para 'complete'
      const { error } = await supabase
        .from('teams')
        .update({ status: 'complete', updated_at: new Date().toISOString() })
        .eq('id', team.id)

      if (error) throw error

      setSuccess('Equipe marcada como completa.')
      await fetchTeamDetails()
    } catch (err: unknown) {
      console.error('Erro ao marcar equipe como completa:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro ao marcar equipe como completa'
      setError(errorMessage)
    }
  }

  const handleRemoveVolunteer = async (memberId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este voluntário da equipe?')) {
      return
    }
    if (team?.event?.status === 'completed') {
      setError('Não é possível remover voluntários: o evento já foi finalizado.')
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'removed', left_at: new Date().toISOString() })
        .eq('id', memberId)

      if (error) throw error

      setSuccess('Voluntário removido com sucesso!')
      await fetchTeamDetails()
    } catch (error: unknown) {
      console.error('Erro ao remover voluntário:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao remover voluntário'
      setError(errorMessage)
    }
  }

  const handleDeleteTeam = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta equipe? Esta ação não pode ser desfeita e todos os membros serão removidos.')) {
      return
    }
    if (team?.event?.status === 'completed') {
      setError('Não é possível excluir esta equipe: o evento está finalizado. Registros devem permanecer para histórico.')
      return
    }

    try {
      // Primeiro, remover todos os membros
      const { error: membersError } = await supabase
        .from('team_members')
        .update({ status: 'removed', left_at: new Date().toISOString() })
        .eq('team_id', id)

      if (membersError) throw membersError

      // Depois, excluir a equipe
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', id)

      if (teamError) throw teamError

      // Redirecionar para a página do evento ou para a lista de equipes
      if (team?.event_id) {
        navigate(`/events/${team.event_id}`)
      } else {
        navigate('/teams')
      }
    } catch (error: unknown) {
      console.error('Erro ao excluir equipe:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir equipe'
      setError(errorMessage)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'forming': return 'bg-yellow-100 text-yellow-800'
      case 'complete': return 'bg-blue-100 text-blue-800'
      case 'finished': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa'
      case 'forming': return 'Formando'
      case 'complete': return 'Completa'
      case 'finished': return 'Concluída'
      default: return status
    }
  }

  // Não permitir edição se o evento associado já estiver finalizado
  const eventIsCompleted = team?.event?.status === 'completed'

  const canEdit = !eventIsCompleted && (user?.role === 'admin' || 
                  (user?.role === 'captain' && team?.captain_id === user?.id) ||
    (user?.role === 'captain' && team?.event?.admin_id === user?.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Equipe não encontrada</h3>
        <Link to="/teams" className="text-blue-600 hover:text-blue-700">
          Voltar para equipes
        </Link>
      </div>
    )
  }

  const activeMembers = team.members?.filter(m => m.status === 'active') || []

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => team.event_id ? navigate(`/events/${team.event_id}`) : navigate('/teams')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Editar Equipe: {team.name}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(team.status)}`}>
                {getStatusText(team.status)}
              </span>
              {team.event && (
                <Link 
                  to={`/events/${team.event.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Evento: {team.event.title}
                </Link>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveChanges}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>

            {/* Admins can delete teams */}
            {user?.role === 'admin' && (
              <button
                onClick={handleDeleteTeam}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Equipe</span>
              </button>
            )}

            {/* If team is forming, offer admins a quick action to mark as complete */}
            {user?.role === 'admin' && team?.status === 'forming' && (
              <button
                onClick={handleMarkComplete}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Marcar equipe como completa"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Marcar como Completa</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Informações da Equipe */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configurações da Equipe */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Configurações da Equipe
            </h2>

            {canEdit ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Equipe</label>
                  <input
                    type="text"
                    title="Nome da equipe"
                    value={editData.name}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição da Estação</label>
                  <textarea
                    title="Descrição da estação"
                    value={editData.description}
                    onChange={(e) => setEditData({...editData, description: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Descreva o que esta equipe fará e em que estação trabalhará..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Máximo de Voluntários</label>
                    <input
                      type="number"
                      min="1"
                      title="Número máximo de voluntários"
                      value={editData.max_volunteers}
                      onChange={(e) => setEditData({...editData, max_volunteers: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hora de Chegada (opcional)</label>
                    <input
                      type="time"
                      title="Hora de chegada da equipe"
                      value={editData.arrival_time}
                      onChange={(e) => setEditData({ ...editData, arrival_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      title="Status da equipe"
                      value={editData.status}
                      onChange={(e) => setEditData({...editData, status: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="forming">Formando</option>
                      <option value="active">Ativa</option>
                      <option value="complete">Completa</option>
                      <option value="finished">Concluída</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  {team?.event?.status === 'completed' ? (
                    <>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Evento finalizado — edição bloqueada</h3>
                      <p className="text-gray-500">Este evento já foi finalizado. As equipes são mantidas para histórico e não podem ser editadas.</p>
                    </>
                  ) : (
                    <>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Sem permissão para editar</h3>
                        <p className="text-gray-500">Você não tem permissão para editar esta equipe.</p>
                    </>
                  )}
              </div>
            )}
          </div>

          {/* Membros da Equipe */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Membros da Equipe ({activeMembers.length}/{team.max_volunteers})
            </h2>

            {/* Adicionar voluntário disponível se houver vagas */}
            {canEdit && activeMembers.length < team.max_volunteers && (
              <div className="mb-6 flex flex-col md:flex-row md:items-center gap-2">
                <select
                  className="w-full md:w-72 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedVolunteerId}
                  onChange={e => setSelectedVolunteerId(e.target.value)}
                  title="Adicionar voluntário à equipe"
                  aria-label="Adicionar voluntário à equipe"
                >
                  <option value="">Adicionar voluntário...</option>
                  {availableVolunteers.map((v) => (
                    <option key={v.id} value={v.id}>{v.full_name} ({v.email})</option>
                  ))}
                </select>
                <button
                  className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={handleAddVolunteer}
                  disabled={!selectedVolunteerId}
                >
                  Incluir voluntário
                </button>
              </div>
            )}

            {activeMembers.length > 0 ? (
              <div className="space-y-3">
                {activeMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="font-medium text-gray-900">{member.user?.full_name}</p>
                        <p className="text-sm text-gray-600">{member.user?.email}</p>
                        <p className="text-xs text-gray-500">Entrou em: {formatDate(member.joined_at)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        member.role_in_team === 'captain' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {member.role_in_team === 'captain' ? 'Capitão' : 'Voluntário'}
                      </span>
                    </div>

                    {canEdit && member.role_in_team !== 'captain' && (
                      <button
                        onClick={() => handleRemoveVolunteer(member.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover voluntário"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum membro na equipe</h3>
                <p className="text-gray-500">Esta equipe ainda não possui membros.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Estatísticas */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Membros Ativos</span>
                <span className="font-semibold text-gray-900">{activeMembers.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Vagas Disponíveis</span>
                <span className="font-semibold text-gray-900">{team.max_volunteers - activeMembers.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Taxa de Ocupação</span>
                <span className="font-semibold text-gray-900">
                  {Math.round((activeMembers.length / team.max_volunteers) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Informações Gerais */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações</h3>

            <div className="space-y-3">
              <div className="text-xs text-gray-500">
                <p>Criada em: {formatDate(team.created_at)}</p>
                {team.updated_at !== team.created_at && (
                  <p>Atualizada em: {formatDate(team.updated_at)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
