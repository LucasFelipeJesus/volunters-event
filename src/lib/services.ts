
import { supabase } from './supabase';
import { logSupabaseError, SuccessMessages } from './errorHandling';
import type {
    User,
    Event,
    Team,
    Evaluation,
    AdminEvaluation,
    Notification,
    UserEventHistory,
    TeamDetails,
    EvaluationDetails,
    AdminEvaluationDetails,
    UserStats
} from './supabase';

/**
 * Altera o papel do usuário entre 'volunteer' e 'captain'.
 * @param userId ID do usuário
 * @param role 'volunteer' ou 'captain'
 */
export async function setUserRole(userId: string, role: 'volunteer' | 'captain') {
    const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);
    return error;
}



// Services para usuários
export const userService = {
    // Obter perfil do usuário
    async getProfile(userId: string): Promise<User | null> {
        try {
            console.log('🔍 [userService] Iniciando busca do perfil para userId:', userId)

            // Adicionar timeout menor para detectar problemas RLS mais rapidamente
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT_RLS_DETECTED')), 10000) // 10 segundos
            })

            const queryPromise = supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single()

            console.log('⏰ [userService] Executando query com timeout de 5s...')
            const result = await Promise.race([queryPromise, timeoutPromise])

            // Type guard para verificar se é uma resposta do Supabase
            if (result && typeof result === 'object' && 'data' in result) {
                const { data, error } = result as { data: User | null; error: Error | null }

                console.log('📊 [userService] Resposta da query:', { data: !!data, error: !!error })

                if (error) {
                    console.error('❌ [userService] Erro na query:', error)

                    // Não fazer log de erro se for timeout RLS (evita spam)
                    if (!error.message?.includes('TIMEOUT_RLS')) {
                        logSupabaseError(error, 'Buscar perfil do usuário', { userId })
                    }

                    // Adicionar diagnóstico específico para problemas comuns
                    if ('code' in error && error.code === 'PGRST116') {
                        console.error('💡 Erro PGRST116: Nenhum resultado encontrado. O usuário pode não existir na tabela users.')
                    }
                    if (error.message?.includes('permission denied')) {
                        console.error('💡 Permissão negada: Verifique as políticas RLS da tabela users.')
                    }

                    return null
                }

                console.log('✅ [userService] Perfil encontrado:', data?.email || 'email não definido')
                console.log(SuccessMessages.USER_UPDATED.replace('atualizado', 'carregado'), data?.email)
                return data
            }

            // Se chegou aqui, é um timeout
            throw new Error('TIMEOUT_RLS_DETECTED')

        } catch (error) {
            console.error('❌ [userService] Erro inesperado ao buscar perfil:', error)

            // Detectar timeout RLS específico
            if (error instanceof Error && error.message === 'TIMEOUT_RLS_DETECTED') {
                console.error('🔄 [RLS] TIMEOUT detectado - Problema nas políticas RLS!')
                console.error('💡 [RLS] Execute fix_profile_creation.sql para corrigir')
                throw new Error('Timeout RLS - Execute correção SQL')
            }

            return null
        }
    },

    // Atualizar perfil do usuário
    async updateProfile(userId: string, updates: Partial<User>): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId)

            if (error) {
                logSupabaseError(error, 'Atualizar perfil do usuário', { userId, updates })
                return false
            }

            console.log(SuccessMessages.USER_UPDATED, userId)
            return true
        } catch (error) {
            console.error('❌ Erro inesperado ao atualizar perfil:', error)
            return false
        }
    },

    // Obter histórico de eventos do usuário
    async getEventHistory(userId: string): Promise<UserEventHistory[]> {
        try {
            const { data, error } = await supabase
                .from('user_event_history')
                .select('*')
                .eq('user_id', userId)
                .order('event_date', { ascending: false })

            if (error) {
                console.error('❌ Erro ao buscar histórico de eventos:', {
                    userId,
                    code: error.code,
                    message: error.message
                })
                return []
            }

            console.log(`📅 ${data?.length || 0} eventos encontrados no histórico`)
            return data || []
        } catch (error) {
            console.error('❌ Erro inesperado ao buscar histórico:', error)
            return []
        }
    },

    // Obter estatísticas do usuário
    async getStats(userId: string): Promise<UserStats | null> {
        try {
            const { data, error } = await supabase
                .rpc('get_user_stats', { user_id_param: userId })

            if (error) {
                if (error.code === 'PGRST202') {
                    console.warn('📊 Função get_user_stats não encontrada - verifique se a migration foi aplicada')
                } else {
                    console.error('❌ Erro ao buscar estatísticas do usuário:', {
                        userId,
                        code: error.code,
                        message: error.message
                    })
                }
                return null
            }

            console.log('✅ Estatísticas carregadas com sucesso')
            return data
        } catch (error) {
            console.error('❌ Erro inesperado ao buscar estatísticas:', error)
            return null
        }
    },

    // Sair de uma equipe
    async leaveTeam(userId: string, teamId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .rpc('leave_team', {
                    user_id_param: userId,
                    team_id_param: teamId
                })

            if (error) {
                if (error.code === 'PGRST202') {
                    console.error('❌ Função leave_team não encontrada - verifique se a migration foi aplicada')
                } else if (error.code === 'P0001') {
                    console.error('❌ Usuário não é membro desta equipe')
                } else {
                    console.error('❌ Erro ao sair da equipe:', {
                        userId,
                        teamId,
                        code: error.code,
                        message: error.message
                    })
                }
                return false
            }

            console.log('✅ Usuário saiu da equipe com sucesso')
            return data
        } catch (error) {
            console.error('❌ Erro inesperado ao sair da equipe:', error)
            return false
        }
    },

    // Deletar conta
    async deleteAccount(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .rpc('delete_user_account', { user_id_param: userId })

        if (error) {
            console.error('Erro ao deletar conta:', error)
            return false
        }
        return data
    },

    // Listar todos os usuários (apenas admins)
    async getAllUsers(): Promise<User[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Erro ao buscar usuários:', error)
            return []
        }
        return data || []
    },

    // Promover usuário a capitão
    async promoteToCaptain(userId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .rpc('promote_to_captain', { user_id_param: userId })

            if (error) {
                if (error.code === 'PGRST202') {
                    console.error('❌ Função promote_to_captain não encontrada - verifique se a migration foi aplicada')
                } else if (error.code === 'P0001') {
                    console.error('❌ Usuário já é capitão ou admin')
                } else {
                    console.error('❌ Erro ao promover usuário a capitão:', {
                        userId,
                        code: error.code,
                        message: error.message
                    })
                }
                return false
            }

            console.log('👑 Usuário promovido a capitão com sucesso:', userId)
            return data
        } catch (error) {
            console.error('❌ Erro inesperado ao promover usuário:', error)
            return false
        }
    }
}

