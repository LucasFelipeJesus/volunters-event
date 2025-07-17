import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Event, Registration } from '../../lib/supabase'
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  Clock,
  MapPin,
  Plus,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    myRegistrations: 0,
    completedEvents: 0
  })
  const [recentEvents, setRecentEvents] = useState<Event[]>([])
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Buscar estatísticas
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')

      const { data: registrationsData } = await supabase
        .from('registrations')
        .select('*')
        .eq('user_id', user?.id)

      const totalEvents = eventsData?.length || 0
      const upcomingEvents = eventsData?.filter(event => event.date >= today).length || 0
      const myRegistrations = registrationsData?.length || 0
      const completedEvents = registrationsData?.filter(reg => reg.status === 'completed').length || 0

      setStats({
        totalEvents,
        upcomingEvents,
        myRegistrations,
        completedEvents
      })

      // Buscar eventos recentes
      const { data: recentEventsData } = await supabase
        .from('events')
        .select(`
          *,
          organizer:users!events_organizer_id_fkey(*)
        `)
        .eq('status', 'published')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(3)

      setRecentEvents(recentEventsData || [])

      // Buscar minhas inscrições
      const { data: myRegistrationsData } = await supabase
        .from('registrations')
        .select(`
          *,
          event:events(*)
        `)
        .eq('user_id', user?.id)
        .order('registered_at', { ascending: false })
        .limit(5)

      setMyRegistrations(myRegistrationsData || [])
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-50'
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      case 'cancelled': return 'text-red-600 bg-red-50'
      case 'completed': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmado'
      case 'pending': return 'Pendente'
      case 'cancelled': return 'Cancelado'
      case 'completed': return 'Concluído'
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
        {user?.role === 'captain' || user?.role === 'admin' ? (
          <Link
            to="/events/create"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Criar Evento</span>
          </Link>
        ) : null}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Eventos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Próximos Eventos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.upcomingEvents}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Minhas Inscrições</p>
              <p className="text-3xl font-bold text-gray-900">{stats.myRegistrations}</p>
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
                            <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">
                          {event.current_volunteers}/{event.max_volunteers} voluntários
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Registrations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Minhas Inscrições</h2>
              <Link
                to="/registrations"
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm font-medium"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {myRegistrations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma inscrição encontrada</p>
            ) : (
              <div className="space-y-4">
                {myRegistrations.map((registration) => (
                  <div key={registration.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{registration.event?.title}</h3>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(registration.event?.date || '').toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{registration.event?.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(registration.status)}`}>
                          {getStatusText(registration.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}