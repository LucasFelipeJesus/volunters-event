import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import {
    userService,
    eventService,
    teamService,
    evaluationService,
    notificationService
} from '../lib/services'
import type {
    Event,
    UserEventHistory,
    TeamDetails,
    EvaluationDetails,
    AdminEvaluationDetails,
    Notification,
    UserStats,
    User,
    Evaluation

} from '../lib/supabase'

// Hook para gerenciar eventos
export const useEvents = () => {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const loadEvents = useCallback(async () => {
        setLoading(true)
        try {
            if (user?.role === 'admin') {
                const data = await eventService.getAllEvents()
                setEvents(data)
            } else {
                const data = await eventService.getPublishedEvents()
                setEvents(data)
            }
        } catch (error) {
            console.error('Erro ao carregar eventos:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        loadEvents()
    }, [loadEvents])

    const createEvent = async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'current_teams'>) => {
        const newEvent = await eventService.createEvent(eventData)
        if (newEvent) {
            await loadEvents() // Recarregar lista
        }
        return newEvent
    }

    const updateEvent = async (eventId: string, updates: Partial<Event>) => {
        const success = await eventService.updateEvent(eventId, updates)
        if (success) {
            await loadEvents() // Recarregar lista
        }
        return success
    }

    return {
        events,
        loading,
        loadEvents,
        createEvent,
        updateEvent
    }
}

// Hook para histórico do usuário
export const useUserHistory = () => {
    const [history, setHistory] = useState<UserEventHistory[]>([])
    const [stats, setStats] = useState<UserStats | null>(null)
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    useEffect(() => {
        const loadUserData = async () => {
            if (!user) return

            setLoading(true)
            try {
                const [historyData, statsData] = await Promise.all([
                    userService.getEventHistory(user.id),
                    userService.getStats(user.id)
                ])
                setHistory(historyData)
                setStats(statsData)
            } catch (error) {
                console.error('Erro ao carregar dados do usuário:', error)
            } finally {
                setLoading(false)
            }
        }

        loadUserData()
    }, [user])

    const leaveTeam = async (teamId: string) => {
        if (!user) return false
        const success = await userService.leaveTeam(user.id, teamId)
        if (success) {
            // Recarregar dados
            const historyData = await userService.getEventHistory(user.id)
            setHistory(historyData)
        }
        return success
    }

    return {
        history,
        stats,
        loading,
        leaveTeam
    }
}

// Hook para gerenciar equipes
export const useTeams = (eventId?: string) => {
    const [teams, setTeams] = useState<TeamDetails[]>([])
    const [loading, setLoading] = useState(true)

    const loadTeams = useCallback(async () => {
        if (!eventId) return

        setLoading(true)
        try {
            const data = await teamService.getEventTeams(eventId)
            setTeams(data)
        } catch (error) {
            console.error('Erro ao carregar equipes:', error)
        } finally {
            setLoading(false)
        }
    }, [eventId])

    useEffect(() => {
        loadTeams()
    }, [loadTeams])

    const addMember = async (teamId: string, userId: string, roleInTeam: 'captain' | 'volunteer') => {
        const success = await teamService.addMember(teamId, userId, roleInTeam)
        if (success) {
            await loadTeams()
        }
        return success
    }

    const removeMember = async (teamId: string, userId: string) => {
        const success = await teamService.removeMember(teamId, userId)
        if (success) {
            await loadTeams()
        }
        return success
    }

    return {
        teams,
        loading,
        loadTeams,
        addMember,
        removeMember
    }
}

// Hook para avaliações
export const useEvaluations = (userId?: string, role?: 'volunteer' | 'captain') => {
    const [evaluations, setEvaluations] = useState<EvaluationDetails[]>([])
    const [adminEvaluations, setAdminEvaluations] = useState<AdminEvaluationDetails[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadEvaluations = async () => {
            if (!userId) return

            setLoading(true)
            try {
                if (role === 'volunteer' || role === 'captain') {
                    const data = await evaluationService.getVolunteerEvaluations(userId)
                    setEvaluations(data)
                }

                if (role === 'captain') {
                    const adminData = await evaluationService.getCaptainEvaluations(userId)
                    setAdminEvaluations(adminData)
                }
            } catch (error) {
                console.error('Erro ao carregar avaliações:', error)
            } finally {
                setLoading(false)
            }
        }

        loadEvaluations()
    }, [userId, role])

    const createEvaluation = async (evaluationData: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'> & { score: number, userId: string }) => {
        const success = await evaluationService.createEvaluation({
            ...evaluationData, // Spread the properties to include score
            volunteer_id: evaluationData.userId,
            captain_id: '', // Adjust as needed
            team_id: '' // Adjust as needed
        })
        if (success && userId) {
            // Recarregar avaliações
            const data = await evaluationService.getVolunteerEvaluations(userId)
            setEvaluations(data)
        }
        return success
    }

    const createAdminEvaluation = async (evaluationData: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'> & { score: number, userId: string }) => {
        const success = await evaluationService.createAdminEvaluation({
            ...evaluationData,
            admin_id: userId ?? '', // Provide a default value if userId is undefined
            leadership_rating: 0, // Provide default or calculated values
            team_management_rating: 0,
            communication_rating: 0,
            overall_rating: 0, // Provide a default or calculated value
            promotion_ready: false // Provide a default value
        })
        if (success && userId) {
            // Recarregar avaliações do capitão
            const data = await evaluationService.getCaptainEvaluations(userId)
            setAdminEvaluations(data)
        }
        return success
    }

    return {
        evaluations,
        adminEvaluations,
        loading,
        createEvaluation,
        createAdminEvaluation
    }
}

