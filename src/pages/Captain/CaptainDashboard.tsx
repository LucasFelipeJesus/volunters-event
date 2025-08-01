import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { EventTermsModal } from '../../components/EventTermsModal'
import { ViewEventTermsModal } from '../../components/ViewEventTermsModal'
import { QuestionWithOptions, UserFormResponse } from '../../types/termsForm'
import {
    Calendar,
    Users,
    Clock,
    MapPin,
    Star,
    CheckCircle,
    TrendingUp,
    Search,
    LogOut,
    FileText,
    AlertTriangle // Mantido pois é usado na aba 'Histórico'
} from 'lucide-react'

// Tipos específicos para o dashboard do voluntário


interface VolunteerEvent {
    id: string
    title: string
    description: string
    event_date: string
    start_time: string
    end_time: string
    location: string
    status: string
    category: string
    image_url?: string
    isUserRegistered: boolean
    availableSpots: number
    totalSpots: number
}

interface MyParticipation {
    id: string
    team_id: string
    role_in_team: 'captain' | 'volunteer'
    status: 'active' | 'inactive' | 'removed'
    joined_at: string
    left_at?: string
    can_leave: boolean
    team: {
        id: string
        name: string
        description?: string
        max_volunteers: number
        current_volunteers: number
        event: {
            id: string
            title: string
            event_date: string
            start_time: string
            end_time: string
            location: string
            status: string
            category: string
            max_volunteers?: number
        }
        captain: {
            id: string
            full_name: string
            email: string
        }
        members?: Array<{
            id: string
            full_name: string
            email: string
            role_in_team: 'captain' | 'volunteer'
            status: 'active' | 'inactive' | 'removed'
        }>
    }
    registration_id?: string
}

interface MyEvaluation {
    id: string
    rating: number
    comment: string
    teamwork_rating: number
    punctuality_rating: number
    communication_rating: number
    created_at: string
    captain: {
        id: string
        full_name: string
    }
    event: {
        id: string
        title: string
        event_date: string
    }
    team: {
        id: string
        name: string
    }
}

interface VolunteerStats {
    totalParticipations: number
    activeParticipations: number
    completedEvents: number
    averageRating: number
    totalEvaluations: number
    bestCategory: string
}

