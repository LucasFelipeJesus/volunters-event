import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
    Users,
    Plus,
    Calendar,
    MapPin,
    User,
    Edit,
    Trash2,
    Filter,
    Eye
} from 'lucide-react'
import ViewTeamModal from '../../components/ViewTeamModal'

interface Team {
    id: string
    name: string
    max_volunteers: number
    current_volunteers: number
    status: string
    created_at: string
    arrival_time?: string
    event: {
        id: string
        title: string
        event_date: string
        location: string
        status: string
    }
    captain: {
        id: string
        full_name: string
        email: string
    }
    members: Array<{
        id: string
        role_in_team: string
        status: string
        user: {
            id: string
            full_name: string
            email: string
        }
    }>
}

export const TeamsManagement: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth()
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState({
        status: '',
        event: '',
        search: ''
    })
    const [events, setEvents] = useState<Array<{ id: string; title: string }>>([])

    const fetchTeams = useCallback(async () => {
        try {
            let query = supabase
                .from('teams')
                .select(`
          *,
          event:events(id, title, event_date, location, status),
          captain:users!teams_captain_id_fkey(id, full_name, email),
          members:team_members(
            id,
            role_in_team,
            status,
            user:users(id, full_name, email)
          )
        `)
                .order('created_at', { ascending: false })

            // Aplicar filtros
            if (filter.status) {
                query = query.eq('status', filter.status)
            }

            if (filter.event) {
                query = query.eq('event_id', filter.event)
            }

            const { data, error } = await query

            if (error) {
                throw error
            }

            let filteredData = data || []

            // Filtrar por busca de texto
            if (filter.search) {
                filteredData = filteredData.filter(team =>
                    team.name.toLowerCase().includes(filter.search.toLowerCase()) ||
                    team.event?.title?.toLowerCase().includes(filter.search.toLowerCase()) ||
                    team.captain?.full_name?.toLowerCase().includes(filter.search.toLowerCase())
                )
            }

            setTeams(filteredData)
        } catch (error) {
            console.error('Erro ao carregar equipes:', error)
        } finally {
            setLoading(false)
        }
    }, [filter])

    const fetchEvents = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('events')
                .select('id, title')
                .eq('status', 'published')
                .order('title')

            setEvents(data || [])
        } catch (error) {
            console.error('Erro ao carregar eventos:', error)
        }
    }, [])

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchTeams()
            fetchEvents()
        }

        // Atualiza equipes ao voltar para a aba/página
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && user?.role === 'admin') {
                fetchTeams()
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [user, fetchTeams, fetchEvents])

    const handleDeleteTeam = async (teamId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta equipe? Esta ação não pode ser desfeita.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', teamId)

            if (error) {
                throw error
            }

            // Recarregar equipes
            fetchTeams()
        } catch (error) {
            console.error('Erro ao excluir equipe:', error)
            alert('Erro ao excluir equipe. Tente novamente.')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'forming': return 'bg-yellow-100 text-yellow-800'
            case 'complete': return 'bg-green-100 text-green-800'
            case 'active': return 'bg-blue-100 text-blue-800'
            case 'finished': return 'bg-gray-100 text-gray-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'forming': return 'Formando'
            case 'complete': return 'Completa'
            case 'active': return 'Ativa'
            case 'finished': return 'Finalizada'
            default: return status
        }
    }

    if (user?.role !== 'admin') {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">Acesso restrito a administradores</p>
            </div>
        )
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
                    <h1 className="text-3xl font-bold text-gray-900">Gerenciar Equipes</h1>
                    <p className="text-gray-600 mt-2">
                        Crie e gerencie equipes para os eventos
                    </p>
                </div>
                <Link
                    to="/teams/create"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    <span>Criar Equipe</span>
                </Link>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <Filter className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-medium text-gray-900">Filtros</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                            Buscar
                        </label>
                        <input
                            type="text"
                            id="search"
                            value={filter.search}
                            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                            placeholder="Nome da equipe, evento, capitão..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            id="status"
                            value={filter.status}
                            onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Todos os status</option>
                            <option value="forming">Formando</option>
                            <option value="complete">Completa</option>
                            <option value="active">Ativa</option>
                            <option value="finished">Finalizada</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="event" className="block text-sm font-medium text-gray-700 mb-1">
                            Evento
                        </label>
                        <select
                            id="event"
                            value={filter.event}
                            onChange={(e) => setFilter(prev => ({ ...prev, event: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Todos os eventos</option>
                            {events.map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => setFilter({ status: '', event: '', search: '' })}
                            className="w-full px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Limpar Filtros
                        </button>
                    </div>
                </div>
            </div>

            {/* Estatísticas Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-2xl font-bold text-blue-600">{teams.length}</div>
                    <div className="text-sm text-gray-600">Total de Equipes</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-2xl font-bold text-green-600">
                        {teams.filter(t => t.status === 'complete').length}
                    </div>
                    <div className="text-sm text-gray-600">Equipes Completas</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-2xl font-bold text-yellow-600">
                        {teams.filter(t => t.status === 'forming').length}
                    </div>
                    <div className="text-sm text-gray-600">Em Formação</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-2xl font-bold text-purple-600">
                            {teams.reduce((sum, team) => {
                                const active = (team.members || []).filter((m: any) => m.status === 'active' || m.status === 'confirmed').length || 0
                                return sum + active
                            }, 0)}
                        </div>
                    <div className="text-sm text-gray-600">Total de Membros</div>
                </div>
            </div>

            {/* Lista de Equipes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Equipes ({teams.length})
                    </h2>
                </div>

                {teams.length === 0 ? (
                    <div className="p-8 text-center">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">Nenhuma equipe encontrada</p>
                        <Link
                            to="/teams/create"
                            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Criar Primeira Equipe</span>
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {teams.map((team) => (
                            <div key={team.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <h3 className="text-lg font-medium text-gray-900">{team.name}</h3>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(team.status)}`}>
                                                {getStatusText(team.status)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                                            <div className="flex items-center space-x-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>{team.event?.title}</span>
                                                <span>({new Date(team.event?.event_date || '').toLocaleDateString('pt-BR')})</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <MapPin className="w-4 h-4" />
                                                <span>{team.event?.location}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <User className="w-4 h-4" />
                                                <span>Capitão: {team.captain?.full_name}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Users className="w-4 h-4" />
                                                <span>{(team.members || []).filter((m: any) => m.status === 'active' || m.status === 'confirmed').length}/{team.max_volunteers} membros</span>
                                            </div>
                                            {team.arrival_time && (
                                                <div className="flex items-center space-x-1">
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                    <span>Chegada: {String(team.arrival_time).slice(0, 5)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Membros da equipe (apenas ativos) */}
                                        <div className="mt-3">
                                            <div className="flex flex-wrap gap-2">
                                                {team.members
                                                    ?.filter((member) => member.status === 'active' || member.status === 'confirmed')
                                                    .slice(0, 5)
                                                    .map((member) => (
                                                        <span
                                                            key={member.id}
                                                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${member.role_in_team === 'captain'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                            }`}
                                                        >
                                                            {member.user.full_name}
                                                            {member.role_in_team === 'captain' && ' (Cap.)'}
                                                        </span>
                                                    ))}
                                                {team.members &&
                                                    team.members.filter((member) => member.status === 'active' || member.status === 'confirmed').length > 5 && (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                                                            +{team.members.filter((member) => member.status === 'active' || member.status === 'confirmed').length - 5} mais
                                                        </span>
                                                    )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2 ml-4">
                                        <button
                                            onClick={() => setSelectedTeamId(team.id)}
                                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Ver equipe"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (team.event?.status === 'completed') {
                                                    alert('Não é possível editar equipes de eventos finalizados.');
                                                    return
                                                }
                                                navigate(`/teams/${team.id}/edit`)
                                            }}
                                            className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                            title="Editar equipe"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (team.event?.status === 'completed') {
                                                    alert('Não é possível excluir equipes de eventos finalizados. Registros devem permanecer para histórico.');
                                                    return
                                                }
                                                handleDeleteTeam(team.id)
                                            }}
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Excluir equipe"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {selectedTeamId && (
                <ViewTeamModal teamId={selectedTeamId} open={!!selectedTeamId} onClose={() => setSelectedTeamId(null)} />
            )}
        </div>
    )
}
