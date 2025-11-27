import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Team } from '../lib/supabase'
import { X } from 'lucide-react'
import { formatWhatsappLink } from '../utils/phoneUtils'
import { displayRole } from '../utils/roleUtils'
import { getRoleEmoji } from '../utils/roleUtils'

interface Props {
    teamId: string | null
    open: boolean
    onClose: () => void
}

export const ViewTeamModal: React.FC<Props> = ({ teamId, open, onClose }) => {
    const [team, setTeam] = useState<Team | null>(null)
    const [loading, setLoading] = useState(false)
    const activeMembers = (team?.members ?? [])
        .filter((m) => m.status === 'active')
        .sort((a, b) => {
            const roleRank = (r: string | null | undefined) => (r === 'captain' ? 0 : 1)
            const ra = roleRank(a.role_in_team)
            const rb = roleRank(b.role_in_team)
            if (ra !== rb) return ra - rb

            const na = (a.user?.full_name || '').toLowerCase()
            const nb = (b.user?.full_name || '').toLowerCase()
            return na.localeCompare(nb)
        })

    useEffect(() => {
        const fetch = async () => {
            if (!teamId || !open) return
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('teams')
                    .select(`
            *,
            event:events(*),
            members:team_members(*, user:users(id, full_name, phone, profile_image_url, avatar_url))
          `)
                    .eq('id', teamId)
                    .single()

                if (error) throw error
                setTeam(data)
            } catch (err) {
                console.error('Erro ao buscar detalhes da equipe:', err)
            } finally {
                setLoading(false)
            }
        }

        fetch()
    }, [teamId, open])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg w-full max-w-2xl p-6">
                <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold">Detalhes da Equipe</h3>
                    <button onClick={onClose} aria-label="Fechar" title="Fechar" className="text-gray-600 hover:text-gray-900 p-1">
                        <X />
                    </button>
                </div>

                {loading ? (
                    <div className="py-8 text-center">Carregando...</div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div>
                            <p className="text-sm text-gray-600">Equipe:</p>
                                <p className="font-medium text-gray-900">{team?.name}</p>
                            {team?.event && <p className="text-xs text-gray-500">Evento: {team.event.title}</p>}
                                {team?.arrival_time && (
                                    <p className="text-xs text-gray-500">Hora de chegada: {String(team.arrival_time).slice(0, 5)}</p>
                                )}
                        </div>

                            <div>
                                <h4 className="font-medium text-gray-800">Membros</h4>
                                <div className="mt-2 space-y-2">
                                    {activeMembers.length > 0 ? (
                                        activeMembers.map((m) => (
                                            <div key={m.id} className="flex items-center space-x-3 bg-gray-50 rounded p-2">
                                                    {(m.user?.profile_image_url || m.user?.avatar_url) ? (
                                                        <img src={m.user?.profile_image_url || m.user?.avatar_url} alt={m.user?.full_name} className="w-10 h-10 rounded-full object-cover" onError={(e: any) => { e.currentTarget.style.display = 'none'; }} />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-transparent" />
                                                    )}
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-medium text-gray-900">{m.user?.full_name}</p>
                                                            <span className="text-xs text-gray-500">{getRoleEmoji(m.role_in_team)} {displayRole(m.role_in_team)}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-3 mt-2">
                                                            <p className="text-sm text-gray-600">{m.user?.phone || 'Telefone não informado'}</p>
                                                            {m.user?.phone && (
                                                                <a
                                                                    href={formatWhatsappLink(m.user.phone, { message: `Olá ${m.user?.full_name}, você foi alocado(a) na equipe ${team?.name || ''}`, eventLocation: team?.event?.location })}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center text-sm text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded-md"
                                                                    title={`Abrir WhatsApp para ${m.user?.full_name}`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 mr-1" fill="currentColor"><path d="M20.52 3.48A11.88 11.88 0 0012 .02C5.53.02.53 5.01.53 11.49c0 2.03.54 4.02 1.57 5.78L.02 23.5l6.43-1.65A11.41 11.41 0 0012 23c6.47 0 11.47-4.99 11.47-11.48 0-3.07-1.21-5.94-3.95-8.04zM12 21.36c-1.14 0-2.25-.31-3.21-.9l-.23-.13-3.82.98.98-3.72-.14-.24A9.04 9.04 0 013 11.5C3 6.26 7.1 2.16 12.34 2.16c2.63 0 5.11 1.03 6.97 2.88 1.86 1.86 2.88 4.34 2.88 6.96 0 5.25-4.1 9.35-9.37 9.35z" /></svg>
                                                                    WhatsApp
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                ) : (
                                    <p className="text-sm text-gray-500">Nenhum membro encontrado.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ViewTeamModal
