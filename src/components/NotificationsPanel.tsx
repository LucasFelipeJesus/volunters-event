import React, { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useSystem'
import ViewTeamModal from './ViewTeamModal'

export const NotificationsPanel: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const handleOpenNotification = async (n: any) => {
    if (!n) return
    setSelectedTeamId(n.related_team_id || null)
    setOpen(true)
    if (!n.read) await markAsRead(n.id)
  }

  return (
    <div className="relative">
      <button className="relative p-2 text-gray-600 hover:text-gray-900" title="Notificações" onClick={() => setOpen(!open)}>
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium leading-none text-white bg-red-600 rounded-full">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-medium">Notificações</h4>
          </div>
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Sem notificações</div>
            ) : (
              notifications.map((n) => (
                <button key={n.id} onClick={() => handleOpenNotification(n)} className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 ${n.read ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    </div>
                    <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <ViewTeamModal teamId={selectedTeamId} open={open && !!selectedTeamId} onClose={() => { setOpen(false); setSelectedTeamId(null) }} />
    </div>
  )
}

export default NotificationsPanel