// Services para eventos
export const eventService = {
    // Listar eventos publicados
    async getPublishedEvents(): Promise<Event[]> {
        try {
            const { data, error } = await supabase
                .from('events')
                .select(`
        *,
        teams(*)
      `)
                .in('status', ['published', 'in_progress'])
                .order('event_date', { ascending: true })

            if (error) {
                console.error('❌ Erro ao buscar eventos publicados:', {
                    code: error.code,
                    message: error.message
                })
                return []
            }

            console.log(`📅 ${data?.length || 0} eventos publicados encontrados`)
            return data || []
        } catch (error) {
            console.error('❌ Erro inesperado ao buscar eventos:', error)
            return []
        }
    },

    // Obter evento específico
    async getEvent(eventId: string): Promise<Event | null> {
        const { data, error } = await supabase
            .from('events')
            .select(`
        *,
        teams(
          *,
          members:team_members(
            *,
            user:users(*)
          )
        )
      `)
            .eq('id', eventId)
            .single()

        if (error) {
            console.error('Erro ao buscar evento:', error)
            return null
        }
        return data
    },

    // Criar evento (apenas admins)
    async createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'current_teams'>): Promise<Event | null> {
        try {
            console.log('📝 Criando novo evento:', event.title)

            const { data, error } = await supabase
                .from('events')
                .insert(event)
                .select()
                .single()

            if (error) {
                if (error.code === '42501') {
                    console.error('❌ Permissão negada - apenas administradores podem criar eventos')
                } else if (error.code === '23505') {
                    console.error('❌ Já existe um evento com essas informações')
                } else {
                    console.error('❌ Erro ao criar evento:', {
                        title: event.title,
                        code: error.code,
                        message: error.message
                    })
                }
                return null
            }

            console.log('✅ Evento criado com sucesso:', data.title)
            return data
        } catch (error) {
            console.error('❌ Erro inesperado ao criar evento:', error)
            return null
        }
    },

    // Atualizar evento
    async updateEvent(eventId: string, updates: Partial<Event>): Promise<boolean> {
        const { error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', eventId)

        if (error) {
            console.error('Erro ao atualizar evento:', error)
            return false
        }
        return true
    },

    // Listar todos os eventos (admin)
    async getAllEvents(): Promise<Event[]> {
        const { data, error } = await supabase
            .from('events')
            .select(`
        *,
        teams(*)
      `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Erro ao buscar eventos:', error)
            return []
        }
        return data || []
    }
}

