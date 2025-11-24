import React, { useState, useEffect, useCallback } from 'react'
import { filterValidUUIDs } from '../../lib/utils'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    Edit,
    Save,
    X,
    ArrowLeft,
    Tag,
    FileText,
    Settings,
    Trash2,
    UserPlus,
    UserMinus,
    AlertCircle,
    CheckCircle
} from 'lucide-react'

interface ExtendedTeamMember {
    id: string
    user_id: string
    team_id: string
    role_in_team: 'captain' | 'volunteer'
    status: 'active' | 'inactive' | 'removed'
    joined_at: string
    left_at?: string
    user?: {
        id: string
        full_name: string
        email: string
        role: string
    }
}

interface ExtendedTeam {
    id: string
    name: string
    event_id: string
    captain_id: string
    max_volunteers: number
    status: string
    created_at: string
    updated_at: string
    members?: ExtendedTeamMember[]
}

interface EventRegistration {
    id: string
    event_id: string
    user_id: string
    status: 'pending' | 'confirmed' | 'cancelled' | 'transferred'
    registration_notes?: string
    registered_at: string
    updated_at: string
    user?: {
        id: string
        full_name: string
        email: string
        role: string
    }
}

interface ExtendedEvent {
    id: string
    title: string
    description: string
    location: string
    event_date: string
    start_time: string
    end_time: string
    max_volunteers?: number
    registration_start_date?: string
    registration_end_date?: string
    category?: string
    requirements?: string
    status: string
    image_url?: string
    admin_id: string
    created_at: string
    updated_at: string
    teams?: ExtendedTeam[]
    event_registrations?: EventRegistration[]
    admin?: {
        id: string
        full_name: string
        email: string
        role: string
    }
}

