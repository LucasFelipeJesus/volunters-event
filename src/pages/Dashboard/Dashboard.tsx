import React, { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase, Event } from '../../lib/supabase'

import { 
  Calendar, 
  Users, 
  Clock,
  MapPin,
  Plus,
  ArrowRight,
  CheckCircle,
} from 'lucide-react'

// Tipo para registros de eventos
interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  status: 'pending' | 'confirmed' | 'cancelled'
  terms_accepted: boolean
  terms_accepted_at?: string
  registered_at: string
  event?: {
    id: string
    title: string
    description: string
    event_date: string
    location: string
    status: string
  }
}

// Tipo estendido para eventos com contagem de voluntários
interface EventWithVolunteers extends Event {
  totalVolunteers?: number
  maxVolunteers?: number
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    activeEvents: 0,
    topVolunteers: 0,
    registeredVolunteers: 0,
    completedEvents: 0,
    myParticipations: 0 // Para voluntários/capitães
  })
  const [recentEvents, setRecentEvents] = useState<EventWithVolunteers[]>([])
  const [myParticipations, setMyParticipations] = useState<EventRegistration[]>([])
  const [loading, setLoading] = useState(true)
  // Estado para estatísticas de equipes
  const [teamStats, setTeamStats] = useState({
    totalTeams: 0,
    activeTeams: 0
  })

  // --- FUNÇÃO DE AJUDA PARA FORMATAR A DATA ---
  // Esta função evita erros de fuso horário tratando a data como texto.
  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) {
      return 'Data inválida';
    }
    // A data vem como "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss..."
    // Pegamos apenas a parte da data e dividimos
    const [year, month, day] = dateString.split('T')[0].split('-');

    // Retornamos no formato brasileiro
    return `${day}/${month}/${year}`;
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      if (user?.role === 'admin') {
        // Dashboard para ADMINISTRADORES

        // 1. Buscar eventos ativos (publicados e não passados)
        const { data: activeEventsData } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .gte('event_date', today)

        // 2. Buscar quantidade total de voluntários cadastrados (excluindo administradores)
        const { data: volunteersData } = await supabase
          .from('users')
          .select('id, role, full_name')
          .eq('is_active', true)

        // Filtrar apenas voluntários e capitães (excluir admins da contagem)
        const activeVolunteers = volunteersData?.filter(user =>
          user.role === 'volunteer' ||
          user.role === 'captain'
        )

        // 3. Buscar eventos concluídos
        const { data: completedEventsData } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'completed')

        // 4. Buscar classificação de voluntários e capitães (top avaliados)
        const { data: topVolunteersData } = await supabase
          .from('evaluations')
          .select('volunteer_id, rating')

        const { data: topCaptainsData } = await supabase
          .from('admin_evaluations')
          .select('captain_id, overall_rating')

        // 5. Buscar estatísticas de equipes
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, status')

        const totalTeams = teamsData?.length || 0
        const activeTeams = teamsData?.filter(team => team.status === 'complete').length || 0
        setTeamStats({
          totalTeams,
          activeTeams
        })

        // Calcular médias de avaliação
        const volunteerRatings = new Map()
        topVolunteersData?.forEach(evaluation => {
          const id = evaluation.volunteer_id
          if (!volunteerRatings.has(id)) {
            volunteerRatings.set(id, { ratings: [] })
          }
          volunteerRatings.get(id).ratings.push(evaluation.rating)
        })

        const captainRatings = new Map()
        topCaptainsData?.forEach(evaluation => {
          const id = evaluation.captain_id
          if (!captainRatings.has(id)) {
            captainRatings.set(id, { ratings: [] })
          }
          captainRatings.get(id).ratings.push(evaluation.overall_rating)
        })

        // Contar top performers (média >= 4)
        let topPerformers = 0
        volunteerRatings.forEach(({ ratings }) => {
          const avg = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
          if (avg >= 4) topPerformers++
        })
        captainRatings.forEach(({ ratings }) => {
          const avg = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
          if (avg >= 4) topPerformers++
        })

        setStats({
          activeEvents: activeEventsData?.length || 0,
          topVolunteers: topPerformers,
          registeredVolunteers: activeVolunteers?.length || 0,
          completedEvents: completedEventsData?.length || 0,
          myParticipations: 0 // Não usado para administradores
        })

      } else {
      // Dashboard para VOLUNTÁRIOS/CAPITÃES (lógica original adaptada)

        // Buscar estatísticas
        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'published')

        // Buscar participações do usuário em eventos
        const { data: participationsData } = await supabase
          .from('event_registrations')
          .select(`
            *,
            event:events(
              id,
              title,
              event_date,
              status
            )
          `)
          .eq('user_id', user?.id)
          .in('status', ['confirmed', 'pending'])

        const activeEvents = eventsData?.filter(event => event.event_date >= today).length || 0
        const myParticipations = participationsData?.length || 0
        const completedEvents = participationsData?.filter(part =>
          part.event?.event_date < today && part.event?.status === 'completed'
        ).length || 0

        setStats({
          activeEvents,
          topVolunteers: 0, // Não usado para voluntários
          registeredVolunteers: 0, // Não usado para voluntários
          completedEvents,
          myParticipations: myParticipations
        })
      }

      // Buscar eventos recentes
      const { data: recentEventsData } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(3)

      // Para cada evento, buscar a contagem real de voluntários registrados
      const eventsWithVolunteerCount: EventWithVolunteers[] = await Promise.all(
        (recentEventsData || []).map(async (event) => {
          // Buscar voluntários registrados diretamente no evento
          const { data: registrationCounts } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('event_id', event.id)
            .eq('status', 'confirmed')

          const totalVolunteers = registrationCounts?.length || 0
          const maxVolunteers = event.max_volunteers || 0

          return {
            ...event,
            totalVolunteers,
            maxVolunteers
          }
        })
      )

      setRecentEvents(eventsWithVolunteerCount)

      // Buscar minhas participações mais recentes (registros de eventos)
      const { data: myParticipationsData } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:events(
            id,
            title,
            description,
            event_date,
            location,
            status
          )
        `)
        .eq('user_id', user?.id)
        .in('status', ['confirmed', 'pending'])
        .order('registered_at', { ascending: false })
        .limit(5)

      setMyParticipations(myParticipationsData || [])
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user, fetchDashboardData])

  const getParticipationStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50'
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      case 'cancelled': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getParticipationStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmado'
      case 'pending': return 'Pendente'
      case 'cancelled': return 'Cancelado'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Redirecionar voluntários para sua tela específica
  if (user?.role === 'volunteer') {
    return <Navigate to="/volunteer" replace />
  }
  if (user?.role === 'captain') {
    return <Navigate to="/captain" replace />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Olá, {user?.full_name}! 👋
          </h1>
          <p className="text-gray-600 mt-2">
            Bem-vindo ao seu dashboard de voluntariado
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user?.role === 'admin' ? 'Eventos Ativos' : 'Eventos Disponíveis'}
              </p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeEvents}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user?.role === 'admin' ? 'Top Voluntários/Capitães' : 'Minhas Participações'}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {user?.role === 'admin' ? stats.topVolunteers : stats.myParticipations}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              {user?.role === 'admin' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                  <Clock className="w-6 h-6 text-green-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {user?.role === 'admin' ? 'Voluntários Cadastrados' : 'Total de Eventos'}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {user?.role === 'admin' ? stats.registeredVolunteers : stats.activeEvents}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-full">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Eventos Concluídos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.completedEvents}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-full">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Events */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Próximos Eventos</h2>
              <Link
                to="/events"
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm font-medium"
              >
                <span>Ver todos</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum evento próximo encontrado</p>
            ) : (
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{event.title}</h3>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            {/* --- DATA CORRIGIDA AQUI --- */}
                            <span>{formatDateDisplay(event.event_date)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">
                          {event.totalVolunteers || 0}/{event.maxVolunteers || 0} voluntários
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Participations / Teams Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {user?.role === 'admin' ? 'Gerenciar Equipes' : 'Minhas Participações'}
              </h2>
              <Link
                to="/teams"
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm font-medium"
              >
                <span>{user?.role === 'admin' ? 'Ver todas' : 'Ver todas'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {user?.role === 'admin' ? (
              // Conteúdo para administradores - Estatísticas de equipes
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {teamStats.totalTeams}
                    </div>
                    <div className="text-sm text-blue-700">Total de Equipes em Formação</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {teamStats.activeTeams}
                    </div>
                    <div className="text-sm text-green-700">Equipes Completas</div>
                  </div>
                </div>
                <div className="text-center">
                  <Link
                    to="/teams/create"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Nova Equipe</span>
                  </Link>
                </div>
              </div>
            ) : (
              // Conteúdo para voluntários/capitães - Suas participações
              myParticipations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma participação encontrada</p>
              ) : (
                <div className="space-y-4">
                      {myParticipations.map((participation) => (
                        <div key={participation.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{participation.event?.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                Registro: {participation.terms_accepted ? 'Termos Aceitos' : 'Pendente'}
                              </p>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="w-4 h-4" />
                                  {/* --- DATA CORRIGIDA AQUI --- */}
                                  <span>{formatDateDisplay(participation.event?.event_date)}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{participation.event?.location}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getParticipationStatusColor(participation.status)}`}>
                                {getParticipationStatusText(participation.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
