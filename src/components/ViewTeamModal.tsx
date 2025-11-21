import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Team } from '../lib/supabase'
import { X } from 'lucide-react'

interface Props {
  teamId: string | null
  open: boolean
  onClose: () => void
}

export const ViewTeamModal: React.FC<Props> = ({ teamId, open, onClose }) => {
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(false)

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
              <p className="font-medium text-gray-900">{team?.name || team?.team_name}</p>
              {team?.event && <p className="text-xs text-gray-500">Evento: {team.event.title}</p>}
            </div>

            <div>
              <h4 className="font-medium text-gray-800">Membros</h4>
              <div className="mt-2 space-y-2">
                {team?.members && team.members.length > 0 ? (
                  team.members.map((m: any) => (
                    <div key={m.id} className="flex items-center space-x-3 bg-gray-50 rounded p-2">
                      <img src={m.user?.profile_image_url || m.user?.avatar_url || '/placeholder-avatar.png'} alt={m.user?.full_name} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{m.user?.full_name}</p>
                          <span className="text-xs text-gray-500">{m.role_in_team}</span>
                        </div>
                        <p className="text-sm text-gray-600">{m.user?.phone || 'Telefone não informado'}</p>
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
