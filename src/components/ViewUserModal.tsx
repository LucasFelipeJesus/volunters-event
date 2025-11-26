import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { formatWhatsappLink } from '../utils/phoneUtils'
import type { User, Notification } from '../lib/supabase'

interface Props {
    userId: string | null
    notification?: Notification | null
    open: boolean
    onClose: () => void
}

const ViewUserModal: React.FC<Props> = ({ userId, notification = null, open, onClose }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetch = async () => {
            if (!userId || !open) return
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, full_name, phone, profile_image_url, avatar_url, email, role')
                    .eq('id', userId)
                    .single()

                if (error) throw error
                setUser(data)
            } catch (err) {
                console.error('Erro ao buscar usuário:', err)
            } finally {
                setLoading(false)
            }
        }

        fetch()
    }, [userId, open])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
                <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold">Informações do Usuário</h3>
                    <button onClick={onClose} aria-label="Fechar" title="Fechar" className="text-gray-600 hover:text-gray-900 p-1">
                        <X />
                    </button>
                </div>

                {loading ? (
                    <div className="py-8 text-center">Carregando...</div>
                ) : (
                    <div className="mt-4 space-y-4">
                        {/* Notificação relacionada (se fornecida) */}
                        {notification && (
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-2">{new Date(notification.created_at).toLocaleString()}</p>
                            </div>
                        )}

                        <div className="flex items-center space-x-4">
                                {(user?.profile_image_url || user?.avatar_url) ? (
                                    <img src={user?.profile_image_url || user?.avatar_url} alt={user?.full_name} className="w-16 h-16 rounded-full object-cover" onError={(e: any) => { e.currentTarget.style.display = 'none'; }} />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-transparent" />
                                )}
                            <div>
                                <p className="font-medium text-gray-900">{user?.full_name || 'Usuário'}</p>
                                <p className="text-xs text-gray-500">{user?.role}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm text-gray-600">Telefone</p>
                            <p className="font-medium text-gray-900">{user?.phone || 'Telefone não informado'}</p>
                            {user?.phone && (
                                <a
                                    href={formatWhatsappLink(user.phone, { message: `Olá ${user.full_name}` })}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-sm text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded-md mt-2"
                                >
                                    Abrir WhatsApp
                                </a>
                            )}
                        </div>

                        <div>
                            <p className="text-sm text-gray-600">Email</p>
                            <p className="font-medium text-gray-900">{user?.email || '—'}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ViewUserModal
