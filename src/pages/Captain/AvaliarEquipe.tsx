import React, { useEffect, useState } from 'react';
import { Star, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface Volunteer {
    id: string;
    full_name: string;
    email: string;
}

interface TeamEvent {
    event_id: string;
    event_title: string;
    event_date: string;
    team_id: string;
    team_name: string;
    members: Volunteer[];
}

interface VolunteerEvaluationForm {
    rating: number;
    punctuality_rating: number;
    teamwork_rating: number;
    communication_rating: number;
    initiative_rating: number;
    quality_of_work_rating: number;
    reliability_rating: number;
    positive_aspects: string;
    improvement_suggestions: string;
    comments: string;
    specific_skills: string[];
    would_work_again: boolean;
    recommend_for_future: boolean;
}

const AvaliarEquipe: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
    const [evaluated, setEvaluated] = useState<{ [volunteerId: string]: boolean }>({});
    const [form, setForm] = useState<VolunteerEvaluationForm>({
        rating: 5,
        punctuality_rating: 5,
        teamwork_rating: 5,
        communication_rating: 5,
        initiative_rating: 5,
        quality_of_work_rating: 5,
        reliability_rating: 5,
        positive_aspects: '',
        improvement_suggestions: '',
        comments: '',
        specific_skills: [],
        would_work_again: true,
        recommend_for_future: true
    });
    const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Buscar eventos finalizados em que o usuário é capitão
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (!user?.id) throw new Error('Usuário não autenticado');

                // Primeiro tente usar o RPC seguro (recomendado) — função criada nas migrations
                try {
                    const { data: rpcData, error: rpcError } = await supabase.rpc('get_team_members_for_captain', { captain_id_param: user.id });
                    if (!rpcError && rpcData) {
                        // rpcData: array of rows (one per member)
                        const rows = rpcData as Array<any>;
                        const grouped: Record<string, TeamEvent> = {};
                        rows.forEach(r => {
                            const key = `${r.team_id}-${r.event_id}`;
                            if (!grouped[key]) grouped[key] = {
                                event_id: r.event_id,
                                event_title: r.event_title,
                                event_date: r.event_date,
                                team_id: r.team_id,
                                team_name: r.team_name,
                                members: []
                            };
                            grouped[key].members.push({ id: r.member_id, full_name: r.member_full_name, email: r.member_email });
                        });
                        setTeamEvents(Object.values(grouped));
                        return;
                    }
                } catch (rpcErr) {
                    // se RPC falhar, vamos tentar o fallback cliente (pode ser bloqueado por RLS)
                    console.warn('RPC get_team_members_for_captain falhou, usando fallback:', rpcErr);
                }

                // Fallback: consulta direta (pode falhar por RLS dependendo das políticas)
                const { data, error } = await supabase
                    .from('teams')
                    .select(`
            id,
            name,
            event_id,
            event:events(id, title, event_date, status),
            members:team_members(
              user:users(id, full_name, email),
              role_in_team,
              status
            )
          `)
                    .eq('captain_id', user.id)
                    .in('status', ['active', 'forming', 'finished'])
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Filtrar apenas eventos finalizados
                type SupabaseTeam = {
                    id: string;
                    name: string;
                    event_id: string;
                    event: {
                        id: string;
                        title: string;
                        event_date: string;
                        status: string;
                    };
                    members: Array<{
                        user: {
                            id: string;
                            full_name: string;
                            email: string;
                        } | null;
                        role_in_team: string;
                        status: string;
                    }>;
                };

                const filtered: TeamEvent[] = ((data as unknown) as SupabaseTeam[] || [])
                    .filter((team) => team.event && (team.event.status === 'completed' || team.event.status === 'finished'))
                    .map((team) => ({
                        event_id: team.event.id,
                        event_title: team.event.title,
                        event_date: team.event.event_date,
                        team_id: team.id,
                        team_name: team.name,
                        members: (team.members || [])
                            .filter((m) => m.role_in_team === 'volunteer' && (m.status === 'active' || m.status === 'inactive') && m.user)
                            .map((m) => ({
                                id: m.user!.id,
                                full_name: m.user!.full_name,
                                email: m.user!.email
                            }))
                    }));

                setTeamEvents(filtered);
            } catch {
                alert('Erro ao buscar equipes e eventos para avaliação.');
            } finally {
                setLoading(false);
            }
        };
        if (user?.id) fetchData();
    }, [user]);

    // Buscar avaliações já feitas para o evento e equipe selecionados
    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!selectedEvent) return;
            if (!user?.id) return;
            const { data, error } = await supabase
                .from('evaluations')
                .select('volunteer_id')
                .eq('captain_id', user.id)
                .eq('event_id', selectedEvent.event_id)
                .eq('team_id', selectedEvent.team_id);
            if (!error && data) {
                const evalMap: { [volunteerId: string]: boolean } = {};
                (data as Array<{ volunteer_id: string }>).forEach((ev) => { evalMap[ev.volunteer_id] = true; });
                setEvaluated(evalMap);
            }
        };
        if (selectedEvent) fetchEvaluations();
    }, [selectedEvent, user]);

    const handleSelectEvent = (event: TeamEvent) => {
        setSelectedEvent(event);
        setEvaluated({});
        setSelectedVolunteer(null);
    };

    const handleSelectVolunteer = (vol: Volunteer) => {
        setSelectedVolunteer(vol);
        setForm({
            rating: 5,
            punctuality_rating: 5,
            teamwork_rating: 5,
            communication_rating: 5,
            initiative_rating: 5,
            quality_of_work_rating: 5,
            reliability_rating: 5,
            positive_aspects: '',
            improvement_suggestions: '',
            comments: '',
            specific_skills: [],
            would_work_again: true,
            recommend_for_future: true
        });
        setError(null);
        setSuccess(null);
    };

    const handleRatingChange = (field: keyof VolunteerEvaluationForm, value: number) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent || !selectedVolunteer || !user?.id) return;

        setSubmitting(true);
        setError(null);

        try {
            const { error } = await supabase.from('evaluations').insert({
                volunteer_id: selectedVolunteer.id,
                captain_id: user.id,
                event_id: selectedEvent.event_id,
                team_id: selectedEvent.team_id,
                ...form
            });

            if (error) throw error;

            setEvaluated((prev) => ({ ...prev, [selectedVolunteer.id]: true }));
            setSelectedVolunteer(null);
            setSuccess('Avaliação registrada com sucesso!');
        } catch (err) {
            console.error('Erro ao registrar avaliação:', err);
            setError('Erro ao registrar avaliação. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStarRating = (field: keyof VolunteerEvaluationForm, value: number, label: string) => (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingChange(field, star)}
                        title={`Avaliar com ${star} estrela${star > 1 ? 's' : ''}`}
                        className={`p-1 rounded transition-colors ${star <= value ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
                            }`}
                    >
                        <Star className="w-6 h-6 fill-current" />
                    </button>
                ))}
                <span className="ml-2 text-sm text-gray-600">({value}/5)</span>
            </div>
        </div>
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <Users className="w-6 h-6 mr-2 text-blue-600" />
                    Avaliar Voluntários da Equipe
                </h2>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-red-800">{error}</p>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <p className="text-green-800">{success}</p>
                        </div>
                    </div>
                )}

                {teamEvents.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum evento finalizado encontrado
                        </h3>
                        <p className="text-gray-600">
                            Você só pode avaliar voluntários após eventos finalizados onde foi capitão.
                        </p>
                    </div>
                ) : (
                    <>
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Selecione um evento finalizado:
                                </label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={selectedEvent?.event_id || ''}
                                    onChange={e => {
                                        const ev = teamEvents.find(event => event.event_id === e.target.value);
                                        if (ev) handleSelectEvent(ev);
                                    }}
                                    title="Selecione um evento finalizado"
                                >
                                    <option value="">-- Selecione um evento --</option>
                                    {teamEvents.map(ev => (
                                        <option key={ev.event_id} value={ev.event_id}>
                                            {ev.event_title} - {formatDate(ev.event_date)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedEvent && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Users className="w-5 h-5 mr-2" />
                                        Equipe: {selectedEvent.team_name}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedEvent.members.map(vol => (
                                            <div
                                                key={vol.id}
                                                className={`border rounded-lg p-4 ${evaluated[vol.id]
                                                    ? 'border-green-200 bg-green-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900">{vol.full_name}</h4>
                                                        <p className="text-sm text-gray-600">{vol.email}</p>
                                                    </div>
                                                    {evaluated[vol.id] ? (
                                                        <div className="flex items-center text-green-600">
                                                            <CheckCircle className="w-5 h-5" />
                                                            <span className="ml-1 text-sm font-medium">Avaliado</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                                onClick={() => handleSelectVolunteer(vol)}
                                                        >
                                                            Avaliar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedVolunteer && (
                                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-6">
                                        Avaliar: {selectedVolunteer.full_name}
                                    </h3>
                                    <p className="text-gray-600 mb-6">
                                        Evento: {selectedEvent?.event_title} • Equipe: {selectedEvent?.team_name}
                                    </p>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {renderStarRating('rating', form.rating, 'Avaliação Geral')}
                                            {renderStarRating('punctuality_rating', form.punctuality_rating, 'Pontualidade')}
                                            {renderStarRating('teamwork_rating', form.teamwork_rating, 'Trabalho em Equipe')}
                                            {renderStarRating('communication_rating', form.communication_rating, 'Comunicação')}
                                            {renderStarRating('initiative_rating', form.initiative_rating, 'Iniciativa')}
                                            {renderStarRating('quality_of_work_rating', form.quality_of_work_rating, 'Qualidade do Trabalho')}
                                            {renderStarRating('reliability_rating', form.reliability_rating, 'Confiabilidade')}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Aspectos Positivos
                                                </label>
                                                <textarea
                                                    value={form.positive_aspects}
                                                    onChange={(e) => setForm(prev => ({ ...prev, positive_aspects: e.target.value }))}
                                                    rows={3}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="O que o voluntário fez bem..."
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Sugestões de Melhoria
                                                </label>
                                                <textarea
                                                    value={form.improvement_suggestions}
                                                    onChange={(e) => setForm(prev => ({ ...prev, improvement_suggestions: e.target.value }))}
                                                    rows={3}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="Como o voluntário pode melhorar..."
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Comentários Gerais
                                            </label>
                                            <textarea
                                                value={form.comments}
                                                onChange={(e) => setForm(prev => ({ ...prev, comments: e.target.value }))}
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Comentários adicionais sobre o desempenho..."
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="would_work_again"
                                                    checked={form.would_work_again}
                                                    onChange={(e) => setForm(prev => ({ ...prev, would_work_again: e.target.checked }))}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="would_work_again" className="ml-2 text-sm text-gray-700">
                                                    Trabalharia novamente com este voluntário
                                                </label>
                                            </div>

                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="recommend_for_future"
                                                    checked={form.recommend_for_future}
                                                    onChange={(e) => setForm(prev => ({ ...prev, recommend_for_future: e.target.checked }))}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="recommend_for_future" className="ml-2 text-sm text-gray-700">
                                                    Recomendaria para eventos futuros
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedVolunteer(null)}
                                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                disabled={submitting}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                        Salvando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                        Salvar Avaliação
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AvaliarEquipe;
