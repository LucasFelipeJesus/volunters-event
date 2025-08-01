import React, { useState, useEffect, useMemo } from 'react'
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
  TrendingUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// --- FUNÇÃO AUXILIAR PARA CONTAR VOLUNTÁRIOS ---
// Centraliza a lógica de contagem para ser reutilizada
const getEventVolunteerCount = (event: Event): { current: number; max: number } => {
  const confirmedRegistrations = event.event_registrations?.filter(
    (reg: EventRegistration) => reg.status === 'confirmed'
  ).length || 0;

  return {
    current: confirmedRegistrations,
    max: event.max_volunteers || 0,
  };
};


export const EventsList: React.FC = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // 1. useEffect foi simplificado para uma única chamada de busca de dados
  useEffect(() => {
    fetchEvents()
  }, [])

  // 2. Apenas uma função para buscar todos os dados necessários
  const fetchEvents = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          admin:users!events_admin_id_fkey(*),
          teams(current_volunteers, max_volunteers),
          event_registrations(id, status)
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

  // 3. As estatísticas são calculadas com useMemo a partir dos eventos já carregados
  // Isso evita chamadas extras à API e é mais performático
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

    const totalEvents = events.length
    const activeEvents = events.filter(e => e.status === 'published' && new Date(e.event_date) >= new Date()).length
    const completedEvents = events.filter(e => e.status === 'completed' || new Date(e.event_date) < new Date()).length

    let totalVolunteers = 0
    let totalMaxVolunteers = 0

    events.forEach(event => {
      const count = getEventVolunteerCount(event); // Usando a função auxiliar
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
  }, [events]) // O cálculo só é refeito quando a lista de eventos muda

  // Filtragem de eventos para exibição
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Funções de formatação
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  // Função para verificar se o evento está lotado, agora usando a função auxiliar
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Eventos</h1>
          <p className="text-gray-600 mt-2">
            Encontre oportunidades de voluntariado próximas a você
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

      {/* Panorama Geral - Statistics Dashboard (agora usando os dados de 'useMemo') */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Panorama Geral</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {/* Total de Eventos */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-600">Total de Eventos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalEvents}</p>
              </div>
            </div>
          </div>

          {/* Eventos Ativos */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">Eventos Ativos</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeEvents}</p>
              </div>
            </div>
          </div>

          {/* Eventos Concluídos */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <AlertCircle className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Concluídos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedEvents}</p>
              </div>
            </div>
          </div>

          {/* Total de Voluntários */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-600">Voluntários Alocados</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalVolunteers}</p>
              </div>
            </div>
          </div>

          {/* Vagas Disponíveis */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center space-x-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-600">Vagas Disponíveis</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.availableSpots}</p>
              </div>
            </div>
          </div>

          {/* Taxa de Ocupação */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-600">Taxa de Ocupação</p>
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
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar eventos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex space-x-4">
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
              <option value="education">Educação</option>
              <option value="health">Saúde</option>
              <option value="environment">Meio Ambiente</option>
              <option value="social">Social</option>
              <option value="culture">Cultura</option>
              <option value="sports">Esportes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum evento encontrado</h3>
          <p className="text-gray-500">Tente ajustar os filtros ou criar um novo evento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                    {event.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-2">
                        <Tag className="w-3 h-3 mr-1" />
                        {event.category}
                      </span>
                    )}
                  </div>
                  {isEventFull(event) && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Lotado
                    </span>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{event.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{formatDate(event.event_date)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-gray-400" />
                    {/* Contagem de voluntários no card, agora mais limpa */}
                    <span>
                      {`${getEventVolunteerCount(event).current}/${getEventVolunteerCount(event).max} voluntários`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Por {event.admin?.full_name}
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