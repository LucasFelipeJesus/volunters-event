import React, { useEffect, useState } from 'react';
import { Star, CheckCircle, AlertCircle, Users, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';



interface EvaluableCaptain {
    event_id: string;
    event_title: string;
    event_date: string;
    team_id: string;
    team_name: string;
    captain_id: string;
    captain_name: string;
    captain_email: string;
    already_evaluated: boolean;
}

interface CaptainEvaluationForm {
    leadership_rating: number;
    communication_rating: number;
    support_rating: number;
    organization_rating: number;
    motivation_rating: number;
    problem_solving_rating: number;
    overall_rating: number;
    positive_aspects: string;
    improvement_suggestions: string;
    comments: string;
    felt_supported: boolean;
    clear_instructions: boolean;
    would_work_again: boolean;
    recommend_captain: boolean;
}

const AvaliarCapitao: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [evaluableCaptains, setEvaluableCaptains] = useState<EvaluableCaptain[]>([]);
    const [selectedCaptain, setSelectedCaptain] = useState<EvaluableCaptain | null>(null);
    const [form, setForm] = useState<CaptainEvaluationForm>({
        leadership_rating: 5,
        communication_rating: 5,
        support_rating: 5,
        organization_rating: 5,
        motivation_rating: 5,
        problem_solving_rating: 5,
        overall_rating: 5,
        positive_aspects: '',
        improvement_suggestions: '',
        comments: '',
        felt_supported: true,
        clear_instructions: true,
        would_work_again: true,
        recommend_captain: true
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Buscar capitães que o voluntário pode avaliar
    useEffect(() => {
        const fetchEvaluableCaptains = async () => {
            if (!user?.id) return;

            setLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_evaluable_captains_for_volunteer', {
                    volunteer_id_param: user.id
                });

                if (error) throw error;

                // If RPC returns nothing (e.g. DB uses 'finished' instead of 'completed'), try a client-side fallback
                const rpcResult = (data || []) as any[];
                if (rpcResult.length > 0) {
                    setEvaluableCaptains(rpcResult);
                } else {
                    // Fallback: query teams where user is a volunteer and event status is completed OR finished
                    const { data: teamsData, error: teamsError } = await supabase
                        .from('team_members')
                        .select(`team:teams(id, name, event_id, captain_id, event:events(id, title, event_date, status)), role_in_team`)
                        .eq('user_id', user.id)
                        .eq('role_in_team', 'volunteer');

                    if (!teamsError && teamsData) {
                        const mapped = (teamsData as any[])
                            .filter(t => t.team && t.team.event && (t.team.event.status === 'completed' || t.team.event.status === 'finished'))
                            .map(t => ({
                                event_id: t.team.event.id,
                                event_title: t.team.event.title,
                                event_date: t.team.event.event_date,
                                team_id: t.team.id,
                                team_name: t.team.name,
                                captain_id: t.team.captain_id,
                                captain_name: '',
                                captain_email: '',
                                already_evaluated: false
                            }));

                        // Try to enrich captain name/email where possible
                        if (mapped.length > 0) {
                            const captainIds = Array.from(new Set(mapped.map(m => m.captain_id).filter(Boolean)));
                            const { filterValidUUIDs } = await import('../../lib/utils')
                            const captainIdsFiltered = filterValidUUIDs(captainIds)
                            if (captainIdsFiltered.length > 0) {
                                const { data: usersData } = await supabase.from('users').select('id, full_name, email').in('id', captainIdsFiltered);
                                const userMap: Record<string, any> = {};
                                (usersData || []).forEach((u: any) => { userMap[u.id] = u; });
                                mapped.forEach(m => {
                                    if (userMap[m.captain_id]) {
                                        m.captain_name = userMap[m.captain_id].full_name;
                                        m.captain_email = userMap[m.captain_id].email;
                                    }
                                });
                            }
                        }

                        setEvaluableCaptains(mapped);
                    } else {
                        setEvaluableCaptains([]);
                    }
                }
            } catch (err) {
                console.error('Erro ao buscar capitães avaliáveis:', err);
                setError('Erro ao carregar capitães para avaliação.');
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluableCaptains();
    }, [user]);

    const handleSelectCaptain = (captain: EvaluableCaptain) => {
        setSelectedCaptain(captain);
        setForm({
            leadership_rating: 5,
            communication_rating: 5,
            support_rating: 5,
            organization_rating: 5,
            motivation_rating: 5,
            problem_solving_rating: 5,
            overall_rating: 5,
            positive_aspects: '',
            improvement_suggestions: '',
            comments: '',
            felt_supported: true,
            clear_instructions: true,
            would_work_again: true,
            recommend_captain: true
        });
        setError(null);
        setSuccess(null);
    };

    const handleRatingChange = (field: keyof CaptainEvaluationForm, value: number) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCaptain || !user?.id) return;

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const { error } = await supabase
                .from('volunteer_evaluations')
                .insert({
                    captain_id: selectedCaptain.captain_id,
                    volunteer_id: user.id,
                    event_id: selectedCaptain.event_id,
                    team_id: selectedCaptain.team_id,
                    ...form
                });

            if (error) throw error;

            setSuccess('Avaliação do capitão registrada com sucesso!');

            // Atualizar lista para marcar como avaliado
            setEvaluableCaptains(prev =>
                prev.map(captain =>
                    captain.captain_id === selectedCaptain.captain_id &&
                        captain.event_id === selectedCaptain.event_id
                        ? { ...captain, already_evaluated: true }
                        : captain
                )
            );

            setSelectedCaptain(null);
        } catch (err) {
            console.error('Erro ao registrar avaliação:', err);
            setError('Erro ao registrar avaliação. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStarRating = (field: keyof CaptainEvaluationForm, value: number, label: string) => (
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
                    Avaliar Capitães
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

                {evaluableCaptains.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum capitão para avaliar
                        </h3>
                        <p className="text-gray-600">
                            Você só pode avaliar capitães após eventos finalizados onde participou como voluntário.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Selecione um capitão para avaliar:
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {evaluableCaptains.map((captain) => (
                                    <div
                                        key={`${captain.captain_id}-${captain.event_id}`}
                                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${captain.already_evaluated
                                            ? 'border-green-200 bg-green-50'
                                            : selectedCaptain?.captain_id === captain.captain_id &&
                                                selectedCaptain?.event_id === captain.event_id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        onClick={() => !captain.already_evaluated && handleSelectCaptain(captain)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">
                                                    {captain.captain_name}
                                                </h4>
                                                <p className="text-sm text-gray-600 mb-2">
                                                    {captain.captain_email}
                                                </p>

                                                <div className="space-y-1 text-sm text-gray-600">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-4 h-4 mr-1" />
                                                        <span>{captain.event_title}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <MapPin className="w-4 h-4 mr-1" />
                                                        <span>{formatDate(captain.event_date)}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Users className="w-4 h-4 mr-1" />
                                                        <span>Equipe: {captain.team_name}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {captain.already_evaluated && (
                                                <div className="flex items-center text-green-600">
                                                    <CheckCircle className="w-5 h-5" />
                                                    <span className="ml-1 text-sm font-medium">Avaliado</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedCaptain && !selectedCaptain.already_evaluated && (
                            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                <h3 className="text-xl font-semibold text-gray-900 mb-6">
                                    Avaliar: {selectedCaptain.captain_name}
                                </h3>
                                <p className="text-gray-600 mb-6">
                                    Evento: {selectedCaptain.event_title} • Equipe: {selectedCaptain.team_name}
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderStarRating('leadership_rating', form.leadership_rating, 'Liderança')}
                                        {renderStarRating('communication_rating', form.communication_rating, 'Comunicação')}
                                        {renderStarRating('support_rating', form.support_rating, 'Suporte à Equipe')}
                                        {renderStarRating('organization_rating', form.organization_rating, 'Organização')}
                                        {renderStarRating('motivation_rating', form.motivation_rating, 'Motivação da Equipe')}
                                        {renderStarRating('problem_solving_rating', form.problem_solving_rating, 'Resolução de Problemas')}
                                    </div>

                                    {renderStarRating('overall_rating', form.overall_rating, 'Avaliação Geral')}

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
                                                placeholder="O que o capitão fez bem..."
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
                                                placeholder="Como o capitão pode melhorar..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Comentários Adicionais
                                        </label>
                                        <textarea
                                            value={form.comments}
                                            onChange={(e) => setForm(prev => ({ ...prev, comments: e.target.value }))}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Comentários gerais sobre a liderança do capitão..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="felt_supported"
                                                    checked={form.felt_supported}
                                                    onChange={(e) => setForm(prev => ({ ...prev, felt_supported: e.target.checked }))}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="felt_supported" className="ml-2 text-sm text-gray-700">
                                                    Me senti apoiado(a) pelo capitão
                                                </label>
                                            </div>

                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="clear_instructions"
                                                    checked={form.clear_instructions}
                                                    onChange={(e) => setForm(prev => ({ ...prev, clear_instructions: e.target.checked }))}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="clear_instructions" className="ml-2 text-sm text-gray-700">
                                                    O capitão deu instruções claras
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="would_work_again"
                                                    checked={form.would_work_again}
                                                    onChange={(e) => setForm(prev => ({ ...prev, would_work_again: e.target.checked }))}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="would_work_again" className="ml-2 text-sm text-gray-700">
                                                    Trabalharia novamente com este capitão
                                                </label>
                                            </div>

                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="recommend_captain"
                                                    checked={form.recommend_captain}
                                                    onChange={(e) => setForm(prev => ({ ...prev, recommend_captain: e.target.checked }))}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="recommend_captain" className="ml-2 text-sm text-gray-700">
                                                    Recomendaria este capitão para outros voluntários
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedCaptain(null)}
                                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            disabled={submitting}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

export default AvaliarCapitao;