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
    AlertTriangle
} from 'lucide-react'

// Tipos específicos para o dashboard
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
            id: string;
            role_in_team: 'captain' | 'volunteer';
            status: 'active' | 'inactive' | 'removed';
            user?: {
                id: string;
                full_name: string;
                email: string;
            };
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

// --- FUNÇÃO CORRIGIDA PARA FORMATAR A DATA ---
const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return 'Data inválida';
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    if (day && month && year) {
        return `${day}/${month}/${year}`;
    }
    return dateString;
};

export const VolunteerDashboard: React.FC = () => {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState<'participations' | 'evaluations' | 'history'>('participations')
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    const [availableEvents, setAvailableEvents] = useState<VolunteerEvent[]>([])
    const [myParticipations, setMyParticipations] = useState<MyParticipation[]>([])
    const [myEvaluations, setMyEvaluations] = useState<MyEvaluation[]>([])
    const [stats, setStats] = useState<VolunteerStats>({
        totalParticipations: 0,
        activeParticipations: 0,
        completedEvents: 0,
        averageRating: 0,
        totalEvaluations: 0,
        bestCategory: ''
    })

    const [termsModal, setTermsModal] = useState({
        isOpen: false, eventId: '', eventName: '', termsContent: '',
        questions: [] as QuestionWithOptions[], loading: false
    });
    const [viewTermsModal, setViewTermsModal] = useState({
        isOpen: false, eventName: '', termsContent: '', acceptanceDate: null as string | null,
        questions: [] as QuestionWithOptions[], userResponses: [] as UserFormResponse[]
    });

    const fetchVolunteerData = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const todayString = new Date().toISOString().split('T')[0];

            const { data: eventsData, error: eventsError } = await supabase.from('events').select('*').eq('status', 'published').gte('event_date', todayString).order('event_date', { ascending: true });
            if (eventsError) throw eventsError;

            const { data: userRegistrations } = await supabase.from('event_registrations').select('event_id, status').eq('user_id', user.id).in('status', ['confirmed', 'pending']);
            const userRegistrationMap = new Map(userRegistrations?.map(reg => [reg.event_id, reg.status]));

            const eventsWithCounts = await Promise.all(
                (eventsData || []).map(async (event) => {
                    const { count } = await supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('event_id', event.id).in('status', ['confirmed', 'pending']);
                    return { ...event, current_registrations: count || 0 };
                })
            );
            const processedEvents: VolunteerEvent[] = eventsWithCounts.map((event) => {
                const totalSpots = event.max_volunteers || 0;
                const availableSpots = Math.max(0, totalSpots - event.current_registrations);
                return { ...event, isUserRegistered: userRegistrationMap.has(event.id), availableSpots, totalSpots };
            });
            setAvailableEvents(processedEvents);

            const { data: participationsData } = await supabase.from('team_members').select(`*, team:teams(*, event:events(*), captain:users!teams_captain_id_fkey(*), members:team_members(*, user:users(*)))`).eq('user_id', user.id);
            const { data: registrationsData } = await supabase.from('event_registrations').select(`*, events!inner(*)`).eq('user_id', user.id).in('status', ['pending', 'confirmed']);

            const processedParticipations: MyParticipation[] = (participationsData || []).map(p => ({ ...p, can_leave: p.status === 'active' && (p.team?.event?.event_date || '') >= todayString }));
            const processedRegistrations: MyParticipation[] = (registrationsData || []).map(reg => {
                const event = Array.isArray(reg.events) ? reg.events[0] : reg.events;
                return { id: `reg_${reg.id}`, team_id: `direct_${event?.id}`, status: 'active', role_in_team: 'volunteer', joined_at: reg.registered_at, can_leave: true, team: { id: `direct_${event?.id}`, name: 'Inscrição Direta', max_volunteers: event?.max_volunteers || 0, current_volunteers: 1, event, captain: { id: user.id, full_name: user.full_name || 'Usuário', email: user.email || '' }, members: [{ id: `member_${user.id}`, user: { id: user.id, full_name: user.full_name || 'Usuário', email: user.email || '' }, role_in_team: 'volunteer', status: 'active' }] }, registration_id: reg.id };
            });

            const allParticipations = [...processedParticipations, ...processedRegistrations];
            const uniqueParticipations = new Map<string, MyParticipation>();
            const getPriority = (p: MyParticipation) => (p.role_in_team === 'captain' ? 3 : p.team.name !== 'Inscrição Direta' ? 2 : 1);
            allParticipations.forEach(p => {
                const eventId = p.team?.event?.id;
                if (eventId && (!uniqueParticipations.has(eventId) || getPriority(p) > getPriority(uniqueParticipations.get(eventId)!))) {
                    uniqueParticipations.set(eventId, p);
                }
            });
            const finalParticipations = Array.from(uniqueParticipations.values()).sort((a, b) => (b.team.event.event_date || '').localeCompare(a.team.event.event_date || ''));
            setMyParticipations(finalParticipations);

            const { data: evaluationsData } = await supabase.from('evaluations').select(`*, captain:users!evaluations_captain_id_fkey(id, full_name), event:events(id, title, event_date), team:teams(id, name)`).eq('volunteer_id', user.id);
            setMyEvaluations(evaluationsData || []);

            const activeParticipations = finalParticipations.filter(p => p.status === 'active' && p.team.event.event_date >= todayString).length;
            const completedEvents = finalParticipations.filter(p => p.team.event.event_date < todayString).length;
            const avgRating = evaluationsData && evaluationsData.length > 0 ? evaluationsData.reduce((sum, e) => sum + e.rating, 0) / evaluationsData.length : 0;
            const categoryCount = finalParticipations.reduce((acc, p) => {
                const category = p.team?.event?.category || 'other';
                acc.set(category, (acc.get(category) || 0) + 1);
                return acc;
            }, new Map<string, number>());
            const bestCategory = categoryCount.size > 0 ? [...categoryCount.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0] : '';

            setStats({ totalParticipations: finalParticipations.length, activeParticipations, completedEvents, averageRating: Math.round(avgRating * 10) / 10, totalEvaluations: evaluationsData?.length || 0, bestCategory });

        } catch (error) {
            console.error('Erro ao carregar dados do voluntário:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchVolunteerData();
    }, [fetchVolunteerData]);

    const handleLeaveTeam = async (participationId: string, teamName: string) => {
        const isDirectRegistration = teamName === 'Inscrição Direta';
        const confirmMessage = isDirectRegistration ? 'Tem certeza que deseja cancelar sua inscrição?' : `Tem certeza que deseja sair da equipe "${teamName}"?`;
        if (!window.confirm(confirmMessage)) return;

        try {
            if (participationId.startsWith('reg_')) {
                const participation = myParticipations.find(p => p.id === participationId);
                if (!participation?.registration_id) throw new Error('ID de inscrição não encontrado');
                const { error } = await supabase.from('event_registrations').update({ status: 'cancelled' }).eq('id', participation.registration_id);
                if (error) throw error;
                alert('Sua inscrição foi cancelada com sucesso!');
            } else {
                const { error } = await supabase.from('team_members').update({ status: 'inactive', left_at: new Date().toISOString() }).eq('id', participationId);
                if (error) throw error;
                alert('Você saiu da equipe com sucesso!');
            }
            await fetchVolunteerData();
        } catch (error) {
            console.error('Erro ao sair da equipe/cancelar inscrição:', error);
            alert('Erro ao processar sua solicitação. Tente novamente.');
        }
    };

    const handleQuickRegister = async (eventId: string) => {
        if (!user || user.role !== 'volunteer') {
            alert('Apenas voluntários podem se inscrever em eventos.');
            return;
        }
        try {
            const { data: termsData, error: termsError } = await supabase.from('event_terms').select('terms_content, event_id').eq('event_id', eventId).eq('is_active', true).maybeSingle();
            if (termsError && termsError.code !== 'PGRST116') throw termsError;

            if (termsData) {
                const { data: existingRegistration, error: checkError } = await supabase.from('event_registrations').select('id, status, terms_accepted').eq('event_id', eventId).eq('user_id', user.id).maybeSingle();
                if (checkError) throw checkError;

                if (!existingRegistration || !existingRegistration.terms_accepted) {
                    const { data: eventData, error: eventError } = await supabase.from('events').select('title').eq('id', eventId).single();
                    if (eventError) throw eventError;

                    const { data: questionsData, error: questionsError } = await supabase.from('event_terms_questions').select(`*, options:event_terms_question_options(*)`).eq('event_id', eventId).eq('is_active', true).order('question_order');
                    if (questionsError) console.error('Erro ao buscar perguntas:', questionsError);

                    const processedQuestions: QuestionWithOptions[] = (questionsData || []).map(q => ({ ...q, options: q.options || [] }));

                    setTermsModal({ isOpen: true, eventId, eventName: eventData.title, termsContent: termsData.terms_content, questions: processedQuestions, loading: false });
                    return;
                }
            }
            await processEventRegistration(eventId);
        } catch (error) {
            console.error('Erro ao iniciar inscrição:', error);
            alert('Erro ao iniciar inscrição. Tente novamente.');
        }
    };

    const processEventRegistration = async (eventId: string) => {
        try {
            const { data: existingRegistration, error: checkError } = await supabase.from('event_registrations').select('id, status').eq('event_id', eventId).eq('user_id', user!.id).maybeSingle();
            if (checkError) throw checkError;

            if (existingRegistration && ['confirmed', 'pending'].includes(existingRegistration.status)) {
                alert(`Você já possui uma inscrição ${existingRegistration.status === 'confirmed' ? 'confirmada' : 'pendente'} neste evento.`);
                return;
            }

            const { data: eventInfo, error: eventError } = await supabase.from('events').select('id, title, max_volunteers').eq('id', eventId).single();
            if (eventError || !eventInfo) throw eventError || new Error('Evento não encontrado.');

            const { count: activeRegistrations, error: countError } = await supabase.from('event_registrations').select('id', { count: 'exact' }).eq('event_id', eventId).eq('status', 'confirmed');
            if (countError) throw countError;

            if ((eventInfo.max_volunteers || 0) - (activeRegistrations || 0) <= 0) {
                alert('Não há vagas disponíveis neste evento.');
                return;
            }

            if (existingRegistration && existingRegistration.status === 'cancelled') {
                const { error } = await supabase.from('event_registrations').update({ status: 'confirmed', terms_accepted: true, terms_accepted_at: new Date().toISOString() }).eq('id', existingRegistration.id);
                if (error) throw error;
                alert(`Sua inscrição no evento "${eventInfo.title}" foi reativada com sucesso!`);
            } else {
                const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, user_id: user!.id, status: 'confirmed', terms_accepted: true, terms_accepted_at: new Date().toISOString() });
                if (error) throw error;
                alert(`Você foi inscrito com sucesso no evento "${eventInfo.title}"!`);
            }
            await fetchVolunteerData();
        } catch (error: any) {
            console.error('Erro ao se inscrever no evento:', error);
            alert(error.code === '23505' ? 'Você já está inscrito neste evento.' : 'Erro ao se inscrever no evento. Tente novamente.');
        }
    };

    const handleAcceptTerms = async (responses: UserFormResponse[]) => {
        setTermsModal(prev => ({ ...prev, loading: true }));
        try {
            if (responses.length > 0) {
                const responsePromises = responses.map(res => supabase.from('event_terms_responses').upsert({ user_id: user!.id, event_id: termsModal.eventId, question_id: res.questionId, selected_options: res.selectedOptions, text_response: res.textResponse || null, responded_at: new Date().toISOString() }, { onConflict: 'user_id,event_id,question_id' }));
                const results = await Promise.all(responsePromises);
                if (results.some(r => r.error)) throw new Error('Erro ao salvar respostas do formulário');
            }
            await processEventRegistration(termsModal.eventId);
            handleCloseTermsModal();
        } catch (error) {
            console.error('Erro ao aceitar termos:', error);
            alert('Erro ao aceitar termos. Tente novamente.');
        } finally {
            setTermsModal(prev => ({ ...prev, loading: false }));
        }
    };

    const handleCloseTermsModal = () => setTermsModal({ isOpen: false, eventId: '', eventName: '', termsContent: '', questions: [], loading: false });

    const handleViewEventTerms = async (eventId: string, eventTitle: string) => {
        try {
            const { data: termsData } = await supabase.from('event_terms').select('terms_content').eq('event_id', eventId).eq('is_active', true).single();
            if (!termsData) { alert('Termos não encontrados.'); return; }

            const { data: registrationData } = await supabase.from('event_registrations').select('terms_accepted_at').eq('event_id', eventId).eq('user_id', user!.id).eq('terms_accepted', true).maybeSingle();
            const { data: questionsData } = await supabase.from('event_terms_questions').select(`*, options:event_terms_question_options(*)`).eq('event_id', eventId).eq('is_active', true).order('question_order');
            const { data: responsesData } = await supabase.from('event_terms_responses').select('*').eq('event_id', eventId).eq('user_id', user!.id);

            const formattedQuestions: QuestionWithOptions[] = (questionsData || []).map(q => ({ ...q, options: q.options || [] }));
            const userResponses: UserFormResponse[] = (responsesData || []).map(res => ({ questionId: res.question_id, selectedOptions: res.selected_options || [], textResponse: res.text_response || undefined }));

            setViewTermsModal({ isOpen: true, eventName: eventTitle, termsContent: termsData.terms_content, acceptanceDate: registrationData?.terms_accepted_at || null, questions: formattedQuestions, userResponses });
        } catch (error) {
            console.error('Erro ao carregar termos do evento:', error);
            alert('Erro ao carregar termos. Tente novamente.');
        }
    };

    const handleCloseViewTermsModal = () => setViewTermsModal({ isOpen: false, eventName: '', termsContent: '', acceptanceDate: null, questions: [], userResponses: [] });

    const handleCancelRegistration = async (eventId: string, eventTitle: string) => {
        if (!window.confirm(`Tem certeza que deseja cancelar sua inscrição no evento "${eventTitle}"?`)) return;
        try {
            const { error } = await supabase.from('event_registrations').update({ status: 'cancelled', terms_accepted: false, terms_accepted_at: null }).eq('event_id', eventId).eq('user_id', user!.id);
            if (error) throw error;
            alert('Inscrição cancelada com sucesso!');
            await fetchVolunteerData();
        } catch (error) {
            console.error('Erro ao cancelar inscrição:', error);
            alert('Erro ao cancelar inscrição. Tente novamente.');
        }
    };

    const renderStarRating = (rating: number) => (
        <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />)}
            <span className="text-sm text-gray-600 ml-1">({rating.toFixed(1)})</span>
        </div>
    );

    const formatTime = (timeString?: string) => timeString?.slice(0, 5) || '';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-50 border-green-200';
            case 'inactive': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'removed': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getStatusText = (status: string, participation?: MyParticipation) => {
        const todayString = new Date().toISOString().split('T')[0];
        if (participation?.team?.name === 'Inscrição Direta' && status === 'active') return 'Ativo';
        if (status === 'inactive' && participation?.team?.event?.event_date && participation.team.event.event_date >= todayString) return 'Aguardando alocar equipe';
        switch (status) {
            case 'active': return 'Ativo';
            case 'inactive': return 'Inativo';
            case 'removed': return 'Removido';
            default: return status;
        }
    };

    const getCategoryLabel = (category: string) => {
        const categories: { [key: string]: string } = { 'agenda-FS': 'Agenda FS', 'corporativo': 'Corporativo', 'education': 'Educação', 'health': 'Saúde', 'environment': 'Meio Ambiente', 'social': 'Social', 'culture': 'Cultura', 'sports': 'Esportes' };
        return categories[category] || category;
    };

    const filteredEvents = availableEvents.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredParticipations = myParticipations.filter(p =>
        p.team?.event?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team?.event?.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const historicParticipations = myParticipations.filter(p => {
        const todayString = new Date().toISOString().split('T')[0];
        return p.team?.event?.event_date < todayString;
    });

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    }

    return (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Bem-vindo, {user?.full_name}! 🎯</h1>
                        <p className="text-gray-600 mt-2">Seu centro de voluntariado: gerencie suas participações e descubra novos eventos.</p>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                        <p className="text-sm text-gray-500 text-left sm:text-right">Avaliação média</p>
                        {stats.averageRating > 0 ? renderStarRating(stats.averageRating) : <p className="text-sm text-gray-400">Sem avaliações ainda</p>}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200"><div className="flex items-center space-x-3"><div className="bg-blue-100 p-2 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm font-medium text-blue-600">Ativas</p><p className="text-xl font-bold text-blue-900">{stats.activeParticipations}</p></div></div></div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200"><div className="flex items-center space-x-3"><div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div><div><p className="text-sm font-medium text-green-600">Concluídas</p><p className="text-xl font-bold text-green-900">{stats.completedEvents}</p></div></div></div>
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200"><div className="flex items-center space-x-3"><div className="bg-yellow-100 p-2 rounded-lg"><Star className="w-5 h-5 text-yellow-600" /></div><div><p className="text-sm font-medium text-yellow-600">Avaliações</p><p className="text-xl font-bold text-yellow-900">{stats.totalEvaluations}</p></div></div></div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200"><div className="flex items-center space-x-3"><div className="bg-purple-100 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div><div><p className="text-sm font-medium text-purple-600">Top Categoria</p><p className="text-sm font-bold text-purple-900 truncate">{stats.bestCategory ? getCategoryLabel(stats.bestCategory) : 'N/A'}</p></div></div></div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Eventos Disponíveis</h2>
                    <p className="text-gray-600 mt-1">Encontre novas oportunidades para participar.</p>
                </div>
                <div className="p-6">
                    {filteredEvents.length === 0 ? (
                        <div className="text-center py-12"><Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="text-lg font-medium text-gray-900">Nenhum evento disponível</h3><p className="text-sm text-gray-500 mt-2">Volte mais tarde para novas oportunidades.</p></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredEvents.map((event) => (
                                <div key={event.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col hover:shadow-md transition-shadow">
                                    {event.image_url && <img src={event.image_url} alt={event.title} className="w-full h-32 object-cover rounded-lg mb-4" />}
                                    <div className="flex-grow flex flex-col">
                                        <div className="flex-grow space-y-3">
                                            <div className="flex items-start justify-between">
                                                <h3 className="font-semibold text-gray-900 flex-1 pr-2">{event.title}</h3>
                                                <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${event.isUserRegistered ? 'bg-green-100 text-green-800' : event.availableSpots > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{event.isUserRegistered ? 'Inscrito' : event.availableSpots > 0 ? 'Disponível' : 'Lotado'}</span>
                                            </div>
                                            <div className="space-y-2 text-sm text-gray-600">
                                                <div className="flex items-center space-x-2"><Calendar className="w-4 h-4 text-gray-400" /><span>{formatDateDisplay(event.event_date)}</span></div>
                                                <div className="flex items-center space-x-2"><Clock className="w-4 h-4 text-gray-400" /><span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span></div>
                                                <div className="flex items-center space-x-2"><MapPin className="w-4 h-4 text-gray-400" /><span>{event.location}</span></div>
                                                <div className="flex items-center space-x-2"><Users className="w-4 h-4 text-gray-400" /><span>{event.totalSpots - event.availableSpots}/{event.totalSpots} vagas</span></div>
                                            </div>
                                        </div>
                                        <div className="pt-3 mt-auto border-t border-gray-200 flex items-center justify-between">
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{getCategoryLabel(event.category)}</span>
                                            <div className="flex space-x-2">
                                                {event.isUserRegistered ? (
                                                    <>
                                                        <button onClick={() => handleViewEventTerms(event.id, event.title)} className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"><FileText className="w-4 h-4" /><span>Ver Termos</span></button>
                                                        <button onClick={() => handleCancelRegistration(event.id, event.title)} className="flex items-center space-x-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"><LogOut className="w-4 h-4" /><span>Cancelar</span></button>
                                                    </>
                                                ) : event.availableSpots > 0 && (
                                                        <button onClick={() => handleQuickRegister(event.id)} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">Inscrever-se</button>
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

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                        {[{ id: 'participations', label: 'Minhas Participações', icon: Users }, { id: 'evaluations', label: 'Minhas Avaliações', icon: Star }, { id: 'history', label: 'Histórico', icon: Clock }].map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                <tab.icon className="w-5 h-5" /><span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="p-6">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    {activeTab === 'participations' && (
                        <div>
                            {filteredParticipations.filter(p => p.team.event.event_date >= new Date().toISOString().split('T')[0]).length === 0 ? (
                                <div className="text-center py-12"><Users className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="text-lg font-medium text-gray-900">Nenhuma participação ativa</h3><p className="text-sm text-gray-500 mt-2">Inscreva-se em um evento para vê-lo aqui.</p></div>
                            ) : (
                                <div className="space-y-4">
                                        {filteredParticipations.filter(p => p.team.event.event_date >= new Date().toISOString().split('T')[0]).map((p) => (
                                            <div key={p.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-2">
                                                        <h3 className="font-semibold text-gray-900">{p.team?.event?.title}</h3>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(p.status)}`}>{getStatusText(p.status, p)}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mt-4">
                                                        <div className="flex items-center space-x-2"><Calendar className="w-4 h-4 text-gray-400" /><span>{formatDateDisplay(p.team?.event?.event_date)}</span></div>
                                                        <div className="flex items-center space-x-2"><Clock className="w-4 h-4 text-gray-400" /><span>{formatTime(p.team?.event?.start_time)} - {formatTime(p.team?.event?.end_time)}</span></div>
                                                        <div className="flex items-center space-x-2"><MapPin className="w-4 h-4 text-gray-400" /><span>{p.team?.event?.location}</span></div>
                                                    </div>
                                                </div>
                                                {p.can_leave && <button onClick={() => handleLeaveTeam(p.id, p.team?.name || '')} className="flex items-center space-x-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"><LogOut className="w-4 h-4" /><span>{p.team?.name === 'Inscrição Direta' ? 'Cancelar' : 'Sair'}</span></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'evaluations' && (
                        <div>
                            {myEvaluations.length === 0 ? (
                                <div className="text-center py-12"><Star className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="text-lg font-medium text-gray-900">Nenhuma avaliação recebida</h3><p className="text-sm text-gray-500 mt-2">Suas avaliações aparecerão aqui após os eventos.</p></div>
                            ) : (
                                <div className="space-y-4">
                                        {myEvaluations.map((e) => (
                                            <div key={e.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{e.event?.title}</h3>
                                                    <p className="text-sm text-gray-600">{formatDateDisplay(e.event?.event_date)}</p>
                                                </div>
                                                {renderStarRating(e.rating)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'history' && (
                        <div>
                            {historicParticipations.length === 0 ? (
                                <div className="text-center py-12"><Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="text-lg font-medium text-gray-900">Nenhum histórico de eventos</h3><p className="text-sm text-gray-500 mt-2">Eventos concluídos aparecerão aqui.</p></div>
                            ) : (
                                <div className="space-y-4">
                                        {historicParticipations.map((p) => (
                                            <div key={p.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{p.team?.event?.title}</h3>
                                                    <p className="text-sm text-gray-600">{formatDateDisplay(p.team?.event?.event_date)}</p>
                                                </div>
                                                {myEvaluations.find(e => e.event.id === p.team.event.id) ? renderStarRating(myEvaluations.find(e => e.event.id === p.team.event.id)!.rating) : <div className="flex items-center space-x-1 text-xs text-gray-400"><AlertTriangle className="w-4 h-4" /><span>Sem avaliação</span></div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <EventTermsModal isOpen={termsModal.isOpen} onClose={handleCloseTermsModal} onAccept={handleAcceptTerms} eventName={termsModal.eventName} termsContent={termsModal.termsContent} questions={termsModal.questions} loading={termsModal.loading} />
            <ViewEventTermsModal isOpen={viewTermsModal.isOpen} onClose={handleCloseViewTermsModal} eventName={viewTermsModal.eventName} termsContent={viewTermsModal.termsContent} acceptanceDate={viewTermsModal.acceptanceDate} questions={viewTermsModal.questions} userResponses={viewTermsModal.userResponses} />
        </div>
    );
};