// Services para equipes
export const teamService = {
    // Obter detalhes da equipe
    async getTeamDetails(teamId: string): Promise<TeamDetails | null> {
        const { data, error } = await supabase
            .from('team_details')
            .select('*')
            .eq('team_id', teamId)
            .single()

        if (error) {
            console.error('Erro ao buscar detalhes da equipe:', error)
            return null
        }
        return data
    },

    // Criar equipe
    async createTeam(team: Omit<Team, 'id' | 'created_at' | 'updated_at' | 'current_volunteers'>): Promise<Team | null> {
        const { data, error } = await supabase
            .from('teams')
            .insert(team)
            .select()
            .single()

        if (error) {
            console.error('Erro ao criar equipe:', error)
            return null
        }
        return data
    },

    // Adicionar membro à equipe
    async addMember(teamId: string, userId: string, roleInTeam: 'captain' | 'volunteer'): Promise<boolean> {
        const { error } = await supabase
            .from('team_members')
            .insert({
                team_id: teamId,
                user_id: userId,
                role_in_team: roleInTeam,
                status: 'active'
            })

        if (error) {
            console.error('Erro ao adicionar membro:', error)
            return false
        }
        return true
    },

    // Remover membro da equipe
    async removeMember(teamId: string, userId: string): Promise<boolean> {
        const { error } = await supabase
            .from('team_members')
            .update({ status: 'removed', left_at: new Date().toISOString() })
            .match({ team_id: teamId, user_id: userId })

        if (error) {
            console.error('Erro ao remover membro:', error)
            return false
        }
        return true
    },

    // Obter equipes do evento
    async getEventTeams(eventId: string): Promise<TeamDetails[]> {
        const { data, error } = await supabase
            .from('team_details')
            .select('*')
            .eq('event_id', eventId)

        if (error) {
            console.error('Erro ao buscar equipes do evento:', error)
            return []
        }
        return data || []
    }
}

// Services para avaliações
export const evaluationService = {
    // Criar avaliação de voluntário
    async createEvaluation(evaluation: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
        const { error } = await supabase
            .from('evaluations')
            .insert(evaluation)

        if (error) {
            console.error('Erro ao criar avaliação:', error)
            return false
        }
        return true
    },

    // Obter avaliações do voluntário
    async getVolunteerEvaluations(volunteerId: string): Promise<EvaluationDetails[]> {
        const { data, error } = await supabase
            .from('evaluation_details')
            .select('*')
            .eq('volunteer_id', volunteerId)
            .order('evaluation_date', { ascending: false })

        if (error) {
            console.error('Erro ao buscar avaliações:', error)
            return []
        }
        return data || []
    },

    // Criar avaliação de capitão
    async createAdminEvaluation(evaluation: Omit<AdminEvaluation, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
        const { error } = await supabase
            .from('admin_evaluations')
            .insert(evaluation)

        if (error) {
            console.error('Erro ao criar avaliação de capitão:', error)
            return false
        }
        return true
    },

    // Obter avaliações do capitão
    async getCaptainEvaluations(captainId: string): Promise<AdminEvaluationDetails[]> {
        const { data, error } = await supabase
            .from('admin_evaluation_details')
            .select('*')
            .eq('captain_id', captainId)
            .order('evaluation_date', { ascending: false })

        if (error) {
            console.error('Erro ao buscar avaliações do capitão:', error)
            return []
        }
        return data || []
    }
}

// Services para notificações
export const notificationService = {
    // Obter notificações do usuário
    async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
        try {
            // Query simplificada para evitar erros de sintaxe
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) {
                console.error('❌ [NOTIFICATIONS] Erro ao buscar notificações:', error)

                // Se a tabela não existe, retornar array vazio silenciosamente
                if (error.code === 'PGRST116' || error.message?.includes('relation "notifications" does not exist')) {
                    console.log('💡 [NOTIFICATIONS] Tabela de notificações não existe - retornando array vazio')
                    return []
                }

                return []
            }

            return data || []
        } catch (error) {
            console.error('❌ [NOTIFICATIONS] Erro inesperado:', error)
            return []
        }
    },

    // Marcar notificação como lida
    async markAsRead(notificationId: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)

        if (error) {
            console.error('Erro ao marcar notificação como lida:', error)
            return false
        }
        return true
    },

    // Marcar todas as notificações como lidas
    async markAllAsRead(userId: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false)

        if (error) {
            console.error('Erro ao marcar todas as notificações como lidas:', error)
            return false
        }
        return true
    },

    // Criar notificação
    async createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .insert(notification)

        if (error) {
            console.error('Erro ao criar notificação:', error)
            return false
        }
        return true
    }
}

