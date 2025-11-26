// ...imports e interfaces...

// Removido bloco duplicado e incorreto de exportação do componente AdminUsersManagement
// ...imports e interfaces...

// ...código já existente...
// ...imports e interfaces...
import React, { useState, useEffect, useCallback } from 'react'
import { filterValidUUIDs } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { userService, authService } from '../../lib/services'
import {
    User,
    Star,
    Eye,
    EyeOff,
    Award,
    Search,
    Filter,
    MoreVertical,
    Shield,
    UserX,
    Crown,
    Calendar,
    Mail,
    Phone,
    MapPin
} from 'lucide-react'

interface UserProfile {
    id: string
    email: string
    full_name: string
    role: 'volunteer' | 'captain' | 'admin'
    phone?: string
    avatar_url?: string
    profile_image_url?: string
    bio?: string
    skills?: string[]
    is_active: boolean
    created_at: string
    updated_at: string
    cpf?: string
    birth_date?: string
    address?: string
    city?: string
    state?: string
    postal_code?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    vehicle_type?: 'car' | 'motorcycle' | 'bicycle' | 'none'
    vehicle_model?: string
    vehicle_plate?: string
    has_drivers_license?: boolean
    averageRating?: number
    totalEvaluations?: number
    eventsParticipated?: number
}

interface AdminEvaluation {
    id: string
    overall_rating: number
    leadership_rating: number
    team_management_rating: number
    communication_rating: number
    comments: string
    created_at: string
    event?: {
        title: string
    }
}

interface Evaluation {
    id: string
    rating: number
    comments: string
    created_at: string
    event?: {
        title: string
    }
}

