import React, { useState, useRef } from 'react'
import useOutsideClick from '../hooks/useOutsideClick'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useSystem'
import ViewTeamModal from './ViewTeamModal'
import { formatWhatsappLink } from '../utils/phoneUtils'
import ViewUserModal from './ViewUserModal'

export const NotificationsPanel: React.FC = () => {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()
    const [panelOpen, setPanelOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [selectedNotification, setSelectedNotification] = useState<any | null>(null)
    const [markingAll, setMarkingAll] = useState(false)

    const panelRef = useRef<HTMLDivElement | null>(null)
    const buttonRef = useRef<HTMLButtonElement | null>(null)
    // fechar quando clicar fora ou pressionar Escape (hook reutilizável)
    useOutsideClick([panelRef, buttonRef], () => setPanelOpen(false), panelOpen)

    const handleOpenNotification = async (n: any) => {
        if (!n) return
        // Preferir abrir equipe se existir related_team_id, caso contrário abrir usuário
        setSelectedTeamId(n.related_team_id || null)
        setSelectedUserId(n.related_user_id || null)
        setSelectedNotification(n || null)
        setModalOpen(true)
        // manter o painel aberto para melhor contexto
        setPanelOpen(true)
        if (!n.read) await markAsRead(n.id)
    }

    return (
        <div className="relative">
            <button ref={buttonRef} className="relative p-2 text-gray-600 hover:text-gray-900" title="Notificações" onClick={() => setPanelOpen(!panelOpen)}>
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium leading-none text-white bg-red-600 rounded-full">{unreadCount}</span>
                )}
            </button>

            <div
                ref={panelRef}
                className={`absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-40 transform transition-all duration-150 origin-top-right ${panelOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}
                aria-hidden={panelOpen ? 'false' : 'true'}
            >
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                        <h4 className="text-sm font-medium">Notificações</h4>
                        <div>
                            <button
                                disabled={markingAll || unreadCount === 0}
                                onClick={async () => {
                                    if (markingAll || unreadCount === 0) return
                                    setMarkingAll(true)
                                    try {
                                        await markAllAsRead()
                                    } catch (err) {
                                        console.error('Erro ao marcar todas como lidas', err)
                                    } finally {
                                        setMarkingAll(false)
                                    }
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                title="Marcar todas como lidas"
                            >
                                {markingAll ? 'Marcando...' : 'Marcar todas como lidas'}
                            </button>
                        </div>
                    </div>
                    <div className="max-h-64 overflow-auto">
                        {loading ? (
                            <div className="p-4 text-sm text-gray-500">Carregando...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500">Sem notificações</div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleOpenNotification(n)}
                                    className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 ${n.read ? 'bg-white' : 'bg-gray-50'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {n.related_user ? (
                                                <img src={n.related_user.profile_image_url || n.related_user.avatar_url || '/placeholder-avatar.png'} alt={n.related_user.full_name} className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-100" />
                                            )}

                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                                <p className="text-xs text-gray-500 break-words whitespace-normal">{n.message}</p>

                                                {n.related_user && (
                                                    <div className="mt-1 flex items-center space-x-2">
                                                        <p className="text-xs text-gray-600">{n.related_user.full_name}</p>
                                                        <p className="text-xs text-gray-500">•</p>
                                                        <p className="text-xs text-gray-600">{n.related_user.phone || 'Telefone não informado'}</p>
                                                        {n.related_user.phone && (
                                                            <a
                                                                href={formatWhatsappLink(n.related_user.phone, { message: `Olá ${n.related_user.full_name}` })}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center text-xs text-green-600 hover:text-green-800 bg-green-50 px-2 py-0.5 rounded-md ml-2"
                                                            >
                                                                WhatsApp
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
            </div>

            <ViewTeamModal teamId={selectedTeamId} open={modalOpen && !!selectedTeamId} onClose={() => { setModalOpen(false); setSelectedTeamId(null); setSelectedNotification(null) }} />
            <ViewUserModal userId={selectedUserId} notification={selectedNotification} open={modalOpen && !!selectedUserId} onClose={() => { setModalOpen(false); setSelectedUserId(null); setSelectedNotification(null) }} />
        </div>
    )
}

export default NotificationsPanel