// Hook para notificações
export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const loadNotifications = useCallback(async () => {
        if (!user) return

        setLoading(true)
        try {
            const data = await notificationService.getUserNotifications(user.id)
            setNotifications(data)
            setUnreadCount(data.filter(n => !n.read).length)
        } catch (error) {
            console.error('Erro ao carregar notificações:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        loadNotifications()

        // Atualizar notificações a cada 30 segundos
        const interval = setInterval(loadNotifications, 30000)
        return () => clearInterval(interval)
    }, [loadNotifications])

    const markAsRead = async (notificationId: string) => {
        const success = await notificationService.markAsRead(notificationId)
        if (success) {
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notificationId ? { ...n, read: true } : n
                )
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
        return success
    }

    const markAllAsRead = async () => {
        if (!user) return false
        const success = await notificationService.markAllAsRead(user.id)
        if (success) {
            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            )
            setUnreadCount(0)
        }
        return success
    }

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        loadNotifications
    }
}

// Hook para administração de usuários
export const useUserManagement = () => {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const { user, promoteUser } = useAuth()

    const loadUsers = useCallback(async () => {
        if (user?.role !== 'admin') return

        setLoading(true)
        try {
            const data = await userService.getAllUsers()
            setUsers(data)
        } catch (error) {
            console.error('Erro ao carregar usuários:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        loadUsers()
    }, [loadUsers])

    const promoteUserToCaptain = async (userId: string) => {
        const success = await promoteUser(userId)
        if (success) {
            await loadUsers() // Recarregar lista
        }
        return success
    }

    const updateUserRole = async (userId: string, role: 'volunteer' | 'captain' | 'admin') => {
        const success = await userService.updateProfile(userId, { role })
        if (success) {
            await loadUsers() // Recarregar lista
        }
        return success
    }

    return {
        users,
        loading,
        loadUsers,
        promoteUserToCaptain,
        updateUserRole
    }
}

// Hook para estatísticas do sistema (admin)
export const useSystemStats = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalEvents: 0,
        totalTeams: 0,
        activeEvents: 0,
        volunteersCount: 0,
        captainsCount: 0
    })
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    useEffect(() => {
        const loadStats = async () => {
            if (user?.role !== 'admin') return

            setLoading(true)
            try {
                const [allUsers, allEvents] = await Promise.all([
                    userService.getAllUsers(),
                    eventService.getAllEvents()
                ])

                const volunteersCount = allUsers.filter(u => u.role === 'volunteer').length
                const captainsCount = allUsers.filter(u => u.role === 'captain').length
                const activeEvents = allEvents.filter(e => e.status === 'published' || e.status === 'in_progress').length
                const totalTeams = allEvents.reduce((sum, event) => sum + (event.teams?.length || 0), 0)

                setStats({
                    totalUsers: allUsers.length,
                    totalEvents: allEvents.length,
                    totalTeams,
                    activeEvents,
                    volunteersCount,
                    captainsCount
                })
            } catch (error) {
                console.error('Erro ao carregar estatísticas:', error)
            } finally {
                setLoading(false)
            }
        }

        loadStats()
    }, [user])

    return {
        stats,
        loading
    }
}
