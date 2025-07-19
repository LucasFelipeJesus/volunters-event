import { useAuth } from './useAuth'

interface CanEditTeamParams {
  teamCaptainId?: string
  eventAdminId?: string
}

export function useCanEditTeam(params?: CanEditTeamParams) {
  const { user } = useAuth()

  const canEdit = user?.role === 'admin' || 
                  (user?.role === 'captain' && params?.teamCaptainId === user?.id) ||
                  (user?.role === 'captain' && params?.eventAdminId === user?.id)

  return canEdit
}