export const AdminUsersManagement: React.FC = () => {
    const { user, promoteUser, demoteUser } = useAuth()
    const [users, setUsers] = useState<UserProfile[]>([])
    const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRole, setFilterRole] = useState<'all' | 'volunteer' | 'captain' | 'admin'>('all')
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
    const [showUserDetails, setShowUserDetails] = useState(false)
    const [userEvaluations, setUserEvaluations] = useState<(Evaluation | AdminEvaluation)[]>([])
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)

    // Estados para paginação
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [paginatedUsers, setPaginatedUsers] = useState<UserProfile[]>([])

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchUsers()
        }
    }, [user])

    const filterUsers = useCallback(() => {
        let filtered = users

        // Filtro por pesquisa
        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.city?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Filtro por role
        if (filterRole !== 'all') {
            filtered = filtered.filter(user => user.role === filterRole)
        }

        setFilteredUsers(filtered)
        setCurrentPage(1) // Reset para primeira página quando filtros mudam
    }, [users, searchTerm, filterRole])

    useEffect(() => {
        filterUsers()
    }, [filterUsers])

    // Efeito para calcular paginação
    useEffect(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        setPaginatedUsers(filteredUsers.slice(startIndex, endIndex))
    }, [filteredUsers, currentPage, itemsPerPage])

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
    }

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage)
        setCurrentPage(1) // Reset para primeira página
    }

    const fetchUsers = async () => {
        try {
            setLoading(true)

            // Buscar usuários com estatísticas
            const { data: usersData, error } = await supabase
                .from('users')
                .select(`
                    *,
                    evaluations:evaluations!evaluations_volunteer_id_fkey(rating),
                    admin_evaluations:admin_evaluations!admin_evaluations_captain_id_fkey(overall_rating),
                    team_members:team_members!team_members_user_id_fkey(
                        id,
                        team:teams(
                            event:events(id, title)
                        )
                    )
                `)
                // Remover filtro que excluía admins para permitir gerenciamento completo
                .order('created_at', { ascending: false })

            if (error) throw error

            // Processar dados para incluir estatísticas
            const processedUsers = usersData?.map(userData => {
                const evaluations = userData.evaluations || []
                const adminEvaluations = userData.admin_evaluations || []
                const teamMembers = userData.team_members || []

                const totalEvaluations = evaluations.length + adminEvaluations.length
                const averageRating = totalEvaluations > 0
                    ? (evaluations.reduce((sum: number, ev: { rating: number }) => sum + ev.rating, 0) +
                        adminEvaluations.reduce((sum: number, ev: { overall_rating: number }) => sum + ev.overall_rating, 0)) / totalEvaluations
                    : 0

                const eventsParticipated = new Set(teamMembers.map((tm: { team?: { event?: { id: string } } }) => tm.team?.event?.id)).size

                return {
                    ...userData,
                    averageRating: Math.round(averageRating * 10) / 10,
                    totalEvaluations,
                    eventsParticipated
                }
            }) || []

            // Fallback: se alguma role tem totalEvaluations === 0, tentar buscar diretamente
            // as avaliações (views detalhadas) para garantir que capitães/voluntários com avaliações não fiquem com zero.
            try {
                const enriched = [...processedUsers]

                // Preparar listas de ids para buscar apenas quando necessário
                const rawCaptainIds = enriched.filter(u => u.role === 'captain' && (u.totalEvaluations || 0) === 0).map(u => u.id)
                const rawVolunteerIds = enriched.filter(u => u.role === 'volunteer' && (u.totalEvaluations || 0) === 0).map(u => u.id)

                // Sanitizar IDs — garantir que apenas UUIDs válidos sejam passados para `.in(...)`
                const captainIds = filterValidUUIDs(rawCaptainIds)
                const volunteerIds = filterValidUUIDs(rawVolunteerIds)

                // 1) Buscar avaliações recebidas por capitães (geralmente guardadas em `captain_evaluation_details`)
                if (captainIds.length > 0) {
                    try {
                        console.debug('[AdminUsers] buscando captain_evaluation_details para captains:', captainIds)
                        const { data: captainRows, error: captainErr } = await supabase
                            .from('captain_evaluation_details')
                            .select('captain_id, overall_rating')
                            .in('captain_id', captainIds)

                        if (!captainErr && captainRows) {
                            // Agrupar por captain_id
                            const map = new Map()
                            captainRows.forEach((r: any) => {
                                const id = r.captain_id
                                const entry = map.get(id) || { count: 0, sum: 0 }
                                entry.count += 1
                                entry.sum += Number(r.overall_rating || 0)
                                map.set(id, entry)
                            })

                            // Aplicar ao enriched
                            for (const [id, stats] of map.entries()) {
                                const idx = enriched.findIndex(x => x.id === id)
                                if (idx !== -1) {
                                    const prevCount = enriched[idx].totalEvaluations || 0
                                    const prevAvg = enriched[idx].averageRating || 0
                                    const prevSum = prevAvg * prevCount
                                    const newCount = prevCount + stats.count
                                    const newSum = prevSum + stats.sum
                                    enriched[idx].totalEvaluations = newCount
                                    enriched[idx].averageRating = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0
                                }
                            }
                        } else if (captainErr) {
                            console.warn('[AdminUsers] captain_evaluation_details .in(...) retornou erro, tentando fallback por ID:', captainErr)
                            // Fallback: buscar individualmente para contornar PostgREST 400
                            const map = new Map()
                            for (const id of captainIds) {
                                try {
                                    const { data: row, error: rowErr } = await supabase
                                        .from('captain_evaluation_details')
                                        .select('captain_id, overall_rating')
                                        .eq('captain_id', id)
                                    if (!rowErr && row && row.length > 0) {
                                        row.forEach((r: any) => {
                                            const entry = map.get(r.captain_id) || { count: 0, sum: 0 }
                                            entry.count += 1
                                            entry.sum += Number(r.overall_rating || 0)
                                            map.set(r.captain_id, entry)
                                        })
                                    }
                                } catch (e) {
                                    console.warn('[AdminUsers] Erro no fallback individual captain_evaluation_details para id', id, e)
                                }
                            }

                            for (const [id, stats] of map.entries()) {
                                const idx = enriched.findIndex(x => x.id === id)
                                if (idx !== -1) {
                                    const prevCount = enriched[idx].totalEvaluations || 0
                                    const prevAvg = enriched[idx].averageRating || 0
                                    const prevSum = prevAvg * prevCount
                                    const newCount = prevCount + stats.count
                                    const newSum = prevSum + stats.sum
                                    enriched[idx].totalEvaluations = newCount
                                    enriched[idx].averageRating = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao buscar captain_evaluation_details para enriquecimento:', err)
                    }
                }

                // 2) Buscar avaliações de administradores (admin_evaluation_details) como complemento
                if (captainIds.length > 0) {
                    try {
                        console.debug('[AdminUsers] buscando admin_evaluation_details para captains (fallback):', captainIds)
                        const { data: adminRows, error: adminErr } = await supabase
                            .from('admin_evaluation_details')
                            .select('captain_id, overall_rating')
                            .in('captain_id', captainIds)

                        if (!adminErr && adminRows) {
                            const mapA = new Map()
                            adminRows.forEach((r: any) => {
                                const id = r.captain_id
                                const entry = mapA.get(id) || { count: 0, sum: 0 }
                                entry.count += 1
                                entry.sum += Number(r.overall_rating || 0)
                                mapA.set(id, entry)
                            })

                            for (const [id, stats] of mapA.entries()) {
                                const idx = enriched.findIndex(x => x.id === id)
                                if (idx !== -1) {
                                    const prevCount = enriched[idx].totalEvaluations || 0
                                    const prevAvg = enriched[idx].averageRating || 0
                                    const prevSum = prevAvg * prevCount
                                    const newCount = prevCount + stats.count
                                    const newSum = prevSum + stats.sum
                                    enriched[idx].totalEvaluations = newCount
                                    enriched[idx].averageRating = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao buscar admin_evaluation_details para enriquecimento:', err)
                    }
                }

                // 3) Voluntários: buscar evaluation_details
                if (volunteerIds.length > 0) {
                    try {
                        console.debug('[AdminUsers] buscando evaluation_details para volunteers:', volunteerIds)
                        const { data: volRows, error: volErr } = await supabase
                            .from('evaluation_details')
                            .select('volunteer_id, overall_rating')
                            .in('volunteer_id', volunteerIds)

                        if (!volErr && volRows) {
                            const mapV = new Map()
                            volRows.forEach((r: any) => {
                                const id = r.volunteer_id
                                const entry = mapV.get(id) || { count: 0, sum: 0 }
                                entry.count += 1
                                entry.sum += Number(r.overall_rating || 0)
                                mapV.set(id, entry)
                            })

                            for (const [id, stats] of mapV.entries()) {
                                const idx = enriched.findIndex(x => x.id === id)
                                if (idx !== -1) {
                                    const prevCount = enriched[idx].totalEvaluations || 0
                                    const prevAvg = enriched[idx].averageRating || 0
                                    const prevSum = prevAvg * prevCount
                                    const newCount = prevCount + stats.count
                                    const newSum = prevSum + stats.sum
                                    enriched[idx].totalEvaluations = newCount
                                    enriched[idx].averageRating = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0
                                }
                            }
                        } else if (volErr) {
                            console.warn('[AdminUsers] evaluation_details .in(...) retornou erro, tentando fallback por ID:', volErr)
                            // Fallback: buscar individualmente para contornar PostgREST 400
                            const mapV = new Map()
                            for (const id of volunteerIds) {
                                try {
                                    const { data: row, error: rowErr } = await supabase
                                        .from('evaluation_details')
                                        .select('volunteer_id, overall_rating')
                                        .eq('volunteer_id', id)
                                    if (!rowErr && row && row.length > 0) {
                                        row.forEach((r: any) => {
                                            const entry = mapV.get(r.volunteer_id) || { count: 0, sum: 0 }
                                            entry.count += 1
                                            entry.sum += Number(r.overall_rating || 0)
                                            mapV.set(r.volunteer_id, entry)
                                        })
                                    }
                                } catch (e) {
                                    console.warn('[AdminUsers] Erro no fallback individual evaluation_details para id', id, e)
                                }
                            }

                            for (const [id, stats] of mapV.entries()) {
                                const idx = enriched.findIndex(x => x.id === id)
                                if (idx !== -1) {
                                    const prevCount = enriched[idx].totalEvaluations || 0
                                    const prevAvg = enriched[idx].averageRating || 0
                                    const prevSum = prevAvg * prevCount
                                    const newCount = prevCount + stats.count
                                    const newSum = prevSum + stats.sum
                                    enriched[idx].totalEvaluations = newCount
                                    enriched[idx].averageRating = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao buscar evaluation_details para enriquecimento:', err)
                    }
                }

                setUsers(enriched)
            } catch (err) {
                console.error('Erro ao enriquecer estatísticas de usuários:', err)
                setUsers(processedUsers)
            }
        } catch (error) {
            console.error('Erro ao buscar usuários:', error)
        } finally {
            setLoading(false)
        }
    }

    const promoteToCapitain = async (userId: string) => {
        try {
            const success = await promoteUser(userId)
            if (success) {
                alert('Usuário promovido a capitão com sucesso!')
                fetchUsers()
            } else {
                alert('Erro ao promover usuário - verifique se ele é elegível para promoção')
            }
        } catch (error) {
            console.error('Erro ao promover usuário:', error)
            alert('Erro ao promover usuário: ' + (error as Error).message)
        }
    }

    const promoteToAdmin = async (userId: string, email?: string, fullName?: string) => {
        if (!confirm('Tem certeza que deseja conceder privilégios de administrador a este usuário?')) return
        try {
            const success = await authService.setupAdminProfile(userId, email || '', fullName || '')
            if (success) {
                alert('Usuário promovido a administrador com sucesso!')
                fetchUsers()
            } else {
                alert('Erro ao promover usuário a administrador')
            }
        } catch (error) {
            console.error('Erro ao promover usuário a admin:', error)
            alert('Erro ao promover usuário a administrador')
        }
    }

    const demoteFromAdmin = async (userId: string) => {
        if (!confirm('Tem certeza que deseja remover privilégios de administrador deste usuário?')) return
        try {

            const success = await userService.deleteAccount(userId)
            if (success) {
                alert('Usuário inativado com sucesso')
                fetchUsers()
            } else {
                alert('Erro ao inativar usuário - verifique logs')
            }
        } catch (error) {
            console.error('Erro ao excluir usuário:', error)
            alert('Erro ao inativar usuário')
        }
    }

    const demoteToVolunteer = async (userId: string) => {
        try {
            const success = await demoteUser(userId)
            if (success) {
                alert('Usuário revertido para voluntário com sucesso!')
                fetchUsers()
            } else {
                alert('Erro ao demover usuário - verifique se ele é capitão')
            }
        } catch (error) {
            console.error('Erro ao reverter usuário:', error)
            alert('Erro ao reverter usuário')
        }
    }

    const deactivateUser = async (userId: string) => {
        if (!confirm('Tem certeza que deseja desativar este usuário?')) return

        try {
            const success = await userService.deactivateUser(userId)
            if (success) {
                // Atualizar estado local imediatamente para resposta mais rápida na UI
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } as UserProfile : u))
                setSelectedUser(prev => prev && prev.id === userId ? ({ ...prev, is_active: false } as UserProfile) : prev)
                // Também atualizar listas filtradas/paginadas para refletir mudança sem esperar fetchUsers
                setFilteredUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } as UserProfile : u))
                setPaginatedUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } as UserProfile : u))

                alert('Usuário desativado com sucesso! Inscrições canceladas quando aplicável.')

                // Forçar refresh dos dados vindos do servidor para garantir consistência
                await fetchUsers()
            } else {
                alert('Erro ao desativar usuário - verifique os logs')
            }
        } catch (error) {
            console.error('Erro ao desativar usuário:', error)
            alert('Erro ao desativar usuário')
        }
    }

    const reactivateUser = async (userId: string) => {
        if (!confirm('Tem certeza que deseja reativar este usuário?')) return

        try {
            // Buscar email atual do usuário
            const { data: userData, error: selectError } = await supabase
                .from('users')
                .select('email')
                .eq('id', userId)
                .single()

            if (selectError) throw selectError

            const currentEmail: string = userData?.email || ''

            // Detecta padrão adicionado pela função delete_user_account: email || '_deleted_' || epoch
            const m = currentEmail.match(/^(.*)_deleted_\d+$/)

            if (m) {
                const originalEmail = m[1]

                // Tenta restaurar email e reativar em uma única operação
                const { error: updateErr } = await supabase
                    .from('users')
                    .update({ is_active: true, email: originalEmail })
                    .eq('id', userId)

                if (updateErr) {
                    // Possível conflito de email único — reativa sem alterar email e avisa o admin
                    if (updateErr.code === '23505' || (updateErr.message && updateErr.message.toLowerCase().includes('duplicate'))) {
                        const { error: onlyActiveErr } = await supabase
                            .from('users')
                            .update({ is_active: true })
                            .eq('id', userId)

                        if (onlyActiveErr) throw onlyActiveErr

                        alert('Usuário reativado, mas não foi possível restaurar o email original porque já existe outro perfil com esse email. Corrija manualmente, se necessário.')
                        fetchUsers()
                        return
                    }

                    throw updateErr
                }
            } else {
                // Email não foi modificado pelo soft-delete — apenas reativa
                const { error: activeErr } = await supabase
                    .from('users')
                    .update({ is_active: true })
                    .eq('id', userId)

                if (activeErr) throw activeErr
            }

            alert('Usuário reativado com sucesso!')
            fetchUsers()
        } catch (error) {
            console.error('Erro ao reativar usuário:', error)
            alert('Erro ao reativar usuário')
        }
    }

    const viewUserDetails = async (user: UserProfile) => {
        setSelectedUser(user)

        // Buscar avaliações detalhadas do usuário
        try {
            let evaluations: (Evaluation | AdminEvaluation)[] = []

            if (user.role === 'captain') {
                // 1) Tentar carregar da view detalhada usada em outras telas
                try {
                    const { data: adminEvals, error: adminErr } = await supabase
                        .from('admin_evaluation_details')
                        .select('*')
                        .eq('captain_id', user.id)
                        .order('evaluation_date', { ascending: false })

                    if (adminErr) throw adminErr
                    if (adminEvals && adminEvals.length > 0) {
                        evaluations = adminEvals
                    }
                } catch (err) {
                    console.warn('admin_evaluation_details não disponível ou erro, tentando captain_evaluation_details...', err)
                }

                // 2) Fallback para outra view que também pode existir
                if (evaluations.length === 0) {
                    try {
                        const { data: captainEvals, error: capErr } = await supabase
                            .from('captain_evaluation_details')
                            .select('*')
                            .eq('captain_id', user.id)
                            .order('evaluation_date', { ascending: false })

                        if (capErr) throw capErr
                        if (captainEvals && captainEvals.length > 0) {
                            evaluations = captainEvals
                        }
                    } catch (err) {
                        console.warn('captain_evaluation_details também falhou, tentando tabela bruta admin_evaluations...', err)
                    }
                }

                // 3) Último recurso: consultar a tabela `admin_evaluations` e juntar evento manualmente
                if (evaluations.length === 0) {
                    try {
                        const { data: adminEvalsRaw, error: rawErr } = await supabase
                            .from('admin_evaluations')
                            .select(`*, event:events(title, id), captain:users(id, full_name)`)
                            .eq('captain_id', user.id)
                            .order('created_at', { ascending: false })

                        if (rawErr) throw rawErr
                        if (adminEvalsRaw && adminEvalsRaw.length > 0) evaluations = adminEvalsRaw
                    } catch (err) {
                        console.error('Erro ao buscar em admin_evaluations (fallback):', err)
                    }
                }
            } else {
                // Voluntário: preferir a view detalhada `evaluation_details` (tem event, datas)
                try {
                    const { data: volEvals, error: volErr } = await supabase
                        .from('evaluation_details')
                        .select('*')
                        .eq('volunteer_id', user.id)
                        .order('evaluation_date', { ascending: false })

                    if (volErr) throw volErr
                    if (volEvals && volEvals.length > 0) {
                        evaluations = volEvals
                    }
                } catch (err) {
                    console.warn('evaluation_details não disponível, tentando tabela evaluations...', err)
                }

                if (evaluations.length === 0) {
                    try {
                        const { data: volEvalsRaw, error: rawErr } = await supabase
                            .from('evaluations')
                            .select(`*, event:events(title, id), volunteer:users(id, full_name)`)
                            .eq('volunteer_id', user.id)
                            .order('created_at', { ascending: false })

                        if (rawErr) throw rawErr
                        if (volEvalsRaw && volEvalsRaw.length > 0) evaluations = volEvalsRaw
                    } catch (err) {
                        console.error('Erro ao buscar em evaluations (fallback):', err)
                    }
                }
            }

            setUserEvaluations(evaluations)
        } catch (error) {
            console.error('Erro ao buscar avaliações:', error)
        }

        setShowUserDetails(true)
    }

    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <Star
                key={i}
                className={`w-4 h-4 ${i < Math.floor(rating)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                    }`}
            />
        ))
    }

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'captain':
                return 'bg-purple-100 text-purple-800'
            case 'volunteer':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getRoleName = (role: string) => {
        switch (role) {
            case 'captain':
                return 'Capitão'
            case 'volunteer':
                return 'Voluntário'
            default:
                return role
        }
    }

    if (user?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900">Acesso Negado</h2>
                    <p className="text-gray-600">Apenas administradores podem acessar esta página</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gerenciar Usuários</h1>
                    <p className="text-gray-600 mt-2">
                        Administre todos os voluntários e capitães do sistema
                    </p>
                </div>
            </div>

            {/* Filtros e Pesquisa */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Pesquisar por nome, email ou cidade..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value as 'all' | 'volunteer' | 'captain' | 'admin')}
                                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                title="Filtrar por tipo de usuário"
                            >
                                <option value="all">Todos os tipos</option>
                                <option value="volunteer">Voluntários</option>
                                <option value="captain">Capitães</option>
                                <option value="admin">Administradores</option>
                            </select>
                        </div>
                        <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                            <span className="font-medium">{filteredUsers.length}</span> usuário{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
                            {filteredUsers.length > itemsPerPage && (
                                <span className="text-gray-500 ml-2">
                                    • Página {currentPage} de {totalPages}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Usuários */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-gray-600 mt-4">Carregando usuários...</p>
                        </div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                        <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum usuário encontrado</h3>
                        <p className="text-gray-600">Tente ajustar os filtros de pesquisa</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[70vh]">
                        <div className="overflow-y-auto">
                            <div className="min-h-[600px]">{/* Altura mínima para garantir espaço para pelo menos 10 usuários */}
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Usuário
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Tipo
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Avaliação
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Eventos
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedUsers.map((userData) => (
                                            <tr key={userData.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                                            {userData.profile_image_url ? (
                                                                <img
                                                                    src={userData.profile_image_url}
                                                                    alt={userData.full_name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                                                                />
                                                            ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-transparent" />
                                                            )}
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                                                                {userData.full_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                                                {userData.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userData.role)}`}>
                                                        {userData.role === 'captain' && <Crown className="w-3 h-3 mr-1" />}
                                                        {getRoleName(userData.role)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center space-x-1">
                                                        <div className="flex items-center">
                                                            {renderStars(userData.averageRating || 0)}
                                                        </div>
                                                        <span className="text-xs text-gray-600">
                                                            {userData.averageRating || 0}/5
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            ({userData.totalEvaluations || 0})
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center space-x-1">
                                                        <Calendar className="w-3 h-3 text-gray-400" />
                                                        <span className="text-sm text-gray-900">
                                                            {userData.eventsParticipated || 0}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${userData.is_active
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {userData.is_active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setActionMenuOpen(actionMenuOpen === userData.id ? null : userData.id)}
                                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                                            title="Abrir menu de ações"
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>

                                                        {actionMenuOpen === userData.id && (
                                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                                <div className="py-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            viewUserDetails(userData)
                                                                            setActionMenuOpen(null)
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                        <span>Ver Detalhes</span>
                                                                    </button>


                                                                    {userData.role === 'volunteer' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                promoteToCapitain(userData.id)
                                                                                setActionMenuOpen(null)
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 flex items-center space-x-2"
                                                                        >
                                                                            <Award className="w-4 h-4" />
                                                                            <span>Promover a Capitão</span>
                                                                        </button>
                                                                    )}
                                                                    {userData.role === 'captain' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                demoteToVolunteer(userData.id)
                                                                                setActionMenuOpen(null)
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center space-x-2"
                                                                        >
                                                                            <User className="w-4 h-4" />
                                                                            <span>Reverter para Voluntário</span>
                                                                        </button>
                                                                    )}

                                                                    {/* Ações de admin: promover/demover administrador */}
                                                                    {userData.role !== 'admin' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                promoteToAdmin(userData.id, userData.email, userData.full_name)
                                                                                setActionMenuOpen(null)
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50 flex items-center space-x-2"
                                                                        >
                                                                            <Shield className="w-4 h-4" />
                                                                            <span>Promover a Administrador</span>
                                                                        </button>
                                                                    )}

                                                                    {userData.role === 'admin' && user?.id !== userData.id && (
                                                                        <button
                                                                            onClick={() => {
                                                                                demoteFromAdmin(userData.id)
                                                                                setActionMenuOpen(null)
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-sm text-orange-700 hover:bg-orange-50 flex items-center space-x-2"
                                                                        >
                                                                            <Crown className="w-4 h-4" />
                                                                            <span>Remover Privilégios de Admin</span>
                                                                        </button>
                                                                    )}

                                                                    {userData.is_active ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                deactivateUser(userData.id)
                                                                                setActionMenuOpen(null)
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center space-x-2"
                                                                        >
                                                                            <UserX className="w-4 h-4" />
                                                                            <span>Desativar</span>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                reactivateUser(userData.id)
                                                                                setActionMenuOpen(null)
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center space-x-2"
                                                                        >
                                                                            <User className="w-4 h-4" />
                                                                            <span>Reativar</span>
                                                                        </button>
                                                                    )}

                                                                    {/* botão redundante de inativação removido — usar 'Desativar' acima */}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Controles de Paginação */}
                        {filteredUsers.length > 0 && (
                            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-700">Itens por página:</span>
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                            title="Selecionar quantidade de itens por página"
                                        >
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-700">
                                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredUsers.length)} de {filteredUsers.length}
                                        </span>

                                        <div className="flex space-x-1">
                                            <button
                                                onClick={() => handlePageChange(1)}
                                                disabled={currentPage === 1}
                                                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                            >
                                                ««
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                            >
                                                ‹
                                            </button>

                                            {/* Números das páginas */}
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                const startPage = Math.max(1, currentPage - 2)
                                                const pageNumber = startPage + i
                                                if (pageNumber <= totalPages) {
                                                    return (
                                                        <button
                                                            key={pageNumber}
                                                            onClick={() => handlePageChange(pageNumber)}
                                                            className={`px-3 py-1 text-sm border border-gray-300 rounded ${currentPage === pageNumber
                                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                                    : 'hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            {pageNumber}
                                                        </button>
                                                    )
                                                }
                                                return null
                                            })}

                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                            >
                                                ›
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="px-2 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                            >
                                                »»
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Detalhes do Usuário */}
            {showUserDetails && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Detalhes do Usuário
                                </h2>
                                <button
                                    onClick={() => setShowUserDetails(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Fechar detalhes do usuário"
                                >
                                    <EyeOff className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Informações Básicas */}
                                <div className="lg:col-span-1">
                                    <div className="bg-gray-50 rounded-lg p-6">
                                        <div className="text-center">
                                            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mx-auto mb-4">
                                                {selectedUser.profile_image_url ? (
                                                    <img
                                                        src={selectedUser.profile_image_url}
                                                        alt={selectedUser.full_name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-transparent" />
                                                )}
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {selectedUser.full_name}
                                            </h3>
                                            <p className="text-sm text-gray-600 capitalize mb-4">
                                                {getRoleName(selectedUser.role)}
                                            </p>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-600 break-all">{selectedUser.email}</span>
                                                </div>
                                                {selectedUser.phone && (
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <Phone className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-600">{selectedUser.phone}</span>
                                                    </div>
                                                )}
                                                {selectedUser.city && (
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <MapPin className="w-4 h-4 text-gray-400" />
                                                        <span className="text-gray-600">
                                                            {selectedUser.city}{selectedUser.state && `, ${selectedUser.state}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Status do usuário */}
                                            <div className="mt-4">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${selectedUser.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {selectedUser.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>

                                            {/* Data de cadastro */}
                                            <div className="mt-2 text-xs text-gray-500">
                                                Membro desde {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Informações Pessoais Detalhadas */}
                                    <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Informações Pessoais</h4>
                                        <div className="space-y-2 text-sm">
                                            {selectedUser.cpf && (
                                                <div>
                                                    <span className="text-gray-500">CPF:</span>
                                                    <span className="ml-2 text-gray-900">{selectedUser.cpf}</span>
                                                </div>
                                            )}
                                            {selectedUser.birth_date && (
                                                <div>
                                                    <span className="text-gray-500">Nascimento:</span>
                                                    <span className="ml-2 text-gray-900">
                                                        {new Date(selectedUser.birth_date).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedUser.bio && (
                                                <div>
                                                    <span className="text-gray-500">Biografia:</span>
                                                    <p className="mt-1 text-gray-900 text-xs leading-relaxed">{selectedUser.bio}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Estatísticas e Avaliações */}
                                <div className="lg:col-span-2">
                                    <div className="space-y-6">
                                        {/* Estatísticas */}
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                                    <div className="text-2xl font-bold text-blue-600">
                                                        {selectedUser.eventsParticipated || 0}
                                                    </div>
                                                    <div className="text-sm text-blue-800">Eventos</div>
                                                </div>
                                                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                                                    <div className="text-2xl font-bold text-yellow-600">
                                                        {selectedUser.averageRating || 0}/5
                                                    </div>
                                                    <div className="text-sm text-yellow-800">Avaliação</div>
                                                </div>
                                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                                    <div className="text-2xl font-bold text-green-600">
                                                        {selectedUser.totalEvaluations || 0}
                                                    </div>
                                                    <div className="text-sm text-green-800">Avaliações</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Informações de Contato Completas */}
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Endereço e Contato</h4>
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    {selectedUser.address && (
                                                        <div>
                                                            <span className="text-gray-500 font-medium">Endereço:</span>
                                                            <p className="text-gray-900">{selectedUser.address}</p>
                                                        </div>
                                                    )}
                                                    {selectedUser.postal_code && (
                                                        <div>
                                                            <span className="text-gray-500 font-medium">CEP:</span>
                                                            <p className="text-gray-900">{selectedUser.postal_code}</p>
                                                        </div>
                                                    )}
                                                    {selectedUser.emergency_contact_name && (
                                                        <div>
                                                            <span className="text-gray-500 font-medium">Contato de Emergência:</span>
                                                            <p className="text-gray-900">{selectedUser.emergency_contact_name}</p>
                                                        </div>
                                                    )}
                                                    {selectedUser.emergency_contact_phone && (
                                                        <div>
                                                            <span className="text-gray-500 font-medium">Tel. Emergência:</span>
                                                            <p className="text-gray-900">{selectedUser.emergency_contact_phone}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Informações de Veículo */}
                                        {(selectedUser.vehicle_type && selectedUser.vehicle_type !== 'none') && (
                                            <div>
                                                <h4 className="text-lg font-semibold text-gray-900 mb-4">Informações do Veículo</h4>
                                                <div className="bg-blue-50 p-4 rounded-lg">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-blue-700 font-medium">Tipo:</span>
                                                            <p className="text-blue-900">
                                                                {selectedUser.vehicle_type === 'car' && 'Carro'}
                                                                {selectedUser.vehicle_type === 'motorcycle' && 'Motocicleta'}
                                                                {selectedUser.vehicle_type === 'bicycle' && 'Bicicleta'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-blue-700 font-medium">CNH:</span>
                                                            <p className="text-blue-900">
                                                                {selectedUser.has_drivers_license ? 'Sim' : 'Não'}
                                                            </p>
                                                        </div>
                                                        {selectedUser.vehicle_model && (
                                                            <div>
                                                                <span className="text-blue-700 font-medium">Modelo:</span>
                                                                <p className="text-blue-900">{selectedUser.vehicle_model}</p>
                                                            </div>
                                                        )}
                                                        {selectedUser.vehicle_plate && (
                                                            <div>
                                                                <span className="text-blue-700 font-medium">Placa:</span>
                                                                <p className="text-blue-900 font-mono">{selectedUser.vehicle_plate}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Avaliações */}
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Avaliações Recebidas</h4>
                                            {userEvaluations.length === 0 ? (
                                                <p className="text-gray-600 text-center py-8">
                                                    Nenhuma avaliação encontrada
                                                </p>
                                            ) : (
                                                <div className="space-y-4 max-h-64 overflow-y-auto">
                                                    {userEvaluations.map((evaluation) => (
                                                        <div key={evaluation.id} className="bg-gray-50 p-4 rounded-lg">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    {renderStars(
                                                                        'overall_rating' in evaluation
                                                                            ? evaluation.overall_rating
                                                                            : evaluation.rating
                                                                    )}
                                                                    <span className="text-sm font-medium text-gray-900">
                                                                        {'overall_rating' in evaluation
                                                                            ? evaluation.overall_rating
                                                                            : evaluation.rating}/5
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(evaluation.created_at).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </div>
                                                            {evaluation.event && (
                                                                <p className="text-sm text-blue-600 mb-2">
                                                                    Evento: {evaluation.event.title}
                                                                </p>
                                                            )}
                                                            <p className="text-sm text-gray-700">
                                                                {evaluation.comments}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminUsersManagement
