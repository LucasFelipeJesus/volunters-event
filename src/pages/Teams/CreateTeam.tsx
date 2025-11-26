import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { setUserRole } from '../../lib/services'
import {
    Users,
    X,
    Calendar,
    MapPin,
    User,
    Save,
    ArrowLeft
} from 'lucide-react'

interface Event {
    id: string
    title: string
    description: string
    location: string
    event_date: string
    status: string
}

interface UserProfile {
    id: string
    full_name: string
    email: string
    role: string
}

export const CreateTeam: React.FC = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [loadingVolunteers, setLoadingVolunteers] = useState(false)
    const [events, setEvents] = useState<Event[]>([])
    const [captains, setCaptains] = useState<UserProfile[]>([])
    const [eventVolunteers, setEventVolunteers] = useState<UserProfile[]>([])
    const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([])

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        event_id: '',
        captain_id: '',
        max_volunteers: 5,
        arrival_time: ''
    })

    const [markComplete, setMarkComplete] = useState(false)

    const [errors, setErrors] = useState<Record<string, string>>({})

    // Carregar dados iniciais
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Buscar eventos ativos
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('*')
                    .in('status', ['published', 'in_progress'])
                    .gte('event_date', new Date().toISOString().split('T')[0])
                    .order('event_date', { ascending: true })

                setEvents(eventsData || [])

                // Buscar capitães
                const { data: captainsData } = await supabase
                    .from('users')
                    .select('id, full_name, email, role')
                    .eq('role', 'captain')
                    .eq('is_active', true)
                    .order('full_name')

                setCaptains(captainsData || [])

            } catch (error) {
                console.error('Erro ao carregar dados iniciais:', error)
            }
        }

        if (user?.role === 'admin') {
            fetchInitialData()
        }
    }, [user])

    // Carregar voluntários inscritos no evento selecionado
    useEffect(() => {
        const fetchRegisteredVolunteers = async () => {
            if (!formData.event_id) {
                setEventVolunteers([])
                setSelectedVolunteers([])
                return
            }

            setLoadingVolunteers(true)
            try {
                // Buscar voluntários inscritos no evento (event_registrations)
                // Consideramos status 'confirmed' e 'pending' como inscritos
                const { data: registrationsData, error: regsError } = await supabase
                    .from('event_registrations')
                    .select('user:users(id, full_name, email, role, is_active), status')
                    .eq('event_id', formData.event_id)
                    .in('status', ['confirmed', 'pending'])

                if (regsError) {
                    throw regsError
                }

                // Extrair apenas os usuários ativos com role 'volunteer'
                // Capitães não devem aparecer na lista de voluntários disponíveis
                const allVolunteersData = (registrationsData || [])
                    .map((r: any) => r.user)
                    .filter((u: any) => u && u.role === 'volunteer' && u.is_active)

                // Extrair capitães inscritos neste evento (para preencher a seleção de capitão)
                const captainsFromRegs = (registrationsData || [])
                    .map((r: any) => r.user)
                    .filter((u: any) => u && u.role === 'captain' && u.is_active)

                // Atualiza a lista de capitães exibida no formulário (apenas os inscritos no evento)
                setCaptains(captainsFromRegs || [])

                // Buscar voluntários já alocados em equipes deste evento
                const { data: allocatedVolunteersData } = await supabase
                    .from('team_members')
                    .select(`
                        user_id,
                        teams!inner(
                            id,
                            event_id
                        )
                    `)
                    .eq('status', 'active')
                    .eq('teams.event_id', formData.event_id)

                // Filtrar voluntários disponíveis (não estão em outras equipes deste evento)
                const allocatedVolunteerIds = allocatedVolunteersData?.map(member => member.user_id) || []
                const availableVolunteers = (allVolunteersData || []).filter(
                    (volunteer: any) => !allocatedVolunteerIds.includes(volunteer.id)
                )

                setEventVolunteers(availableVolunteers)                // Limpar seleção anterior quando trocar de evento
                setSelectedVolunteers([])

            } catch (error) {
                console.error('Erro ao carregar voluntários disponíveis:', error)
                setEventVolunteers([])
            } finally {
                setLoadingVolunteers(false)
            }
        }

        fetchRegisteredVolunteers()
    }, [formData.event_id])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))

        // Quando trocar de evento, limpar seleção de voluntários e capitão
        if (name === 'event_id') {
            setSelectedVolunteers([])
            setFormData(prev => ({
                ...prev,
                captain_id: '',
                [name]: value
            }))
        }

        // Limpar erro do campo
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }))
        }
    }

    const handleVolunteerToggle = (volunteerId: string) => {
        setSelectedVolunteers(prev => {
            if (prev.includes(volunteerId)) {
                return prev.filter(id => id !== volunteerId)
            } else if (prev.length < formData.max_volunteers) {
                return [...prev, volunteerId]
            }
            return prev
        })
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.name.trim()) {
            newErrors.name = 'Nome da equipe é obrigatório'
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Descrição da estação é obrigatória'
        }

        if (!formData.event_id) {
            newErrors.event_id = 'Selecione um evento'
        }

        if (!formData.captain_id) {
            newErrors.captain_id = 'Selecione um capitão'
        }

        if (formData.max_volunteers < 1 || formData.max_volunteers > 20) {
            newErrors.max_volunteers = 'Número de voluntários deve ser entre 1 e 20'
        }

        // Permitir criar equipe com apenas o capitão (sem voluntários selecionados)
        // porque agora capitães não aparecem na lista de voluntários disponíveis.
        if (selectedVolunteers.length === 0 && !formData.captain_id) {
            newErrors.volunteers = 'Selecione pelo menos um voluntário'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setLoading(true)

        try {
            // 1. Criar a equipe
            const initialStatus = markComplete ? 'complete' : 'forming'

            const { data: team, error: teamError } = await supabase
                .from('teams')
                .insert({
                    name: formData.name,
                    event_id: formData.event_id,
                    arrival_time: formData.arrival_time || null,
                    captain_id: formData.captain_id,
                    max_volunteers: formData.max_volunteers,
                    current_volunteers: 0, // será atualizado após inserir membros
                    status: initialStatus,
                    created_by: user?.id
                })
                .select()
                .single()

            if (teamError) {
                throw teamError
            }

            // 2. Promover o usuário a capitão se necessário
            const selectedCaptain = captains.find(c => c.id === formData.captain_id)
            if (selectedCaptain && selectedCaptain.role !== 'captain') {
                const error = await setUserRole(selectedCaptain.id, 'captain')
                if (error) throw error
            }

            // 3. Adicionar o capitão como membro da equipe
            const { error: captainError } = await supabase
                .from('team_members')
                .insert({
                    team_id: team.id,
                    user_id: formData.captain_id,
                    role_in_team: 'captain',
                    status: 'active'
                })

            if (captainError) {
                throw captainError
            }

            // 3. Adicionar voluntários selecionados
            const volunteerInserts = selectedVolunteers.map(volunteerId => {
                const user = (eventVolunteers || []).find((v: any) => v.id === volunteerId) || captains.find(c => c.id === volunteerId)
                const roleInTeam = user && user.role === 'captain' ? 'captain' : 'volunteer'
                return {
                    team_id: team.id,
                    user_id: volunteerId,
                    role_in_team: roleInTeam,
                    status: 'active'
                }
            })

            if (volunteerInserts.length > 0) {
                const { error: volunteersError } = await supabase
                    .from('team_members')
                    .insert(volunteerInserts)

                if (volunteersError) {
                    throw volunteersError
                }
            }

            // Atualizar contagem real de membros ativos na equipe
            try {
                const { data: activeMembers } = await supabase
                    .from('team_members')
                    .select('id')
                    .eq('team_id', team.id)
                    .eq('status', 'active')

                const realCount = (activeMembers || []).length || 0
                const { error: updateCountError } = await supabase
                    .from('teams')
                    .update({ current_volunteers: realCount })
                    .eq('id', team.id)

                if (updateCountError) {
                    console.warn('Não foi possível atualizar current_volunteers:', updateCountError)
                }
            } catch (err) {
                console.warn('Erro ao calcular contagem real de membros:', err)
            }

            // Se a equipe foi criada como 'forming', mas o usuário marcou para completar
            // (ou a equipe atingiu o número máximo imediatamente), podemos atualizar
            // o status para 'complete'. Aqui respeitamos a escolha do admin.
            try {
                if (!markComplete) {
                    // se o admin não marcou como completa, não forçamos alteração
                } else {
                    // só permitimos marcar como complete se houver pelo menos 1 membro ativo
                    const { data: activeMembersCheck } = await supabase
                        .from('team_members')
                        .select('id')
                        .eq('team_id', team.id)
                        .eq('status', 'active')

                    const realCountCheck = (activeMembersCheck || []).length || 0
                    if (realCountCheck < 1) {
                        setErrors({ submit: 'Não é possível marcar como completa: a equipe precisa ter pelo menos 1 membro ativo.' })
                    } else {
                        const { error: setCompleteError } = await supabase
                            .from('teams')
                            .update({ status: 'complete', updated_at: new Date().toISOString() })
                            .eq('id', team.id)

                        if (setCompleteError) {
                            console.warn('Não foi possível marcar equipe como completa:', setCompleteError)
                        }
                    }
                }
            } catch (err) {
                console.warn('Erro ao setar status final da equipe:', err)
            }

            // 4. Criar notificação personalizada (simulada via console por enquanto)
            console.log(`✅ Equipe "${formData.name}" criada com sucesso!`)
            console.log(`📋 Descrição da estação: ${formData.description}`)
            console.log(`👨‍💼 Capitão: ${captains.find(c => c.id === formData.captain_id)?.full_name}`)
            console.log(`👥 Voluntários: ${selectedVolunteers.length}`)

            // Redirecionar para a lista de equipes
            navigate('/teams')

        } catch (error) {
            console.error('Erro ao criar equipe:', error)
            setErrors({ submit: 'Erro ao criar equipe. Tente novamente.' })
        } finally {
            setLoading(false)
        }
    }

    if (user?.role !== 'admin') {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">Acesso restrito a administradores</p>
            </div>
        )
    }

    const selectedEvent = events.find(e => e.id === formData.event_id)

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/teams')}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Voltar para equipes"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Criar Nova Equipe</h1>
                        <p className="text-gray-600 mt-1">
                            Configure uma nova equipe para um evento específico
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Seleção de Evento - PRIMEIRO */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                        <Calendar className="w-5 h-5 mr-2" />
                        Evento
                    </h2>

                    <div>
                        <label htmlFor="event_id" className="block text-sm font-medium text-gray-700 mb-2">
                            Selecionar Evento *
                        </label>
                        <select
                            id="event_id"
                            name="event_id"
                            value={formData.event_id}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.event_id ? 'border-red-300' : 'border-gray-300'
                                }`}
                        >
                            <option value="">Selecione um evento...</option>
                            {events.map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.title} - {new Date(event.event_date).toLocaleDateString('pt-BR')}
                                </option>
                            ))}
                        </select>
                        {errors.event_id && <p className="text-red-600 text-sm mt-1">{errors.event_id}</p>}
                    </div>

                    {selectedEvent && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <h3 className="font-medium text-blue-900">{selectedEvent.title}</h3>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-blue-700">
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{new Date(selectedEvent.event_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <MapPin className="w-4 h-4" />
                                    <span>{selectedEvent.location}</span>
                                </div>
                            </div>
                            <p className="text-sm text-blue-600 mt-2">{selectedEvent.description}</p>
                        </div>
                    )}
                </div>

                {/* Informações da Equipe - SEGUNDO */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                        <Users className="w-5 h-5 mr-2" />
                        Informações da Equipe
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Nome da Equipe *
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="Ex: Equipe Alpha"
                            />
                            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label htmlFor="max_volunteers" className="block text-sm font-medium text-gray-700 mb-2">
                                Máximo de Voluntários *
                            </label>
                            <input
                                type="number"
                                id="max_volunteers"
                                name="max_volunteers"
                                min="1"
                                max="20"
                                value={formData.max_volunteers}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.max_volunteers ? 'border-red-300' : 'border-gray-300'
                                    }`}
                            />
                            {errors.max_volunteers && <p className="text-red-600 text-sm mt-1">{errors.max_volunteers}</p>}
                        </div>
                        <div>
                            <label htmlFor="arrival_time" className="block text-sm font-medium text-gray-700 mb-2">
                                Hora de Chegada (opcional)
                            </label>
                            <input
                                type="time"
                                id="arrival_time"
                                name="arrival_time"
                                value={formData.arrival_time}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300`}
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={markComplete}
                                onChange={(e) => setMarkComplete(e.target.checked)}
                                className="form-checkbox h-4 w-4 text-blue-600"
                            />
                            <span className="ml-2 text-sm text-gray-700">Marcar equipe como completa ao criar</span>
                        </label>
                    </div>

                    <div className="mt-6">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                            Descrição da Estação *
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            rows={3}
                            value={formData.description}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.description ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder="Descreva o que esta equipe fará e em que estação trabalhará..."
                        />
                        {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
                    </div>
                </div>

                {/* Seleção de Capitão */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                        <User className="w-5 h-5 mr-2" />
                        Capitão da Equipe
                    </h2>

                    <div>
                        <label htmlFor="captain_id" className="block text-sm font-medium text-gray-700 mb-2">
                            Selecionar Capitão *
                        </label>
                        <select
                            id="captain_id"
                            name="captain_id"
                            value={formData.captain_id}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.captain_id ? 'border-red-300' : 'border-gray-300'
                                }`}
                        >
                            <option value="">Selecione um capitão...</option>
                            {captains.map(captain => (
                                <option key={captain.id} value={captain.id}>
                                    {captain.full_name} ({captain.email})
                                </option>
                            ))}
                        </select>
                        {errors.captain_id && <p className="text-red-600 text-sm mt-1">{errors.captain_id}</p>}
                    </div>
                </div>

                {/* Seleção de Voluntários */}
                {formData.event_id && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                            <Users className="w-5 h-5 mr-2" />
                            Voluntários Disponíveis
                        </h2>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600">
                                Selecione até {formData.max_volunteers} voluntários para esta equipe.
                                Selecionados: {selectedVolunteers.length}/{formData.max_volunteers}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                Apenas voluntários que não estão em outras equipes deste evento são mostrados
                            </p>
                        </div>

                        {errors.volunteers && <p className="text-red-600 text-sm mb-4">{errors.volunteers}</p>}

                        {loadingVolunteers ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-gray-600">Carregando voluntários...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {eventVolunteers.map(volunteer => {
                                    const isSelected = selectedVolunteers.includes(volunteer.id)
                                    const canSelect = selectedVolunteers.length < formData.max_volunteers

                                    return (
                                        <div
                                            key={volunteer.id}
                                            onClick={() => (isSelected || canSelect) && handleVolunteerToggle(volunteer.id)}
                                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${isSelected
                                                ? 'border-blue-500 bg-blue-50'
                                                : canSelect
                                                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-900">{volunteer.full_name}</h4>
                                                    <p className="text-sm text-gray-600">{volunteer.email}</p>
                                                </div>
                                                <div className="ml-2">
                                                    {isSelected ? (
                                                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                            <X className="w-4 h-4 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-6 h-6 border-2 rounded-full ${canSelect ? 'border-gray-300' : 'border-gray-200'
                                                            }`} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {!loadingVolunteers && eventVolunteers.length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-gray-500">
                                    Nenhum voluntário disponível para este evento
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Todos os voluntários podem já estar alocados em outras equipes deste evento
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Erro de submissão */}
                {errors.submit && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-600">{errors.submit}</p>
                    </div>
                )}

                {/* Botões de Ação */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => navigate('/teams')}
                        className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>{loading ? 'Criando...' : 'Criar Equipe'}</span>
                    </button>
                </div>
            </form>
        </div>
    )
}