export const EventDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>()
    const { user, demoteCaptainsAfterEvent } = useAuth()
    const navigate = useNavigate()

    const [event, setEvent] = useState<ExtendedEvent | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Estados para edição
    const [editData, setEditData] = useState({
        title: '',
        description: '',
        location: '',
        event_date: '',
        start_time: '',
        end_time: '',
        max_volunteers: 0,
        registration_start_date: '',
        registration_end_date: '',
        category: '',
        requirements: '',
        status: 'published'
    })

    // Estados para upload de imagem
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [uploadingImage, setUploadingImage] = useState(false)

    const fetchEventDetails = useCallback(async () => {
        try {
            setLoading(true)

            // Buscar dados do evento com equipes, membros e inscrições diretas
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select(`
          *,
          admin:users!events_admin_id_fkey(*),
          teams(
            *,
            members:team_members(
              *,
              user:users(*)
            )
          ),
          event_registrations(
            *,
            user:users(*)
          )
        `)
                .eq('id', id)
                .single()

            if (eventError) throw eventError

            setEvent(eventData)

            // Se a data do evento já passou mas o status não foi atualizado, impedir inscrições na UI
            try {
                const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
                if (eventData.event_date && eventData.event_date < today && eventData.status !== 'completed') {
                    // Se for admin, tentar finalizar no servidor via RPC (idempotente). Caso contrário, apenas ajustar localmente para bloquear inscrições.
                    if (user?.role === 'admin') {
                        try {
                            console.debug('[EventDetails] Evento expirado detectado; executando finalize_expired_events RPC para event', id)
                            await supabase.rpc('finalize_expired_events', { p_event_id: id })
                            // Recarregar dados após finalização no servidor
                            const { data: refreshed, error: refreshedErr } = await supabase
                                .from('events')
                                .select(`*, teams(*), event_registrations(*), admin:users(*)`)
                                .eq('id', id)
                                .single()
                            if (!refreshedErr && refreshed) {
                                setEvent(refreshed)
                                // atualizar editData se estiver no modo de edição
                                setEditData((prev) => ({ ...prev, status: refreshed.status }))
                            }
                        } catch (rpcErr) {
                            console.warn('[EventDetails] finalize_expired_events RPC falhou:', rpcErr)
                        }
                    } else {
                        // Ajuste local temporário para bloquear ações do usuário
                        setEvent((prev) => prev ? ({ ...prev, status: 'completed' } as ExtendedEvent) : prev)
                        setEditData((prev) => ({ ...prev, status: 'completed' }))
                    }
                }
            } catch (e) {
                console.warn('[EventDetails] Erro ao processar verificação de data do evento:', e)
            }

            // Inicializar dados de edição
            setEditData({
                title: eventData.title,
                description: eventData.description,
                location: eventData.location,
                event_date: eventData.event_date,
                start_time: eventData.start_time,
                end_time: eventData.end_time,
                max_volunteers: eventData.max_volunteers || 0,
                registration_start_date: eventData.registration_start_date || '',
                registration_end_date: eventData.registration_end_date || '',
                category: eventData.category || '',
                requirements: eventData.requirements || '',
                status: eventData.status
            })

        } catch (error: unknown) {
            console.error('Erro ao buscar detalhes do evento:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar evento'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        if (id) {
            fetchEventDetails()
        }
    }, [id, fetchEventDetails])

    const uploadImage = async (file: File): Promise<string> => {
        try {
            // Validar tipo de arquivo
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
            if (!allowedTypes.includes(file.type)) {
                throw new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.')
            }

            // Validar tamanho do arquivo (máximo 5MB)
            const maxSize = 5 * 1024 * 1024 // 5MB
            if (file.size > maxSize) {
                throw new Error('A imagem deve ter no máximo 5MB')
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `event_${id}_${Date.now()}.${fileExt}`

            console.log('Tentando fazer upload da imagem do evento:', fileName)

            // Tentar upload diretamente; listagem de buckets no cliente pode falhar
            // quando usamos a chave anônima. Se houver erro, será capturado abaixo.
            const { data, error } = await supabase.storage
                .from('event-images')
                .upload(fileName, file, {
                    upsert: true,
                    contentType: file.type
                })

            if (error) {
                console.error('Erro detalhado do Supabase:', error)
                throw new Error(`Erro ao fazer upload da imagem: ${error.message}`)
            }

            const { data: { publicUrl } } = supabase.storage
                .from('event-images')
                .getPublicUrl(data.path)

            console.log('Upload da imagem do evento realizado com sucesso:', publicUrl)
            return publicUrl
        } catch (error) {
            console.error('Erro detalhado no upload:', error)
            throw error
        }
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecione apenas arquivos de imagem')
            return
        }

        // Validar tamanho do arquivo (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('A imagem deve ter no máximo 5MB')
            return
        }

        setImageFile(file)

        // Criar preview da imagem
        const reader = new FileReader()
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
        setError(null)
    }

    const handleSaveChanges = async () => {
        try {
            setError(null)

            // Validações básicas
            if (!editData.title || !editData.description || !editData.location) {
                throw new Error('Título, descrição e local são obrigatórios')
            }

            let imageUrl = event?.image_url

            // Upload da nova imagem se foi selecionada
            if (imageFile) {
                setUploadingImage(true)
                imageUrl = await uploadImage(imageFile)
            }

            // Atualizar evento
            const { error: updateError } = await supabase
                .from('events')
                .update({
                    title: editData.title,
                    description: editData.description,
                    location: editData.location,
                    event_date: editData.event_date,
                    start_time: editData.start_time,
                    end_time: editData.end_time,
                    max_volunteers: editData.max_volunteers,
                    registration_start_date: editData.registration_start_date || null,
                    registration_end_date: editData.registration_end_date || null,
                    category: editData.category,
                    requirements: editData.requirements || null,
                    status: editData.status,
                    image_url: imageUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)

            if (updateError) throw updateError

            // Se status foi alterado para 'completed', inativar todos os membros das equipes do evento
            if (editData.status === 'completed' && event?.teams?.length) {
                const teamIds = filterValidUUIDs(event.teams.map((t: any) => t.id))
                // Atualiza todos os membros ativos dessas equipes para 'inactive' e registra saída
                if (teamIds.length > 0) {
                    const { error: membersError } = await supabase
                        .from('team_members')
                        .update({ status: 'inactive', left_at: new Date().toISOString() })
                        .in('team_id', teamIds)
                        .eq('status', 'active')
                    if (membersError) {
                        console.error('Erro ao desalocar membros das equipes:', membersError)
                    }
                }

                // Demover capitães de volta a voluntários
                try {
                    const demotedCount = await demoteCaptainsAfterEvent(id!)
                    if (demotedCount > 0) {
                        console.log(`✅ ${demotedCount} capitães foram demovidos automaticamente após finalização do evento`)
                    }
                } catch (error) {
                    console.error('❌ Erro ao demover capitães após finalização do evento:', error)
                }

                // Marcar equipes deste evento como finalizadas (status 'finished')
                try {
                    if (teamIds.length > 0) {
                        const { error: teamsError } = await supabase
                            .from('teams')
                            .update({ status: 'finished', updated_at: new Date().toISOString() })
                            .in('id', teamIds)

                        if (teamsError) {
                            console.error('Erro ao marcar equipes como finalizadas:', teamsError)
                        }
                    }
                } catch (err) {
                    console.error('Erro inesperado ao finalizar equipes:', err)
                }
            }

            setSuccess('Evento atualizado com sucesso!')
            setIsEditing(false)
            setImageFile(null)
            setImagePreview(null)
            await fetchEventDetails() // Recarregar dados

        } catch (error: unknown) {
            console.error('Erro ao atualizar evento:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar evento'
            setError(errorMessage)
        } finally {
            setUploadingImage(false)
        }
    }

    const handleDeleteEvent = async () => {
        if (!window.confirm('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', id)

            if (error) throw error

            navigate('/events')
        } catch (error: unknown) {
            console.error('Erro ao excluir evento:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir evento'
            setError(errorMessage)
        }
    }

    const handleRemoveVolunteer = async (_teamId: string, memberId: string) => {
        if (!window.confirm('Tem certeza que deseja remover este voluntário?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('team_members')
                .update({ status: 'removed', left_at: new Date().toISOString() })
                .eq('id', memberId)

            if (error) throw error

            setSuccess('Voluntário removido com sucesso!')
            await fetchEventDetails()
        } catch (error: unknown) {
            console.error('Erro ao remover voluntário:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao remover voluntário'
            setError(errorMessage)
        }
    }

    // Função para voluntários se inscreverem em uma equipe
    const handleVolunteerRegister = async (teamId: string) => {
        if (!user || user.role !== 'volunteer') {
            setError('Apenas voluntários podem se inscrever em equipes.')
            return
        }

        try {
            // Verificar se o usuário já está inscrito nesta equipe
            const { data: existingMember } = await supabase
                .from('team_members')
                .select('id, status')
                .eq('team_id', teamId)
                .eq('user_id', user.id)
                .single()

            if (existingMember) {
                if (existingMember.status === 'active') {
                    setError('Você já está inscrito nesta equipe.')
                    return
                } else {
                    // Reativar inscrição se estava inativa
                    const { error } = await supabase
                        .from('team_members')
                        .update({
                            status: 'active',
                            left_at: null,
                            joined_at: new Date().toISOString()
                        })
                        .eq('id', existingMember.id)

                    if (error) throw error
                    setSuccess('Você foi reinscrito na equipe com sucesso!')
                }
            } else {
                // Criar nova inscrição
                const { error } = await supabase
                    .from('team_members')
                    .insert({
                        team_id: teamId,
                        user_id: user.id,
                        role_in_team: 'volunteer',
                        status: 'active',
                        joined_at: new Date().toISOString()
                    })

                if (error) throw error
                setSuccess('Você se inscreveu na equipe com sucesso!')
            }

            await fetchEventDetails()
        } catch (error: unknown) {
            console.error('Erro ao se inscrever na equipe:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao se inscrever na equipe'
            setError(errorMessage)
        }
    }

    // Função para voluntários saírem de uma equipe
    const handleVolunteerLeave = async (teamId: string) => {
        if (!user || user.role !== 'volunteer') {
            setError('Operação não permitida.')
            return
        }

        if (!window.confirm('Tem certeza que deseja sair desta equipe?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('team_members')
                .update({
                    status: 'inactive',
                    left_at: new Date().toISOString()
                })
                .eq('team_id', teamId)
                .eq('user_id', user.id)

            if (error) throw error

            setSuccess('Você saiu da equipe com sucesso!')
            await fetchEventDetails()
        } catch (error: unknown) {
            console.error('Erro ao sair da equipe:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao sair da equipe'
            setError(errorMessage)
        }
    }

    const formatDate = (dateString: string) => {
        // Se vier no formato 'YYYY-MM-DD', formatar manualmente para evitar problemas de timezone
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [ano, mes, dia] = dateString.split('-')
            return `${dia}/${mes}/${ano}`
        }
        // Se vier outro formato, tenta converter normalmente
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const formatTime = (timeString: string) => {
        return timeString.slice(0, 5)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return 'bg-green-100 text-green-800'
            case 'draft': return 'bg-yellow-100 text-yellow-800'
            case 'in_progress': return 'bg-blue-100 text-blue-800'
            case 'completed': return 'bg-gray-100 text-gray-800'
            case 'cancelled': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'published': return 'Publicado'
            case 'draft': return 'Rascunho'
            case 'in_progress': return 'Em Andamento'
            case 'completed': return 'Concluído'
            case 'cancelled': return 'Cancelado'
            default: return status
        }
    }

    const canEdit = user?.role === 'admin' || (user?.role === 'captain' && event?.admin_id === user?.id)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!event) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Evento não encontrado</h3>
                <Link to="/events" className="text-blue-600 hover:text-blue-700">
                    Voltar para eventos
                </Link>
            </div>
        )
    }

    // ...existing code...
    const teamVolunteerIds = new Set(
        event.teams?.flatMap(team =>
            team.members?.filter(member => member.status === 'active').map(member => member.user_id)
        ) || []
    )
    const directVolunteerIds = new Set(
        event.event_registrations
            ?.filter(reg => reg.status === 'confirmed' || reg.status === 'pending')
            .map(reg => reg.user_id)
        || []
    )
    const allVolunteerIds = new Set([...teamVolunteerIds, ...directVolunteerIds])
    const totalVolunteers = allVolunteerIds.size
    // ...existing code...

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/events')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Voltar para eventos"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
                        <div className="flex items-center space-x-4 mt-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                                {getStatusText(event.status)}
                            </span>
                            {event.status === 'completed' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700 ml-2">
                                    <CheckCircle className="w-3 h-3 mr-1.5 text-gray-600" />
                                    Finalizado
                                </span>
                            )}
                            {event.category && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Tag className="w-3 h-3 mr-1" />
                                    {event.category}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {canEdit && event.status !== 'completed' && (
                    <div className="flex items-center space-x-2">
                        {/* Botões de edição e exclusão só aparecem se evento não estiver finalizado */}
                        {event.status !== 'completed' && (!isEditing ? (
                            <>
                                <Link
                                    to={`/events/${id}/terms`}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Gerenciar Termos</span>
                                </Link>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Edit className="w-4 h-4" />
                                    <span>Editar</span>
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleSaveChanges}
                                    disabled={uploadingImage}
                                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {uploadingImage ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    <span>Salvar</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false)
                                        setImageFile(null)
                                        setImagePreview(null)
                                        setError(null)
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    <span>Cancelar</span>
                                </button>
                            </div>
                        ))}

                        {user?.role === 'admin' && event.status !== 'completed' && (
                            <button
                                onClick={handleDeleteEvent}
                                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Excluir</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Alerts */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800">{success}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Informações Principais */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Detalhes do Evento */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">Detalhes do Evento</h2>

                        {isEditing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                                    <input
                                        type="text"
                                        title="Título do evento"
                                        value={editData.title}
                                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                                    <textarea
                                        title="Descrição do evento"
                                        value={editData.description}
                                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Local</label>
                                        <input
                                            type="text"
                                            title="Local do evento"
                                            value={editData.location}
                                            onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                                        <select
                                            title="Categoria do evento"
                                            value={editData.category}
                                            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Selecione uma categoria</option>
                                            <option value="education">Educação</option>
                                            <option value="health">Saúde</option>
                                            <option value="environment">Meio Ambiente</option>
                                            <option value="social">Social</option>
                                            <option value="culture">Cultura</option>
                                            <option value="sports">Esportes</option>
                                            <option value="technology">Tecnologia</option>
                                            <option value="community">Comunidade</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                                        <input
                                            type="date"
                                            title="Data do evento"
                                            value={editData.event_date}
                                            onChange={(e) => setEditData({ ...editData, event_date: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Início</label>
                                        <input
                                            type="time"
                                            title="Horário de início"
                                            value={editData.start_time}
                                            onChange={(e) => setEditData({ ...editData, start_time: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Fim</label>
                                        <input
                                            type="time"
                                            title="Horário de fim"
                                            value={editData.end_time}
                                            onChange={(e) => setEditData({ ...editData, end_time: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Máximo de Voluntários</label>
                                        <input
                                            type="number"
                                            min="1"
                                            title="Número máximo de voluntários"
                                            value={editData.max_volunteers}
                                            onChange={(e) => setEditData({ ...editData, max_volunteers: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                        <select
                                            title="Status do evento"
                                            value={editData.status}
                                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="draft">Rascunho</option>
                                            <option value="published">Publicado</option>
                                            <option value="in_progress">Em Andamento</option>
                                            <option value="completed">Concluído</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Início das Inscrições</label>
                                        <input
                                            type="date"
                                            title="Data de início das inscrições"
                                            value={editData.registration_start_date}
                                            onChange={(e) => setEditData({ ...editData, registration_start_date: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Fim das Inscrições</label>
                                        <input
                                            type="date"
                                            title="Data de fim das inscrições"
                                            value={editData.registration_end_date}
                                            onChange={(e) => setEditData({ ...editData, registration_end_date: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Requisitos</label>
                                    <textarea
                                        title="Requisitos para participação"
                                        value={editData.requirements}
                                        onChange={(e) => setEditData({ ...editData, requirements: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Requisitos para participação..."
                                    />
                                </div>

                                {/* Upload de Imagem */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Imagem do Evento</label>
                                    <div className="space-y-4">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            title="Selecionar imagem do evento"
                                            onChange={handleImageChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />

                                        {(imagePreview || event.image_url) && (
                                            <div className="relative">
                                                <img
                                                    src={imagePreview || event.image_url || ''}
                                                    alt="Preview"
                                                    className="w-full h-48 object-cover rounded-lg"
                                                />
                                                {imagePreview && (
                                                    <div className="absolute top-2 right-2">
                                                        <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">
                                                            Nova imagem
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {event.image_url && (
                                    <img
                                        src={event.image_url}
                                        alt={event.title}
                                        className="w-full h-64 object-cover rounded-lg"
                                    />
                                )}

                                <div>
                                    <p className="text-gray-600 leading-relaxed">{event.description}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <Calendar className="w-5 h-5 text-gray-400" />
                                            <span className="text-gray-600">{formatDate(event.event_date)}</span>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            <Clock className="w-5 h-5 text-gray-400" />
                                            <span className="text-gray-600">{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            <MapPin className="w-5 h-5 text-gray-400" />
                                            <span className="text-gray-600">{event.location}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <Users className="w-5 h-5 text-gray-400" />
                                            <span className="text-gray-600">
                                                {totalVolunteers}/{event.max_volunteers || 0} voluntários
                                            </span>
                                        </div>

                                        {event.registration_start_date && (
                                            <div className="flex items-center space-x-3">
                                                <Settings className="w-5 h-5 text-gray-400" />
                                                <span className="text-gray-600">
                                                    Inscrições: {formatDate(event.registration_start_date)} - {event.registration_end_date ? formatDate(event.registration_end_date) : 'Sem data limite'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {event.requirements && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                                            <FileText className="w-4 h-4 mr-2" />
                                            Requisitos
                                        </h3>
                                        <p className="text-gray-600">{event.requirements}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Equipes e Voluntários */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">Voluntários e Equipes</h2>
                        </div>
                        {/* Inscrições Diretas */}
                        {event.event_registrations && event.event_registrations.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                        <UserPlus className="w-5 h-5 mr-2" />
                                        Voluntários Inscritos ({event.event_registrations.filter(reg => reg.status === 'confirmed' || reg.status === 'pending').length})
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {event.event_registrations.filter(reg => reg.status === 'confirmed' || reg.status === 'pending').map((registration) => (
                                        <div key={registration.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-900">{registration.user?.full_name}</h4>
                                                    <p className="text-sm text-gray-600">{registration.user?.email}</p>
                                                    <div className="flex items-center mt-2">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${registration.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                            {registration.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {canEdit && (
                                                    <div className="flex space-x-1">
                                                        <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" aria-label="Gerenciar voluntário">
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {registration.registration_notes && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <p className="text-sm text-gray-600"><strong>Observações:</strong> {registration.registration_notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {canEdit && (
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm text-blue-800 mb-2"><strong>Próximos passos:</strong> Como administrador, você pode organizar esses voluntários em equipes.</p>
                                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Criar equipes automaticamente →</button>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Equipes - Histórico se evento finalizado */}
                        {event.teams && event.teams.length > 0 ? (
                            <div className="space-y-6">
                                {event.teams.map((team) => (
                                    <div key={team.id} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="font-medium text-gray-900">{team.name}</h3>
                                                <p className="text-sm text-gray-600">{team.members?.filter(m => m.status === 'active').length || 0}/{team.max_volunteers} voluntários</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${team.status === 'active' ? 'bg-green-100 text-green-800' : team.status === 'forming' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {team.status === 'active' ? 'Ativa' : team.status === 'forming' ? 'Formando' : team.status}
                                                </span>
                                                {/* Bloquear edição se evento finalizado */}
                                                {canEdit && event.status !== 'completed' && (
                                                    <Link to={`/teams/${team.id}/edit`} className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Editar equipe">
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                        {team.members && team.members.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-medium text-gray-700">Membros:</h4>
                                                <div className="space-y-2">
                                                    {team.members.filter(member => member.status === 'active').map((member) => (
                                                        <div key={member.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                                            <div className="flex items-center space-x-3">
                                                                <div>
                                                                    <p className="font-medium text-gray-900">{member.user?.full_name}</p>
                                                                    <p className="text-sm text-gray-600">{member.user?.email}</p>
                                                                </div>
                                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${member.role_in_team === 'captain' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{member.role_in_team === 'captain' ? 'Capitão' : 'Voluntário'}</span>
                                                            </div>
                                                            {/* Bloquear remoção se evento finalizado */}
                                                            {canEdit && member.role_in_team !== 'captain' && event.status !== 'completed' && (
                                                                <button onClick={() => handleRemoveVolunteer(team.id, member.id)} className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded" title="Remover voluntário">
                                                                    <UserMinus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Botões de ação para voluntários */}
                                        {user?.role === 'volunteer' && !canEdit && event.status !== 'completed' && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                {(() => {
                                                    const userInTeam = team.members?.find(member => member.user?.id === user.id && member.status === 'active');
                                                    const teamIsFull = (team.members?.filter(m => m.status === 'active').length || 0) >= team.max_volunteers;
                                                    if (userInTeam) {
                                                        return (
                                                            <button onClick={() => handleVolunteerLeave(team.id)} className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                                                <UserMinus className="w-4 h-4" />
                                                                <span>Sair da Equipe</span>
                                                            </button>
                                                        );
                                                    } else if (teamIsFull) {
                                                        return (
                                                            <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">
                                                                <AlertCircle className="w-4 h-4" />
                                                                <span>Equipe Lotada</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <button onClick={() => handleVolunteerRegister(team.id)} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                                                <UserPlus className="w-4 h-4" />
                                                                <span>Entrar na Equipe</span>
                                                            </button>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        )}
                                        {/* Mensagem de histórico se evento finalizado */}
                                        {event.status === 'completed' && (
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 text-sm">
                                                <AlertCircle className="w-4 h-4 mr-2 inline" />
                                                Este evento está finalizado. As equipes abaixo são apenas para histórico e não podem ser editadas.
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {/* Botão de criar equipe só para eventos ativos */}
                        {canEdit && event.status !== 'completed' && (
                            <Link
                                to={`/teams/create?event=${event.id}`}
                                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>Criar Equipe</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Estatísticas */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Total de Voluntários</span>
                                <span className="font-semibold text-gray-900">{totalVolunteers}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Inscrições Diretas</span>
                                <span className="font-semibold text-gray-900">
                                    {event.event_registrations?.filter(reg =>
                                        reg.status === 'confirmed' || reg.status === 'pending'
                                    ).length || 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Voluntários em Equipes</span>
                                <span className="font-semibold text-gray-900">
                                    {event.teams?.reduce((sum, team) =>
                                        sum + (team.members?.filter(member => member.status === 'active').length || 0), 0
                                    ) || 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Vagas Disponíveis</span>
                                <span className="font-semibold text-gray-900">{(event.max_volunteers || 0) - totalVolunteers}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Número de Equipes</span>
                                <span className="font-semibold text-gray-900">{event.teams?.length || 0}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Taxa de Ocupação</span>
                                <span className="font-semibold text-gray-900">
                                    {event.max_volunteers ? Math.round((totalVolunteers / event.max_volunteers) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Informações do Administrador */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizador</h3>

                        <div className="space-y-3">
                            <div>
                                <p className="font-medium text-gray-900">{event.admin?.full_name}</p>
                                <p className="text-sm text-gray-600">{event.admin?.email}</p>
                            </div>

                            <div className="text-xs text-gray-500">
                                <p>Criado em: {formatDate(event.created_at)}</p>
                                {event.updated_at !== event.created_at && (
                                    <p>Atualizado em: {formatDate(event.updated_at)}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
