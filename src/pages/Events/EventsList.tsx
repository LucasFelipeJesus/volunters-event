import React, { useState, useEffect, useMemo } from 'react'
import { filterValidUUIDs } from '../../lib/utils'
import { Link } from 'react-router-dom'
import { supabase, Event, EventRegistration } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { 
  Calendar, 
  MapPin, 
  Users, 
  Search,
  Plus,
  Clock,
  Tag,
  TrendingUp, // Agora será usado
  CheckCircle,  // Agora será usado
  AlertCircle  // Agora será usado
} from 'lucide-react'

// --- FUNÇÃO AUXILIAR PARA CONTAR VOLUNTÁRIOS ---
  function getEventVolunteerCount(event: any) {
    // Para evitar double-counting, coletamos user_ids de inscrições diretas e de membros alocados
    const userIds = new Set()

    ;(event.event_registrations || []).forEach((reg: any) => {
      if ((reg.status === 'confirmed' || reg.status === 'pending') && reg.user_id) {
        userIds.add(reg.user_id)
      }
    })

    ;(event.teams || []).forEach((team: any) => {
      ;(team.members || []).forEach((m: any) => {
        if ((m.status === 'active' || m.status === 'confirmed') && m.user_id) {
          userIds.add(m.user_id)
        }
      })
    })

    return {
      current: userIds.size,
      max: event.max_volunteers || 0,
    }
  }

// --- FUNÇÃO CORRIGIDA PARA FORMATAR A DATA ---
const formatDateDisplay = (dateString?: string) => {
  if (!dateString) return 'Data inválida';
  const [year, month, day] = dateString.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
};

