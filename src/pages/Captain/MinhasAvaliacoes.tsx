import React, { useEffect, useState } from 'react';
import { Star, TrendingUp, Users, Calendar, MessageSquare, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface CaptainEvaluation {
    evaluation_id: string;
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
    evaluation_date: string;
    volunteer_id: string;
    volunteer_name: string;
    volunteer_email: string;
    event_id: string;
    event_title: string;
    event_date: string;
    team_id: string;
    team_name: string;
}

interface EvaluationStats {
    total_evaluations: number;
    avg_overall_rating: number;
    avg_leadership: number;
    avg_communication: number;
    avg_support: number;
    avg_organization: number;
    avg_motivation: number;
    avg_problem_solving: number;
    volunteers_felt_supported: number;
    gave_clear_instructions: number;
    would_work_again_count: number;
    recommendations: number;
}

const MinhasAvaliacoes: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<CaptainEvaluation[]>([]);
    const [stats, setStats] = useState<EvaluationStats | null>(null);
    const [selectedEvaluation, setSelectedEvaluation] = useState<CaptainEvaluation | null>(null);
    const [filter, setFilter] = useState<'all' | 'recent' | 'high' | 'low'>('all');

    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!user?.id) return;

            setLoading(true);
            try {
                // Buscar avaliações detalhadas
                const { data: evaluationsData, error: evaluationsError } = await supabase
                    .from('captain_evaluation_details')
                    .select('*')
                    .eq('captain_id', user.id)
                    .order('evaluation_date', { ascending: false });

                if (evaluationsError) throw evaluationsError;
                setEvaluations(evaluationsData || []);

                // Buscar estatísticas
                const { data: statsData, error: statsError } = await supabase
                    .from('captain_evaluation_stats')
                    .select('*')
                    .eq('captain_id', user.id)
                    .single();

                if (statsError && statsError.code !== 'PGRST116') throw statsError;
                setStats(statsData);

            } catch (error) {
                console.error('Erro ao buscar avaliações:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluations();
    }, [user]);

    const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
        const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
        return (
            <div className="flex items-center">
                {Array.from({ length: 5 }, (_, i) => (
                    <Star
                        key={i}
                        className={`${starSize} ${i < Math.floor(rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                            }`}
                    />
                ))}
                <span className="ml-2 text-sm text-gray-600">({rating.toFixed(1)})</span>
            </div>
        );
    };

    const getFilteredEvaluations = () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        switch (filter) {
            case 'recent':
                return evaluations.filter(e => new Date(e.evaluation_date) >= thirtyDaysAgo);
            case 'high':
                return evaluations.filter(e => e.overall_rating >= 4);
            case 'low':
                return evaluations.filter(e => e.overall_rating <= 2);
            default:
                return evaluations;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getPercentage = (count: number, total: number) => {
        return total > 0 ? Math.round((count / total) * 100) : 0;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const filteredEvaluations = getFilteredEvaluations();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                    <BarChart3 className="w-6 h-6 mr-2 text-blue-600" />
                    Minhas Avaliações como Capitão
                </h1>
                <p className="text-gray-600">
                    Veja como os voluntários avaliam sua liderança e desempenho como capitão.
                </p>
            </div>

            {/* Estatísticas */}
            {stats && stats.total_evaluations > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total de Avaliações</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total_evaluations}</p>
                            </div>
                            <Users className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Avaliação Geral</p>
                                <div className="flex items-center mt-1">
                                    {renderStars(stats.avg_overall_rating, 'md')}
                                </div>
                            </div>
                            <Star className="w-8 h-8 text-yellow-400" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Recomendações</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {getPercentage(stats.recommendations, stats.total_evaluations)}%
                                </p>
                                <p className="text-xs text-gray-500">
                                    {stats.recommendations} de {stats.total_evaluations}
                                </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-600" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Trabalhariam Novamente</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {getPercentage(stats.would_work_again_count, stats.total_evaluations)}%
                                </p>
                                <p className="text-xs text-gray-500">
                                    {stats.would_work_again_count} de {stats.total_evaluations}
                                </p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                </div>
            )}

            {/* Gráfico de Competências */}
            {stats && stats.total_evaluations > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Avaliação por Competência</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { label: 'Liderança', value: stats.avg_leadership },
                            { label: 'Comunicação', value: stats.avg_communication },
                            { label: 'Suporte', value: stats.avg_support },
                            { label: 'Organização', value: stats.avg_organization },
                            { label: 'Motivação', value: stats.avg_motivation },
                            { label: 'Resolução de Problemas', value: stats.avg_problem_solving }
                        ].map((competency) => (
                            <div key={competency.label} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">{competency.label}</span>
                                    <span className="text-sm text-gray-600">{competency.value?.toFixed(1) || '0.0'}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${((competency.value || 0) / 5) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista de Avaliações */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Avaliações Recebidas</h2>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as 'all' | 'recent' | 'high' | 'low')}
                            title="Filtrar avaliações"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">Todas as avaliações</option>
                            <option value="recent">Últimos 30 dias</option>
                            <option value="high">Avaliações altas (4-5)</option>
                            <option value="low">Avaliações baixas (1-2)</option>
                        </select>
                    </div>
                </div>

                {filteredEvaluations.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {evaluations.length === 0 ? 'Nenhuma avaliação recebida' : 'Nenhuma avaliação encontrada'}
                        </h3>
                        <p className="text-gray-600">
                            {evaluations.length === 0
                                ? 'Você receberá avaliações dos voluntários após eventos finalizados.'
                                : 'Tente ajustar os filtros para ver mais avaliações.'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredEvaluations.map((evaluation) => (
                            <div
                                key={evaluation.evaluation_id}
                                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => setSelectedEvaluation(evaluation)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-4 mb-2">
                                            <h3 className="font-medium text-gray-900">
                                                {evaluation.volunteer_name}
                                            </h3>
                                            {renderStars(evaluation.overall_rating)}
                                        </div>

                                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-1" />
                                                <span>{evaluation.event_title}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <Users className="w-4 h-4 mr-1" />
                                                <span>{evaluation.team_name}</span>
                                            </div>
                                            <span>{formatDate(evaluation.evaluation_date)}</span>
                                        </div>

                                        {evaluation.positive_aspects && (
                                            <p className="text-sm text-gray-700 mb-2">
                                                <strong>Pontos positivos:</strong> {evaluation.positive_aspects}
                                            </p>
                                        )}

                                        {evaluation.comments && (
                                            <p className="text-sm text-gray-700">
                                                <strong>Comentários:</strong> {evaluation.comments}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end space-y-2">
                                        <div className="flex items-center space-x-2">
                                            {evaluation.recommend_captain && (
                                                <div className="flex items-center text-green-600 text-xs">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    <span>Recomenda</span>
                                                </div>
                                            )}
                                            {evaluation.would_work_again && (
                                                <div className="flex items-center text-blue-600 text-xs">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    <span>Trabalharia novamente</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Detalhes */}
            {selectedEvaluation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    Avaliação Detalhada
                                </h2>
                                <button
                                    onClick={() => setSelectedEvaluation(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="Fechar"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="font-medium text-gray-900 mb-2">
                                    Avaliação de {selectedEvaluation.volunteer_name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {selectedEvaluation.event_title} • {selectedEvaluation.team_name} •
                                    {formatDate(selectedEvaluation.evaluation_date)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Liderança', value: selectedEvaluation.leadership_rating },
                                    { label: 'Comunicação', value: selectedEvaluation.communication_rating },
                                    { label: 'Suporte', value: selectedEvaluation.support_rating },
                                    { label: 'Organização', value: selectedEvaluation.organization_rating },
                                    { label: 'Motivação', value: selectedEvaluation.motivation_rating },
                                    { label: 'Resolução de Problemas', value: selectedEvaluation.problem_solving_rating }
                                ].map((item) => (
                                    <div key={item.label} className="space-y-1">
                                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                        {renderStars(item.value)}
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="font-medium text-gray-900 mb-2">Avaliação Geral</h4>
                                {renderStars(selectedEvaluation.overall_rating, 'md')}
                            </div>

                            {selectedEvaluation.positive_aspects && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Aspectos Positivos</h4>
                                    <p className="text-gray-700">{selectedEvaluation.positive_aspects}</p>
                                </div>
                            )}

                            {selectedEvaluation.improvement_suggestions && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Sugestões de Melhoria</h4>
                                    <p className="text-gray-700">{selectedEvaluation.improvement_suggestions}</p>
                                </div>
                            )}

                            {selectedEvaluation.comments && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Comentários</h4>
                                    <p className="text-gray-700">{selectedEvaluation.comments}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center space-x-2">
                                    {selectedEvaluation.felt_supported ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <span className="text-sm text-gray-700">Se sentiu apoiado</span>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {selectedEvaluation.clear_instructions ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <span className="text-sm text-gray-700">Instruções claras</span>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {selectedEvaluation.would_work_again ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <span className="text-sm text-gray-700">Trabalharia novamente</span>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {selectedEvaluation.recommend_captain ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <span className="text-sm text-gray-700">Recomenda capitão</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MinhasAvaliacoes;