export const CaptainDashboard: React.FC = () => {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<'participations' | 'evaluations' | 'history'>('participations')
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Estados dos dados
    const [availableEvents, setAvailableEvents] = useState<VolunteerEvent[]>([])
    const [myParticipations, setMyParticipations] = useState<MyParticipation[]>([])
    const [myEvaluations, setMyEvaluations] = useState<MyEvaluation[]>([])

    // Estados para o modal de termos
    const [termsModal, setTermsModal] = useState({
        isOpen: false,
        eventId: '',
        eventName: '',
        termsContent: '',
        questions: [] as QuestionWithOptions[],
        loading: false
    })

    // Estado para o modal de visualização de termos
    const [viewTermsModal, setViewTermsModal] = useState({
        isOpen: false,
        eventName: '',
        termsContent: '',
        acceptanceDate: null as string | null,
        questions: [] as QuestionWithOptions[],
        userResponses: [] as UserFormResponse[]
    })

    const [stats, setStats] = useState<VolunteerStats>({
        totalParticipations: 0,
        activeParticipations: 0,
        completedEvents: 0,
        averageRating: 0,
        totalEvaluations: 0,
        bestCategory: ''
    })

    // SUBSTITUA A FUNÇÃO 'fetchVolunteerData' INTEIRA POR ESTA VERSÃO FINAL
    const fetchVolunteerData = useCallback(async () => {
        if (!user) return

        try {
            setLoading(true)

            // --- As buscas de dados iniciais permanecem as mesmas ---
            const today = new Date().toISOString().split('T')[0]
            const { data: eventsData, error: eventsError } = await supabase.from('events').select('*').eq('status', 'published').gte('event_date', today).order('event_date', { ascending: true })
            if (eventsError) throw eventsError
            const { data: userRegistrations } = await supabase.from('event_registrations').select('event_id, status').eq('user_id', user.id).in('status', ['confirmed', 'pending'])
            const userRegistrationMap = new Map()
            if (userRegistrations) { userRegistrations.forEach(reg => { if (reg.status === 'confirmed' || reg.status === 'pending') { userRegistrationMap.set(reg.event_id, reg.status) } }) }
            const eventsWithRegistrationInfo = await Promise.all(
                (eventsData || []).map(async (event) => {
                const { count } = await supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('event_id', event.id).in('status', ['confirmed', 'pending'])
                return { ...event, current_registrations: count || 0 }
            })
        )
            const processedEvents: VolunteerEvent[] = eventsWithRegistrationInfo.map((event) => {
            const totalSpots = event.max_volunteers || 0
            const availableSpots = Math.max(0, totalSpots - (event.current_registrations || 0))
            return {
                id: event.id, title: event.title, description: event.description,
                event_date: event.event_date, start_time: event.start_time, end_time: event.end_time,
                location: event.location, status: event.status, category: event.category,
                image_url: event.image_url, isUserRegistered: userRegistrationMap.has(event.id), availableSpots, totalSpots
            }
        })
            setAvailableEvents(processedEvents)

            // --- Processamento das participações (sem alterações) ---
            const { data: participationsData } = await supabase.from('team_members').select(`*, team:teams(id, name, description, max_volunteers, current_volunteers, event:events(*), captain:users!teams_captain_id_fkey(*), members:team_members(id, role_in_team, status, user:users(*)))`).eq('user_id', user.id).order('joined_at', { ascending: false })
            const { data: registrationsData } = await supabase.from('event_registrations').select(`*, events!inner(*)`).eq('user_id', user.id).in('status', ['pending', 'confirmed'])
            const { data: teamsAsCaptainData } = await supabase.from('teams').select(`*, event:events(*), captain:users!teams_captain_id_fkey(*), members:team_members(id, role_in_team, status, user:users(*))`).eq('captain_id', user.id)

            const processedParticipations: MyParticipation[] = (participationsData || []).map(p => ({
                id: p.id, team_id: p.team_id, role_in_team: p.role_in_team, status: p.status, joined_at: p.joined_at,
                can_leave: p.status === 'active' && new Date(p.team?.event?.event_date || '') > new Date(),
                team: p.team
            }))
            const teamsAsCaptainParticipations: MyParticipation[] = (teamsAsCaptainData || []).map(team => ({
                id: `captain_${team.id}`, team_id: team.id, role_in_team: 'captain', status: 'active', joined_at: team.created_at, can_leave: false,
                team: team
            }));
            const processedRegistrations: MyParticipation[] = (registrationsData || []).map(reg => {
                const event = Array.isArray(reg.events) ? reg.events[0] : reg.events;
                return {
                id: `reg_${reg.id}`, team_id: `direct_${event?.id}`, status: 'active', role_in_team: 'volunteer', joined_at: reg.registered_at,
                can_leave: true,
                team: {
                    id: `direct_${event?.id}`, name: 'Inscrição Direta', max_volunteers: event?.max_volunteers || 0, current_volunteers: 1, event: event,
                    captain: { id: user.id, full_name: user.full_name || 'Usuário', email: user.email || '' },
                    members: [{ id: user.id, full_name: user.full_name || 'Usuário', email: user.email || '', role_in_team: 'volunteer', status: 'active' }]
                },
                registration_id: reg.id
            };
        });

            // <<< CORREÇÃO FINAL NA LÓGICA DE COMBINAÇÃO E FILTRO >>>
            // 1. Juntar todas as participações possíveis.
            const allPossibleParticipations = [
                ...processedRegistrations,
                ...processedParticipations,
                ...teamsAsCaptainParticipations
            ];

            // 2. Criar um mapa de participações únicas, dando prioridade para a mais completa.
            const uniqueParticipationsMap = new Map<string, MyParticipation>();

            // Função para determinar a "qualidade" da informação
            const getPriority = (p: MyParticipation): number => {
                if (p.role_in_team === 'captain') return 3; // Capitão é a mais importante
                if (p.team.name !== 'Inscrição Direta') return 2; // Membro de equipe real
                return 1; // Inscrição direta é a menos importante
            };

            allPossibleParticipations.forEach(p => {
                const eventId = p.team?.event?.id;
                if (!eventId) return;

            const existing = uniqueParticipationsMap.get(eventId);

            // Se não existe, adiciona. Se a nova participação for de maior prioridade que a existente, substitui.
            if (!existing || getPriority(p) > getPriority(existing)) {
                uniqueParticipationsMap.set(eventId, p);
            }
        });

            const finalParticipations = Array.from(uniqueParticipationsMap.values());
            setMyParticipations(finalParticipations);

            // O resto da função continua igual, mas usando 'finalParticipations' para as estatísticas
            const { data: evaluationsData } = await supabase.from('evaluations').select(`*, captain:users!evaluations_captain_id_fkey(id, full_name), event:events(id, title, event_date), team:teams(id, name)`).eq('volunteer_id', user.id).order('created_at', { ascending: false })
            setMyEvaluations(evaluationsData || [])

            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const activeParticipations = finalParticipations.filter(p => p.status === 'active' && new Date(p.team.event.event_date) >= currentDate).length;
            const completedEvents = finalParticipations.filter(p => new Date(p.team.event.event_date) < new Date()).length;
            const avgRating = evaluationsData && evaluationsData.length > 0 ? evaluationsData.reduce((sum, e) => sum + e.rating, 0) / evaluationsData.length : 0;
            const categoryCount = new Map();
            finalParticipations.forEach(p => {
                const category = p.team?.event?.category || 'other';
                categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
            });
            const bestCategory = categoryCount.size > 0 ? Array.from(categoryCount.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0] : '';
            setStats({
            totalParticipations: finalParticipations.length,
            activeParticipations,
            completedEvents,
            averageRating: Math.round(avgRating * 10) / 10,
            totalEvaluations: evaluationsData?.length || 0,
            bestCategory
        });

        } catch (error) {
            console.error('Erro ao carregar dados do voluntário:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchVolunteerData()
    }, [fetchVolunteerData])

    const handleLeaveTeam = async (participationId: string, teamName: string) => {
        const isDirectRegistration = teamName === 'Inscrição Direta'
        const confirmMessage = isDirectRegistration
            ? 'Tem certeza que deseja cancelar sua inscrição?'
            : `Tem certeza que deseja sair da equipe "${teamName}"?`

        if (!confirm(confirmMessage)) {
            return
        }

        try {
            // Verificar se é uma inscrição direta (id inicia com 'reg_')
            if (participationId.startsWith('reg_')) {
                // Encontrar a participação para obter o registration_id
                const participation = myParticipations.find(p => p.id === participationId) as MyParticipation & { registration_id?: string }
                if (!participation?.registration_id) {
                    throw new Error('ID de inscrição não encontrado')
                }

                // Cancelar inscrição direta
                const { error } = await supabase
                    .from('event_registrations')
                    .update({
                        status: 'cancelled'
                    })
                    .eq('id', participation.registration_id)

                if (error) throw error
                alert('Sua inscrição foi cancelada com sucesso!')
            } else {
                // Sair de equipe normal
                const { error } = await supabase
                    .from('team_members')
                    .update({
                        status: 'inactive',
                        left_at: new Date().toISOString()
                    })
                    .eq('id', participationId)

                if (error) throw error
                alert('Você saiu da equipe com sucesso!')
            }

            // Atualizar a lista local
            await fetchVolunteerData()

        } catch (error) {
            console.error('Erro ao sair da equipe/cancelar inscrição:', error)
            alert('Erro ao processar sua solicitação. Tente novamente.')
        }
    }

    const handleQuickRegister = async (eventId: string) => {
        if (!user || user.role !== 'volunteer') {
            alert('Apenas voluntários podem se inscrever em eventos.')
            return
        }

        try {
            // Primeiro, verificar se existem termos para este evento
            const { data: termsData, error: termsError } = await supabase
                .from('event_terms')
                .select('terms_content, event_id')
                .eq('event_id', eventId)
                .eq('is_active', true)
                .maybeSingle()

            if (termsError && termsError.code !== 'PGRST116') {
                throw termsError
            }

            // Se existem termos, verificar se o usuário já os aceitou
            if (termsData) {
                const { data: existingRegistration, error: checkError } = await supabase
                    .from('event_registrations')
                    .select('id, status, terms_accepted')
                    .eq('event_id', eventId)
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (checkError) throw checkError

                // Se não há registro anterior ou não aceitou os termos, mostrar modal
                if (!existingRegistration || !existingRegistration.terms_accepted) {
                    // Buscar nome do evento
                    const { data: eventData, error: eventError } = await supabase
                        .from('events')
                        .select('title')
                        .eq('id', eventId)
                        .single()

                    if (eventError) throw eventError

                    // Buscar perguntas do evento
                    const { data: questionsData, error: questionsError } = await supabase
                        .from('event_terms_questions')
                        .select(`
                            *,
                            options:event_terms_question_options(*)
                        `)
                        .eq('event_id', eventId)
                        .eq('is_active', true)
                        .order('question_order')

                    if (questionsError) {
                        console.error('Erro ao buscar perguntas:', questionsError)
                        // Continuar mesmo se não conseguir buscar perguntas
                    }

                    // Processar perguntas com suas opções ordenadas
                    const processedQuestions: QuestionWithOptions[] = (questionsData || []).map(question => ({
                        ...question,
                        options: question.options || []
                    }))

                    // Mostrar modal de termos
                    setTermsModal({
                        isOpen: true,
                        eventId: eventId,
                        eventName: eventData.title,
                        termsContent: termsData.terms_content,
                        questions: processedQuestions,
                        loading: false
                    })
                    return
                }
            }

            // Continuar com a inscrição normal se não há termos ou já foram aceitos
            await processEventRegistration(eventId)

        } catch (error) {
            console.error('Erro ao iniciar inscrição:', error)
            alert('Erro ao iniciar inscrição. Tente novamente.')
        }
    }

    const processEventRegistration = async (eventId: string) => {
        try {
            // Verificar se o usuário já está inscrito neste evento
            const { data: existingRegistration, error: checkError } = await supabase
                .from('event_registrations')
                .select('id, status')
                .eq('event_id', eventId)
                .eq('user_id', user!.id)
                .maybeSingle()

            if (checkError) throw checkError

            // Se já existe uma inscrição ativa (confirmed ou pending), bloquear
            if (existingRegistration && (existingRegistration.status === 'confirmed' || existingRegistration.status === 'pending')) {
                const statusMsg = existingRegistration.status === 'confirmed' ? 'confirmada' : 'pendente'
                alert(`Você já possui uma inscrição ${statusMsg} neste evento.`)
                return
            }

            // Buscar informações do evento para verificar vagas
            const { data: eventInfo, error: eventError } = await supabase
                .from('events')
                .select('id, title, max_volunteers')
                .eq('id', eventId)
                .single()

            if (eventError) throw eventError

            if (!eventInfo) {
                alert('Evento não encontrado.')
                return
            }

            // Contar inscrições confirmadas
            const { count: activeRegistrations, error: countError } = await supabase
                .from('event_registrations')
                .select('id', { count: 'exact' })
                .eq('event_id', eventId)
                .eq('status', 'confirmed')

            if (countError) throw countError

            const totalSpots = eventInfo.max_volunteers || 0
            const availableSpots = totalSpots - (activeRegistrations || 0)

            if (availableSpots <= 0) {
                alert('Não há vagas disponíveis neste evento.')
                return
            }

            // Se existe uma inscrição cancelada, reativar ela
            if (existingRegistration && existingRegistration.status === 'cancelled') {
                const { error } = await supabase
                    .from('event_registrations')
                    .update({
                        status: 'confirmed',
                        terms_accepted: true, // Marcar que os termos foram aceitos
                        terms_accepted_at: new Date().toISOString()
                    })
                    .eq('id', existingRegistration.id)

                if (error) throw error

                alert(`Sua inscrição no evento "${eventInfo.title}" foi reativada com sucesso!`)
            } else {
                // Criar nova inscrição
                const { error } = await supabase
                    .from('event_registrations')
                    .insert({
                        event_id: eventId,
                        user_id: user!.id,
                        status: 'confirmed',
                        terms_accepted: true, // Marcar que os termos foram aceitos
                        terms_accepted_at: new Date().toISOString()
                    })

                if (error) throw error

                alert(`Você foi inscrito com sucesso no evento "${eventInfo.title}"!`)
            }

            await fetchVolunteerData()

        } catch (error: unknown) {
            console.error('Erro ao se inscrever no evento:', error)
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
                alert('Você já está inscrito neste evento.')
            } else {
                alert('Erro ao se inscrever no evento. Tente novamente.')
            }
        }
    }

    const handleAcceptTerms = async (responses: UserFormResponse[]) => {
        setTermsModal(prev => ({ ...prev, loading: true }))

        try {
            // Salvar respostas do formulário se houver perguntas
            if (responses.length > 0) {
                const responsePromises = responses.map(response => {
                    return supabase
                        .from('event_terms_responses')
                        .upsert({
                            user_id: user!.id,
                            event_id: termsModal.eventId,
                            question_id: response.questionId,
                            selected_options: response.selectedOptions,
                            text_response: response.textResponse || null,
                            responded_at: new Date().toISOString()
                        }, {
                            onConflict: 'user_id,event_id,question_id'
                        })
                })

                const results = await Promise.all(responsePromises)
                const errors = results.filter(result => result.error)

                if (errors.length > 0) {
                    console.error('Erros ao salvar respostas:', errors)
                    throw new Error('Erro ao salvar algumas respostas do formulário')
                }
            }

            await processEventRegistration(termsModal.eventId)
            setTermsModal({
                isOpen: false,
                eventId: '',
                eventName: '',
                termsContent: '',
                questions: [],
                loading: false
            })
        } catch (error) {
            console.error('Erro ao aceitar termos:', error)
            alert('Erro ao aceitar termos. Tente novamente.')
        } finally {
            setTermsModal(prev => ({ ...prev, loading: false }))
        }
    }

    const handleCloseTermsModal = () => {
        setTermsModal({
            isOpen: false,
            eventId: '',
            eventName: '',
            termsContent: '',
            questions: [],
            loading: false
        })
    }

    const handleViewEventTerms = async (eventId: string, eventTitle: string) => {
        try {
            // Buscar os termos do evento
            const { data: termsData, error: termsError } = await supabase
                .from('event_terms')
                .select('terms_content')
                .eq('event_id', eventId)
                .eq('is_active', true)
                .maybeSingle()

            if (termsError) {
                console.error('Erro ao buscar termos:', termsError)
                alert('Erro ao carregar termos. Tente novamente.')
                return
            }

            if (!termsData) {
                alert('Termos não encontrados para este evento.')
                return
            }

            // Buscar data de aceitação dos termos pelo usuário
            const { data: registrationData, error: regError } = await supabase
                .from('event_registrations')
                .select('terms_accepted_at')
                .eq('event_id', eventId)
                .eq('user_id', user?.id)
                .eq('terms_accepted', true)
                .maybeSingle()

            if (regError) {
                console.error('Erro ao buscar registro de aceitação:', regError)
            }

            // Buscar perguntas do formulário de termos
            const { data: questionsData, error: questionsError } = await supabase
                .from('event_terms_questions')
                .select(`
                    *,
                    options:event_terms_question_options(*)
                `)
                .eq('event_id', eventId)
                .eq('is_active', true)
                .order('question_order', { ascending: true })

            if (questionsError) {
                console.error('Erro ao buscar perguntas:', questionsError)
            }

            // Buscar respostas do usuário para as perguntas
            const { data: responsesData, error: responsesError } = await supabase
                .from('event_terms_responses')
                .select('*')
                .eq('event_id', eventId)
                .eq('user_id', user?.id)

            if (responsesError) {
                console.error('Erro ao buscar respostas:', responsesError)
            }

            // Formatar perguntas com opções
            const formattedQuestions: QuestionWithOptions[] = (questionsData || []).map(question => ({
                ...question,
                options: question.options || []
            }))

            // Formatar respostas do usuário
            const userResponses: UserFormResponse[] = (responsesData || []).map(response => ({
                questionId: response.question_id,
                selectedOptions: response.selected_options || [],
                textResponse: response.text_response || undefined
            }))

            // Abrir modal de visualização
            setViewTermsModal({
                isOpen: true,
                eventName: eventTitle,
                termsContent: termsData.terms_content,
                acceptanceDate: registrationData?.terms_accepted_at || null,
                questions: formattedQuestions,
                userResponses
            })

        } catch (error) {
            console.error('Erro ao carregar termos do evento:', error)
            alert('Erro ao carregar termos. Tente novamente.')
        }
    }

    const handleCloseViewTermsModal = () => {
        setViewTermsModal({
            isOpen: false,
            eventName: '',
            termsContent: '',
            acceptanceDate: null,
            questions: [],
            userResponses: []
        })
    }

    const handleCancelRegistration = async (eventId: string, eventTitle: string) => {
        if (!confirm(`Tem certeza que deseja cancelar sua inscrição no evento "${eventTitle}"?\n\nVocê poderá se inscrever novamente a qualquer momento.`)) {
            return
        }

        try {
            const { error } = await supabase
                .from('event_registrations')
                .update({
                    status: 'cancelled',
                    terms_accepted: false, // Zerar aceitação para forçar releitura
                    terms_accepted_at: null // Limpar timestamp
                })
                .eq('event_id', eventId)
                .eq('user_id', user?.id)

            if (error) throw error

            alert('Inscrição cancelada com sucesso! Você pode se re-inscrever neste evento a qualquer momento.')
            await fetchVolunteerData()

        } catch (error) {
            console.error('Erro ao cancelar inscrição:', error)
            alert('Erro ao cancelar inscrição. Tente novamente.')
        }
    }

    const renderStarRating = (rating: number) => {
        return (
            <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                            }`}
                    />
                ))}
                <span className="text-sm text-gray-600 ml-1">({rating.toFixed(1)})</span>
            </div>
        )
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const formatTime = (timeString: string) => {
        return timeString?.slice(0, 5) || ''
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-50 border-green-200'
            case 'inactive': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'removed': return 'text-red-600 bg-red-50 border-red-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    // Novo: status customizado para inscrição direta sem equipe
    const getStatusText = (status: string, participation?: MyParticipation) => {
        // Se for inscrição direta (sem equipe real) e evento ainda não ocorreu
        if (participation?.team?.name === 'Inscrição Direta' && participation.status === 'active') {
            return 'Ativo';
        }
        if (status === 'inactive' && participation?.team?.event?.event_date) {
            const eventDate = participation.team?.event?.event_date;
            if (eventDate && new Date(eventDate) >= new Date()) {
                return 'Aguardando alocar equipe';
            }
        }
        switch (status) {
            case 'active': return 'Ativo';
            case 'inactive': return 'Inativo';
            case 'removed': return 'Removido';
            default: return status;
        }
    }

    const getCategoryLabel = (category: string) => {
        const categories = {
            education: 'Educação',
            health: 'Saúde',
            environment: 'Meio Ambiente',
            social: 'Social',
            culture: 'Cultura',
            sports: 'Esportes',

        }
        return categories[category as keyof typeof categories] || category
    }

    // Filtros
    const filteredEvents = availableEvents.filter(event => {
        const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.location.toLowerCase().includes(searchTerm.toLowerCase())

        return matchesSearch
    })

    const uniqueEventMap = new Map<string, MyParticipation>();
    myParticipations.forEach(p => {
        const eventId = p.team?.event?.id;
        if (!eventId) return;

        const existingParticipation = uniqueEventMap.get(eventId);

        if (!existingParticipation) {
            uniqueEventMap.set(eventId, p);
            return;
        }

        if (p.team.name !== 'Inscrição Direta' && existingParticipation.team.name === 'Inscrição Direta') {
            uniqueEventMap.set(eventId, p);
            return;
        }

        if (p.status === 'active' && existingParticipation.status !== 'active') {
            uniqueEventMap.set(eventId, p);
            return;
        }
    });
    const participationsByEvent = Array.from(uniqueEventMap.values());

    const filteredParticipations = participationsByEvent.filter(participation => {
        const matchesSearch = participation.team?.event?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            participation.team?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            participation.team?.event?.location?.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesSearch
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (


        <div className="space-y-6">
            {/* Header com boas-vindas e estatísticas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Bem-vindo, {user?.full_name}! 🎯
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Seu centro de voluntariado - gerencie suas participações e descubra novos eventos
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Avaliação média</p>
                            {stats.averageRating > 0 ? (
                                renderStarRating(stats.averageRating)
                            ) : (
                                <p className="text-sm text-gray-400">Sem avaliações ainda</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cards de estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-600">Participações Ativas</p>
                                <p className="text-xl font-bold text-blue-900">{stats.activeParticipations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="flex items-center space-x-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-600">Eventos Concluídos</p>
                                <p className="text-xl font-bold text-green-900">{stats.completedEvents}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <div className="flex items-center space-x-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                                <Star className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-yellow-600">Total Avaliações</p>
                                <p className="text-xl font-bold text-yellow-900">{stats.totalEvaluations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center space-x-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-600">Categoria Favorita</p>
                                <p className="text-sm font-bold text-purple-900">
                                    {stats.bestCategory ? getCategoryLabel(stats.bestCategory) : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção Meu Painel - Eventos Disponíveis */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Eventos</h2>
                    <p className="text-gray-600">Eventos disponíveis para inscrição</p>
                </div>

                <div className="p-6">
                    {filteredEvents.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum evento disponível</h3>
                            <p className="text-gray-500">Novos eventos aparecerão aqui quando estiverem disponíveis.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredEvents.map((event) => (
                                <div key={event.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                                    {event.image_url && (
                                        <img
                                            src={event.image_url}
                                            alt={event.title}
                                            className="w-full h-32 object-cover rounded-lg mb-4"
                                        />
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between">
                                            <h3 className="font-semibold text-gray-900 flex-1">{event.title}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${event.isUserRegistered
                                                ? 'bg-green-100 text-green-800'
                                                : event.availableSpots > 0
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {event.isUserRegistered ? 'Inscrito' :
                                                    event.availableSpots > 0 ? 'Disponível' : 'Lotado'}
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>

                                        <div className="space-y-2 text-sm text-gray-600">
                                            <div className="flex items-center space-x-2">
                                                <Calendar className="w-4 h-4" />
                                                <span>{formatDate(event.event_date)}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Clock className="w-4 h-4" />
                                                <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <MapPin className="w-4 h-4" />
                                                <span>{event.location}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Users className="w-4 h-4" />
                                                <span>{event.totalSpots - event.availableSpots}/{event.totalSpots} vagas</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                {getCategoryLabel(event.category)}
                                            </span>

                                            <div className="flex space-x-2">
                                                {event.isUserRegistered ? (
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleViewEventTerms(event.id, event.title)}
                                                            className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            <span>Ver Termos</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelRegistration(event.id, event.title)}
                                                            className="flex items-center space-x-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                            <span>Cancelar</span>
                                                        </button>
                                                    </div>
                                                ) : event.availableSpots > 0 && (
                                                    <button
                                                        onClick={() => handleQuickRegister(event.id)}
                                                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                                                    >
                                                        Inscrever-se
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Navegação por abas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                        {[
                            { id: 'participations', label: 'Minhas Participações', icon: Users },
                            { id: 'evaluations', label: 'Minhas Avaliações', icon: Star },
                            { id: 'history', label: 'Histórico', icon: Clock }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'participations' | 'evaluations' | 'history')}
                                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Filtros */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Pesquisar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conteúdo das abas */}
                <div className="p-6">
                    {/* Aba: Minhas Participações */}
                    {activeTab === 'participations' && (
                        <div className="space-y-4">
                            {filteredParticipations.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma participação encontrada</h3>
                                    <p className="text-gray-500">Você ainda não está inscrito em nenhuma equipe.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                        {filteredParticipations.map((participation) => (  
                                            console.log('DADOS DA PARTICIPAÇÃO A SER RENDERIZADA:', JSON.stringify(participation, null, 2)),
                                        <div key={participation.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-2">
                                                        <h3 className="font-semibold text-gray-900">
                                                            {participation.team?.event?.title}
                                                        </h3>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(participation.status)}`}>
                                                            {getStatusText(participation.status, participation)}
                                                        </span>
                                                    </div>

                                                            {/* <<< CORREÇÃO FINAL: Exibição da lista de membros >>> */}
                                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <Users className="w-4 h-4 text-blue-600" />
                                                                    <span className="text-sm font-medium text-blue-800">
                                                                        {participation.team?.name}
                                                                    </span>
                                                                </div>
                                                                    {/* Mostra a tag de Capitão apenas se for uma equipe real */}
                                                                    {participation.team?.name !== 'Inscrição Direta' && (
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${participation.role_in_team === 'captain'
                                                                            ? 'bg-purple-100 text-purple-800'
                                                                    : 'bg-green-100 text-green-800'
                                                                    }`}>
                                                                    {participation.role_in_team === 'captain' ? 'Capitão' : 'Voluntário'}
                                                                </span>
                                                                    )}
                                                            </div>
                                                                {/* Capitão e Lista de Membros */}
                                                                <div className="text-sm text-blue-700 space-y-2">
                                                                    <div>
                                                                        <strong>Capitão:</strong> {participation.team.captain.full_name}
                                                            </div>

                                                                    {/* Renderiza a lista de membros apenas se houver mais de uma pessoa */}
                                                                    {participation.team?.members && participation.team.members.length > 1 && (
                                                                        <div className="pt-2">
                                                                    <p className="text-xs font-medium text-blue-800 mb-1">Membros da Equipe:</p>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {participation.team.members
                                                                                    .filter(member => member.status === 'active' && member.id !== participation.team.captain.id)
                                                                            .map((member) => (
                                                                                <span
                                                                                    key={member.id}
                                                                                    className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200"
                                                                                >
                                                                                    {member.full_name}
                                                                                </span>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mt-4">
                                                        <div className="flex items-center space-x-2">
                                                            <Calendar className="w-4 h-4" />
                                                            <span>{formatDate(participation.team?.event?.event_date || '')}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Clock className="w-4 h-4" />
                                                            <span>
                                                                {formatTime(participation.team?.event?.start_time || '')} -
                                                                {formatTime(participation.team?.event?.end_time || '')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <MapPin className="w-4 h-4" />
                                                            <span>{participation.team?.event?.location}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end space-y-2">
                                                    {participation.can_leave && (
                                                        <button
                                                            onClick={() => handleLeaveTeam(participation.id, participation.team?.name || '')}
                                                            className="flex items-center space-x-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                            <span>
                                                                {participation.team?.name === 'Inscrição Direta' ? 'Cancelar Inscrição' : 'Sair da Equipe'}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* <<< CORREÇÃO 2: Conteúdo das abas 'Avaliações' e 'Histórico' restaurado >>> */}
                    {/* Aba: Minhas Avaliações */}
                    {activeTab === 'evaluations' && (
                        <div className="space-y-4">
                            {myEvaluations.length === 0 ? (
                                <div className="text-center py-12">
                                    <Star className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma avaliação ainda</h3>
                                    <p className="text-gray-500">Suas avaliações aparecerão aqui após participar de eventos.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {myEvaluations.map((evaluation) => (
                                        <div key={evaluation.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{evaluation.event?.title}</h3>
                                                    <p className="text-sm text-gray-600">
                                                        Equipe: {evaluation.team?.name} • Avaliado por: {evaluation.captain?.full_name}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">{formatDate(evaluation.created_at)}</p>
                                                    {renderStarRating(evaluation.rating)}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                                <div className="text-sm">
                                                    <p className="text-gray-600">Trabalho em Equipe</p>
                                                    {renderStarRating(evaluation.teamwork_rating)}
                                                </div>
                                                <div className="text-sm">
                                                    <p className="text-gray-600">Pontualidade</p>
                                                    {renderStarRating(evaluation.punctuality_rating)}
                                                </div>
                                                <div className="text-sm">
                                                    <p className="text-gray-600">Comunicação</p>
                                                    {renderStarRating(evaluation.communication_rating)}
                                                </div>
                                            </div>
                                            {evaluation.comment && (
                                                <div className="bg-white rounded p-3 border border-gray-200">
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Comentários:</strong> {evaluation.comment}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Aba: Histórico */}
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {myParticipations.filter(p =>
                                p.team?.event?.status === 'completed' ||
                                new Date(p.team?.event?.event_date || '') < new Date()
                            ).length === 0 ? (
                                <div className="text-center py-12">
                                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum histórico ainda</h3>
                                    <p className="text-gray-500">Eventos concluídos aparecerão aqui.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {myParticipations
                                        .filter(p =>
                                            p.team?.event?.status === 'completed' ||
                                            new Date(p.team?.event?.event_date || '') < new Date()
                                        )
                                        .map((participation) => {
                                            const evaluation = myEvaluations.find(e =>
                                                e.event.id === participation.team?.event?.id
                                            )

                                            return (
                                                <div key={participation.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-3 mb-2">
                                                                <h3 className="font-semibold text-gray-900">
                                                                    {participation.team?.event?.title}
                                                                </h3>
                                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                    Concluído
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mb-3">
                                                                <strong>Equipe:</strong> {participation.team?.name} •
                                                                <strong> Categoria:</strong> {getCategoryLabel(participation.team?.event?.category || '')}
                                                            </p>
                                                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                                                                <div className="flex items-center space-x-2">
                                                                    <Calendar className="w-4 h-4" />
                                                                    <span>{formatDate(participation.team?.event?.event_date || '')}</span>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <MapPin className="w-4 h-4" />
                                                                    <span>{participation.team?.event?.location}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            {evaluation ? (
                                                                <div>
                                                                    <p className="text-xs text-gray-500 mb-1">Sua avaliação</p>
                                                                    {renderStarRating(evaluation.rating)}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center space-x-1 text-xs text-gray-400">
                                                                    <AlertTriangle className="w-4 h-4" />
                                                                    <span>Sem avaliação</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Termos e Condições */}
            <EventTermsModal
                isOpen={termsModal.isOpen}
                onClose={handleCloseTermsModal}
                onAccept={handleAcceptTerms}
                eventName={termsModal.eventName}
                termsContent={termsModal.termsContent}
                questions={termsModal.questions}
                loading={termsModal.loading}
            />

            {/* Modal de Visualização de Termos */}
            <ViewEventTermsModal
                isOpen={viewTermsModal.isOpen}
                onClose={handleCloseViewTermsModal}
                eventName={viewTermsModal.eventName}
                termsContent={viewTermsModal.termsContent}
                acceptanceDate={viewTermsModal.acceptanceDate}
                questions={viewTermsModal.questions}
                userResponses={viewTermsModal.userResponses}
            />
        </div>
    )
}