export const EventsList: React.FC = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    const updatePastEventsStatus = async () => {
      const todayString = new Date().toISOString().split('T')[0];
      // Busca eventos publicados/in_progress com data passada
      const { data: outdatedEvents, error } = await supabase
        .from('events')
        .select('id, event_date, status')
        .in('status', ['published', 'in_progress'])
        .lt('event_date', todayString);
      if (error) return;
      if (outdatedEvents && outdatedEvents.length > 0) {
        const ids = outdatedEvents.map(e => e.id);
          const idsFiltered = filterValidUUIDs(ids)
          if (idsFiltered.length > 0) {
          await supabase
            .from('events')
            .update({ status: 'completed' })
            .in('id', idsFiltered);
        }
      }
    };
    updatePastEventsStatus().then(fetchEvents);
  }, [])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          admin:users!events_admin_id_fkey(*),
          teams(max_volunteers, members:team_members(id, status, user_id)),
          event_registrations(id, status, user_id)
        `)
        .order('event_date', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Erro ao buscar eventos:', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        activeEvents: 0,
        completedEvents: 0,
        totalVolunteers: 0,
        availableSpots: 0,
        occupancyRate: 0,
      };
    }

    const todayString = new Date().toISOString().split('T')[0];

    // Total de eventos
    const totalEvents = events.length
    // Eventos ativos: status published ou in_progress e data >= hoje
    const activeEvents = events.filter(e => ['published', 'in_progress'].includes(e.status) && e.event_date >= todayString).length
    // Eventos concluídos: status completed ou data < hoje
    const completedEvents = events.filter(e => e.status === 'completed' || e.event_date < todayString).length

    // Estatísticas de alocação só para eventos ativos
    let totalVolunteers = 0
    let totalMaxVolunteers = 0
    events.filter(e => ['published', 'in_progress'].includes(e.status) && e.event_date >= todayString).forEach(event => {
      const count = getEventVolunteerCount(event);
      totalVolunteers += count.current;
      totalMaxVolunteers += count.max;
    });

    const availableSpots = totalMaxVolunteers - totalVolunteers
    const occupancyRate = totalMaxVolunteers > 0 ? Math.round((totalVolunteers / totalMaxVolunteers) * 100) : 0

    return {
      totalEvents,
      activeEvents,
      completedEvents,
      totalVolunteers,
      availableSpots,
      occupancyRate
    }
  }, [events])

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory

    return matchesSearch && matchesStatus && matchesCategory
  })

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.slice(0, 5)
  }

  const isEventFull = (event: Event) => {
    const count = getEventVolunteerCount(event);
    return count.current >= count.max;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Eventos</h1>
          <p className="text-gray-600 mt-1">
            Encontre e gerencie oportunidades de voluntariado.
          </p>
        </div>
        {user?.role === 'captain' || user?.role === 'admin' ? (
          <Link
            to="/events/create"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5" />
            <span>Criar Evento</span>
          </Link>
        ) : null}
      </div>

      {/* Panorama Geral - Statistics Dashboard */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Panorama Geral</h2>
        {/* --- JSX CORRIGIDO COM ÍCONES RESTAURADOS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {/* Total de Eventos */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg"><Calendar className="w-6 h-6 text-blue-600" /></div>
              <div>
                <p className="text-sm font-medium text-blue-600">Total</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalEvents}</p>
              </div>
            </div>
          </div>
          {/* Eventos Ativos */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="w-6 h-6 text-green-600" /></div>
              <div>
                <p className="text-sm font-medium text-green-600">Ativos</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeEvents}</p>
              </div>
            </div>
          </div>
          {/* Eventos Concluídos */}
          <div className="bg-gray-100 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-200 p-2 rounded-lg"><AlertCircle className="w-6 h-6 text-gray-600" /></div>
              <div>
                <p className="text-sm font-medium text-gray-600">Concluídos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedEvents}</p>
              </div>
            </div>
          </div>
          {/* Total de Voluntários */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg"><Users className="w-6 h-6 text-purple-600" /></div>
              <div>
                <p className="text-sm font-medium text-purple-600">Alocados</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalVolunteers}</p>
              </div>
            </div>
          </div>
          {/* Vagas Disponíveis */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center space-x-3">
              <div className="bg-yellow-100 p-2 rounded-lg"><Users className="w-6 h-6 text-yellow-600" /></div>
              <div>
                <p className="text-sm font-medium text-yellow-600">Vagas</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.availableSpots}</p>
              </div>
            </div>
          </div>
          {/* Taxa de Ocupação */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 p-2 rounded-lg"><TrendingUp className="w-6 h-6 text-indigo-600" /></div>
              <div>
                <p className="text-sm font-medium text-indigo-600">Ocupação</p>
                <p className="text-2xl font-bold text-indigo-900">{stats.occupancyRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por título, local ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filtrar por status"
            >
              <option value="all">Todos os Status</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
              <option value="completed">Concluídos</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filtrar por categoria"
            >
              <option value="all">Todas as Categorias</option>
              <option value="agenda-FS">Agenda FS</option>
              <option value="corporativo">Corporativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum evento encontrado</h3>
          <p className="text-gray-500">Tente ajustar os filtros ou criar um novo evento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col hover:shadow-lg transition-shadow duration-300">
              {event.image_url && (
                <Link to={`/events/${event.id}`}>
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                </Link>
              )}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex-grow">
                  <div className="flex items-start justify-between mb-2">
                    {event.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Tag className="w-3 h-3 mr-1.5" />
                        {event.category}
                      </span>
                    )}
                    {/* Selo de evento finalizado */}
                    {event.status === 'completed' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700 ml-2">
                        <CheckCircle className="w-3 h-3 mr-1.5 text-gray-600" />
                        Finalizado
                      </span>
                    )}
                    {isEventFull(event) && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Lotado
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{event.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{event.description}</p>
                </div>

                <div className="space-y-3 mb-4 text-sm">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">{formatDateDisplay(event.event_date)}</span>
                    {/* Travar edição para admin se evento finalizado */}
                    {user?.role === 'admin' && event.status === 'completed' && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700" title="Edição bloqueada">Edição bloqueada</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-700">
                    <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>
                      {`${getEventVolunteerCount(event).current} de ${getEventVolunteerCount(event).max} voluntários`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                  <div className="text-xs text-gray-500">
                    Por {event.admin?.full_name || 'Admin'}
                  </div>
                  <Link
                    to={`/events/${event.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Ver Detalhes
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