// Services para autenticação
export const authService = {
    // Criar perfil após cadastro
    async createUserProfile(user: Omit<User, 'created_at' | 'updated_at'>): Promise<boolean> {
        try {
            console.log('👤 Criando perfil para usuário:', user.email)

            const { error } = await supabase
                .from('users')
                .insert({
                    ...user,
                    role: 'volunteer', // Sempre começa como voluntário
                    is_first_login: true,
                    is_active: true
                })

            if (error) {
                if (error.code === '23505') {
                    console.error('❌ Usuário já possui perfil criado:', user.email)
                } else if (error.code === '42501') {
                    console.error('🔒 Erro de política RLS - perfil será criado no primeiro login:', {
                        email: user.email,
                        code: error.code,
                        message: error.message
                    })
                    // Não retorna false aqui - perfil será criado no primeiro login
                    return false
                } else {
                    console.error('❌ Erro ao criar perfil do usuário:', {
                        email: user.email,
                        code: error.code,
                        message: error.message
                    })
                }
                return false
            }

            console.log('✅ Perfil de usuário criado com sucesso:', user.email)
            return true
        } catch (error) {
            console.error('❌ Erro inesperado ao criar perfil:', error)
            return false
        }
    },

    // Verificar se é primeiro login
    async isFirstLogin(userId: string): Promise<boolean> {
        try {
            console.log('🔍 [authService] Verificando primeiro login para:', userId)

            const { data, error } = await supabase
                .from('users')
                .select('is_first_login')
                .eq('id', userId)
                .single()

            if (error) {
                console.error('❌ [authService] Erro ao verificar primeiro login:', error)
                return false
            }

            const isFirst = data?.is_first_login || false
            console.log('📝 [authService] Primeiro login:', isFirst)
            return isFirst
        } catch (error) {
            console.error('❌ [authService] Erro inesperado em isFirstLogin:', error)
            return false
        }
    },

    // Marcar primeiro login como concluído
    async completeFirstLogin(userId: string): Promise<boolean> {
        const { error } = await supabase
            .from('users')
            .update({ is_first_login: false })
            .eq('id', userId)

        if (error) {
            console.error('Erro ao marcar primeiro login:', error)
            return false
        }
        return true
    },

    // Configurar usuário como administrador
    async setupAdminProfile(userId: string, email: string, fullName: string): Promise<boolean> {
        try {
            console.log('🔧 Configurando perfil de administrador...')

            const { data, error } = await supabase
                .rpc('setup_admin_profile', {
                    admin_user_id: userId,
                    admin_email: email,
                    admin_name: fullName
                })

            if (error) {
                logSupabaseError(error, 'Configurar perfil de administrador', { userId, email })
                return false
            }

            if (data) {
                console.log(SuccessMessages.ADMIN_SETUP, email)
                console.log('🔑 O usuário agora possui privilégios de administrador')
            } else {
                console.error('❌ Falha na configuração do administrador')
            }

            return data
        } catch (error) {
            console.error('❌ Erro inesperado ao configurar admin:', error)
            return false
        }
    },

    // Criar administrador via Supabase Auth Admin API
    async createAdmin(email: string, password: string, fullName: string): Promise<string | null> {
        try {
            console.log('🚀 Criando novo administrador via Supabase Auth...')

            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name: fullName
                }
            })

            if (error) {
                if (error.message.includes('admin api')) {
                    console.error('❌ API Admin não disponível')
                    console.log('💡 Use o Dashboard do Supabase ou SQL para criar o admin')
                } else if (error.message.includes('email')) {
                    console.error('❌ Email já está em uso:', email)
                } else {
                    console.error('❌ Erro ao criar usuário admin:', {
                        email,
                        code: error.status,
                        message: error.message
                    })
                }
                return null
            }

            if (data.user) {
                console.log('✅ Usuário criado no Supabase Auth:', data.user.id)

                // Configurar como admin
                const success = await this.setupAdminProfile(data.user.id, email, fullName)
                if (success) {
                    console.log('🎉 Administrador criado e configurado com sucesso!')
                    return data.user.id
                } else {
                    console.error('❌ Usuário criado mas falhou na configuração como admin')
                }
            }

            return null
        } catch (error) {
            console.error('❌ Erro inesperado ao criar administrador:', error)
            console.log('💡 Tente criar o admin manualmente via Dashboard do Supabase')
            return null
        }
    }
}
