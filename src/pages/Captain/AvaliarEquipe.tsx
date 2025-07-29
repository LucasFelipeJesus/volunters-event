import React, { useEffect, useState } from 'react';
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

interface EvaluationForm {
    rating: number;
    comments: string;
    would_work_again: boolean;
}

const AvaliarEquipe: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
    const [evaluated, setEvaluated] = useState<{ [volunteerId: string]: boolean }>({});
    const [form, setForm] = useState<EvaluationForm>({ rating: 5, comments: '', would_work_again: true });
    const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Buscar eventos finalizados em que o usuário é capitão
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Buscar equipes onde o usuário é capitão e o evento está completed

                if (!user?.id) throw new Error('Usuário não autenticado');
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
                    .filter((team) => team.event && team.event.status === 'completed')
                    .map((team) => ({
                        event_id: team.event.id,
                        event_title: team.event.title,
                        event_date: team.event.event_date,
                        team_id: team.id,
                        team_name: team.name,
                        members: (team.members || [])
                            .filter((m) => m.role_in_team === 'volunteer' && m.status === 'active' && m.user)
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
        setForm({ rating: 5, comments: '', would_work_again: true });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent || !selectedVolunteer || !user?.id) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('evaluations').insert({
                volunteer_id: selectedVolunteer.id,
                captain_id: user.id,
                event_id: selectedEvent.event_id,
                team_id: selectedEvent.team_id,
                rating: form.rating,
                comments: form.comments,
                would_work_again: form.would_work_again,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
            setEvaluated((prev) => ({ ...prev, [selectedVolunteer.id]: true }));
            setSelectedVolunteer(null);
            alert('Avaliação registrada com sucesso!');
        } catch {
            alert('Erro ao registrar avaliação.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-4">Avaliação da Equipe</h2>
            {loading ? (
                <p>Carregando eventos e equipes...</p>
            ) : teamEvents.length === 0 ? (
                <p>Nenhum evento finalizado encontrado para avaliação.</p>
            ) : (
                <>
                    <div className="mb-6">
                        <label className="block mb-2 font-medium">Selecione um evento finalizado:</label>
                        <select
                            className="border rounded px-3 py-2"
                            value={selectedEvent?.event_id || ''}
                            onChange={e => {
                                const ev = teamEvents.find(ev => ev.event_id === e.target.value);
                                if (ev) handleSelectEvent(ev);
                            }}
                            title="Selecione um evento finalizado"
                            aria-label="Selecione um evento finalizado"
                        >
                            <option value="">-- Selecione --</option>
                            {teamEvents.map(ev => (
                                <option key={ev.event_id} value={ev.event_id}>
                                    {ev.event_title} ({new Date(ev.event_date).toLocaleDateString('pt-BR')})
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedEvent && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Equipe: {selectedEvent.team_name}</h3>
                            <ul className="mb-4">
                                {selectedEvent.members.map(vol => (
                                    <li key={vol.id} className="flex items-center justify-between border-b py-2">
                                        <span>{vol.full_name} ({vol.email})</span>
                                        {evaluated[vol.id] ? (
                                            <span className="text-green-600 font-medium">Avaliado</span>
                                        ) : (
                                            <button
                                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                onClick={() => handleSelectVolunteer(vol)}
                                            >Avaliar</button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {selectedVolunteer && (
                        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded border mb-4">
                            <h4 className="font-semibold mb-2">Avaliar: {selectedVolunteer.full_name}</h4>
                            <label className="block mb-1">Nota (1 a 5):</label>
                            <input
                                type="number"
                                min={1}
                                max={5}
                                value={form.rating}
                                onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))}
                                className="border rounded px-2 py-1 mb-2 w-20"
                                required
                                title="Nota de 1 a 5"
                                aria-label="Nota de 1 a 5"
                                placeholder="Nota"
                            />
                            <label className="block mb-1">Comentários:</label>
                            <textarea
                                value={form.comments}
                                onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                                className="border rounded px-2 py-1 mb-2 w-full"
                                rows={2}
                                title="Comentários"
                                aria-label="Comentários"
                                placeholder="Comentários (opcional)"
                            />
                            <label className="block mb-1">Trabalharia novamente com este voluntário?</label>
                            <select
                                value={form.would_work_again ? 'sim' : 'nao'}
                                onChange={e => setForm(f => ({ ...f, would_work_again: e.target.value === 'sim' }))}
                                className="border rounded px-2 py-1 mb-2"
                                title="Trabalharia novamente com este voluntário?"
                                aria-label="Trabalharia novamente com este voluntário?"
                            >
                                <option value="sim">Sim</option>
                                <option value="nao">Não</option>
                            </select>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                    disabled={submitting}
                                >Salvar Avaliação</button>
                                <button
                                    type="button"
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                                    onClick={() => setSelectedVolunteer(null)}
                                    disabled={submitting}
                                >Cancelar</button>
                            </div>
                        </form>
                    )}
                </>
            )}
        </div>
    );
};

export default AvaliarEquipe;
