
import { supabase } from './supabase';
import { logSupabaseError, SuccessMessages } from './errorHandling';
import logger from './logger'
import type { PostgrestError } from '@supabase/supabase-js'
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
            logger.debug('[userService] Iniciando busca do perfil para userId:', userId)

            // Adicionar timeout menor para detectar problemas RLS mais rapidamente
            const timeoutMs = 10000
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT_RLS_DETECTED')), timeoutMs)
            })

            const queryPromise = supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single()

            logger.debug('[userService] Executando query com timeout de', timeoutMs, 'ms...')
            let result: any
            try {
                result = await Promise.race([queryPromise, timeoutPromise])
            } catch (raceErr) {
                // Timeout ocorreu — tentar um select reduzido como fallback diagnóstico
                logger.warn('[userService] Timeout na query users.select(*). Tentando select reduzido para diagnóstico...')
                try {
                    const { data: minimalData, error: minimalErr } = await supabase
                        .from('users')
                        .select('id, is_active, role, email')
                        .eq('id', userId)
                        .single()

                    if (minimalErr) {
                        logger.warn('[userService] Select reduzido também falhou:', minimalErr)
                        throw raceErr
                    }

                    logger.info('[userService] Select reduzido retornou dados (parcial):', { id: minimalData?.id, is_active: minimalData?.is_active })
                    // Retornar o resultado mínimo para evitar bloquear o fluxo — o caller deve lidar com campos ausentes
                    return minimalData as User
                } catch (fallbackErr) {
                    throw raceErr
                }
            }

            // Type guard para verificar se é uma resposta do Supabase
            if (result && typeof result === 'object' && 'data' in result) {
                const { data, error } = result as { data: User | null; error: Error | null }

                logger.debug('[userService] Resposta da query:', { data: !!data, error: !!error })

                if (error) {
                    logger.error('[userService] Erro na query:', error)

                    // Não fazer log de erro se for timeout RLS (evita spam)
                    if (!error.message?.includes('TIMEOUT_RLS')) {
                        logSupabaseError(error, 'Buscar perfil do usuário', { userId })
                    }

                    // Adicionar diagnóstico específico para problemas comuns
                    if ('code' in error && error.code === 'PGRST116') {
                        logger.info('Erro PGRST116: Nenhum resultado encontrado. O usuário pode não existir na tabela users.')
                    }
                    if (error.message?.includes('permission denied')) {
                        logger.info('Permissão negada: Verifique as políticas RLS da tabela users.')
                    }

                    return null
                }

                logger.info('[userService] Perfil encontrado:', data?.email || 'email não definido')
                logger.info(SuccessMessages.USER_UPDATED.replace('atualizado', 'carregado'), data?.email)
                return data
            }

            // Se chegou aqui sem 'data' no resultado, tratar como timeout/erro RLS
            if (!result || typeof result !== 'object' || !('data' in result)) {
                throw new Error('TIMEOUT_RLS_DETECTED')
            }

            return null

        } catch (error) {
            logger.error('[userService] Erro inesperado ao buscar perfil:', error)

            // Detectar timeout RLS específico
            if (error instanceof Error && error.message === 'TIMEOUT_RLS_DETECTED') {
                logger.error('[RLS] TIMEOUT detectado - Problema nas políticas RLS!')
                logger.info('[RLS] Execute fix_profile_creation.sql para corrigir')
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

            logger.info(SuccessMessages.USER_UPDATED, userId)
            return true
        } catch (error) {
            logger.error('Erro inesperado ao atualizar perfil:', error)
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
                logger.error('Erro ao buscar histórico de eventos:', {
                    userId,
                    code: error.code,
                    message: error.message
                })
                return []
            }

            logger.info(`Eventos encontrados no histórico: ${data?.length || 0}`)
            return data || []
        } catch (error) {
            logger.error('Erro inesperado ao buscar histórico:', error)
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
                    logger.warn('Função get_user_stats não encontrada - verifique se a migration foi aplicada')
                } else {
                    logger.error('Erro ao buscar estatísticas do usuário:', {
                        userId,
                        code: error.code,
                        message: error.message
                    })
                }
                return null
            }

            logger.info('Estatísticas carregadas com sucesso')
            return data
        } catch (error) {
            logger.error('Erro inesperado ao buscar estatísticas:', error)
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
                    logger.error('Função leave_team não encontrada - verifique se a migration foi aplicada')
                } else if (error.code === 'P0001') {
                    logger.error('Usuário não é membro desta equipe')
                } else {
                    logger.error('Erro ao sair da equipe:', {
                        userId,
                        teamId,
                        code: error.code,
                        message: error.message
                    })
                }
                return false
            }

            logger.info('Usuário saiu da equipe com sucesso')
            return data
        } catch (error) {
            logger.error('Erro inesperado ao sair da equipe:', error)
            return false
        }
    },

    // Deletar conta
    async deleteAccount(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .rpc('delete_user_account', { user_id_param: userId })

        if (error) {
            logger.error('Erro ao deletar conta:', error)
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
            logger.error('Erro ao buscar usuários:', error)
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
                    logger.error('Função promote_to_captain não encontrada - verifique se a migration foi aplicada')
                } else if (error.code === 'P0001') {
                    logger.error('Usuário já é capitão ou admin')
                } else {
                    logger.error('Erro ao promover usuário a capitão:', {
                        userId,
                        code: error.code,
                        message: error.message
                    })
                }
                return false
            }

            logger.info('Usuário promovido a capitão com sucesso:', userId)
            return data
        } catch (error) {
            logger.error('Erro inesperado ao promover usuário:', error)
            return false
        }
    },

    // Demover usuário de capitão para voluntário
    async demoteToVolunteer(userId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({ role: 'volunteer' })
                .eq('id', userId)
                .eq('role', 'captain')
                .select()

            if (error) {
                logger.error('Erro ao demover usuário:', {
                    userId,
                    code: error.code,
                    message: error.message
                })
                return false
            }

            if (!data || data.length === 0) {
                logger.error('Usuário não encontrado ou não é capitão:', userId)
                return false
            }

            logger.info('Usuário demovido a voluntário com sucesso:', userId)
            return true
        } catch (error) {
            logger.error('Erro inesperado ao demover usuário:', error)
            return false
        }
    },

    // Demover capitães após finalização de evento
    async demoteCaptainsAfterEvent(eventId: string): Promise<number> {
        try {
            // Buscar capitães que lideraram equipes neste evento
            const { data: teams, error: teamsError } = await supabase
                .from('teams')
                .select(`
                    captain_id,
                    users!teams_captain_id_fkey(id, full_name, role)
                `)
                .eq('event_id', eventId)

            if (teamsError) {
                logger.error('Erro ao buscar equipes do evento:', teamsError)
                return 0
            }

            if (!teams || teams.length === 0) {
                logger.info('Nenhuma equipe encontrada para o evento:', eventId)
                return 0
            }

            // Filtrar apenas usuários que são capitães (não admins)
            const captainsTodemote = teams
                .filter(team => {
                    const user = Array.isArray(team.users) ? team.users[0] : team.users;
                    return user?.role === 'captain';
                })
                .map(team => team.captain_id)

            if (captainsTodemote.length === 0) {
                logger.info('Nenhum capitão para demover no evento:', eventId)
                return 0
            }

            // Demover todos os capitães de uma vez
            const { data, error } = await supabase
                .from('users')
                .update({ role: 'volunteer' })
                .in('id', captainsTodemote)
                .eq('role', 'captain') // Garantir que só demova capitães
                .select()

            if (error) {
                logger.error('Erro ao demover capitães em lote:', error)
                return 0
            }

            const demotedCount = data?.length || 0
            logger.info(`Capitães demovidos após finalização do evento: ${demotedCount}`, eventId)
            return demotedCount
        } catch (error) {
            logger.error('Erro inesperado ao demover capitães:', error)
            return 0
        }
    },

    // Desativar usuário e cancelar inscrições em eventos
    async deactivateUser(userId: string): Promise<boolean> {
        try {
            // Tentar RPC server-side seguro primeiro (se existir)
            try {
                const { data: rpcData, error: rpcErr } = await supabase.rpc('deactivate_user_and_cancel_registrations', { user_id_param: userId }) as any
                if (!rpcErr && rpcData !== undefined) {
                    logger.info('Usuário desativado via RPC:', userId)
                    return true
                }
                if (rpcErr) {
                    logger.warn('RPC deactivate_user_and_cancel_registrations retornou erro, fazendo fallback:', rpcErr)
                }
            } catch (rpcCallErr) {
                logger.warn('RPC deactivate_user_and_cancel_registrations não disponível, executando fallback:', rpcCallErr)
            }

            // Fallback: cancelar inscrições do usuário (pending/confirmed -> cancelled)
            const { error: regErr } = await supabase
                .from('event_registrations')
                .update({ status: 'cancelled' })
                .in('status', ['pending', 'confirmed'])
                .eq('user_id', userId)

            if (regErr) {
                logger.error('Erro ao cancelar inscrições do usuário (fallback):', regErr)
                // Não abortar imediatamente: tentar ao menos marcar o usuário como inativo
            } else {
                logger.info('Inscrições do usuário atualizadas para cancelled (quando aplicável)')
            }

            // Fallback adicional: remover usuário de equipes ativas (marcar removed)
            try {
                const { error: tmErr } = await supabase
                    .from('team_members')
                    .update({ status: 'removed', left_at: new Date().toISOString() })
                    .eq('user_id', userId)
                    .eq('status', 'active')

                if (tmErr) {
                    logger.error('Erro ao remover usuário de equipes (fallback):', tmErr)
                } else {
                    logger.info('Usuário removido de equipes ativas (fallback) quando aplicável')
                }
            } catch (tmCatch) {
                logger.warn('Erro inesperado ao tentar remover usuário de equipes (fallback):', tmCatch)
            }

            // Marcar usuário como inativo
            const { error: userErr } = await supabase
                .from('users')
                .update({ is_active: false })
                .eq('id', userId)

            if (userErr) {
                logger.error('Erro ao marcar usuário como inativo (fallback):', userErr)
                return false
            }

            logger.info('Usuário desativado com sucesso (fallback):', userId)
            return true
        } catch (error) {
            logger.error('Erro inesperado ao desativar usuário:', error)
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
            // Buscar notificações primeiro (evita ambiguidade de relacionamentos no PostgREST)
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

            const notificationsData: Notification[] = (data as Notification[]) || []

            // Se houver related_user_id, carregar os usuários relacionados em batch
            const relatedUserIds = Array.from(new Set(notificationsData.map(n => n.related_user_id).filter(Boolean))) as string[]
            if (relatedUserIds.length > 0) {
                const { data: usersData, error: usersErr } = await supabase
                    .from('users')
                    .select('id, full_name, phone, profile_image_url, avatar_url')
                    .in('id', relatedUserIds)

                if (usersErr) {
                    console.warn('[NOTIFICATIONS] Erro ao carregar usuários relacionados:', usersErr)
                } else if (usersData && Array.isArray(usersData)) {
                    type UserSummary = { id: string; full_name: string; phone: string; profile_image_url: string; avatar_url: string }
                    const usersMap = new Map((usersData as UserSummary[]).map((u: UserSummary) => [u.id, u]))
                    // Anexar related_user em cada notificação quando disponível
                    for (const n of notificationsData) {
                        if (n.related_user_id) {
                            // @ts-expect-error: Notification type does not include related_user, but we attach it dynamically here for convenience
                            n.related_user = usersMap.get(n.related_user_id) || null
                        }
                    }
                }
            }

            return notificationsData
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
        try {
            // Tentar RPC segura primeiro (evita problemas com RLS)
            const { error: rpcErr } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userId }) as { error?: { code?: string; message?: string } };
            if (rpcErr) {
                console.warn('[NOTIFICATIONS] RPC mark_all_notifications_read falhou, tentando update direto:', rpcErr)
                const { error } = await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('user_id', userId)
                    .eq('read', false)

                if (error) {
                    console.error('Erro ao marcar todas as notificações como lidas (fallback):', error)
                    return false
                }
                return true
            }

            // RPC executada com sucesso (rpcData contém o número de linhas atualizadas)
            return true
        } catch (err) {
            console.error('Erro inesperado ao marcar todas as notificações como lidas:', err)
            return false
        }
    },

    // Criar notificação: tenta usar RPC segura 'create_notification_rpc' e faz fallback para insert
    async createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<boolean> {
        try {
            // Primeiro, tente usar a RPC (recomendada quando RLS impede inserts diretos)
            const { error: rpcErr } = await supabase.rpc('create_notification_rpc', {
                p_user_id: notification.user_id,
                p_title: notification.title,
                p_message: notification.message,
                p_related_user_id: notification.related_user_id ?? null,
                p_related_team_id: notification.related_team_id ?? null
            }) as { error: PostgrestError | null }

            if (rpcErr) {
                // Se a RPC não existe ou falhou por outro motivo, log e tentar fallback
                console.warn('[NOTIFICATIONS] RPC create_notification_rpc retornou erro, tentando fallback insert:', rpcErr)

                // Se a função não existe (PGRST202) ou erro de rpc, tentar insert direto (pode falhar por RLS)
                const { error: insertErr } = await supabase.from('notifications').insert(notification)
                if (insertErr) {
                    console.error('Erro ao criar notificação via insert (fallback):', insertErr)
                    return false
                }
                return true
            }

            // RPC executada com sucesso
            return true
        } catch (err) {
            console.error('Erro inesperado ao criar notificação:', err)
            return false
        }
    },

    // Notificar todos os administradores
    async notifyAdmins(payload: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'error' | 'evaluation'; related_event_id?: string; related_user_id?: string; related_team_id?: string; }): Promise<boolean> {
        try {
            const { data: adminsData, error } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin')
                .eq('is_active', true)

            if (error) {
                console.error('[NOTIFICATIONS] Erro ao buscar administradores:', error)
                return false
            }

            let adminList: { id: string }[] = (adminsData as Array<{ id: string }>) || [];

            if (!adminList || adminList.length === 0) {
                console.info('[NOTIFICATIONS] Nenhum administrador encontrado por select direto. Tentando RPC get_admin_ids como fallback...')
                try {
                    const { data: adminRpcData, error: rpcErr } = await supabase.rpc('get_admin_ids');
                    if (rpcErr) {
                        console.warn('[NOTIFICATIONS] RPC get_admin_ids falhou:', rpcErr);
                    } else if (adminRpcData && Array.isArray(adminRpcData) && adminRpcData.length > 0) {
                        const rpcAdmins: { id: string }[] = (adminRpcData as Array<{ id: string }>);
                        adminList = rpcAdmins;
                        console.info('[NOTIFICATIONS] Fallback RPC retornou admins:', rpcAdmins.map(a => a.id).join(', '));
                    } else {
                        console.info('[NOTIFICATIONS] Nenhum administrador encontrado via RPC também')
                        return true
                    }
                } catch (e) {
                    console.error('[NOTIFICATIONS] Erro ao chamar RPC get_admin_ids:', e)
                    return true
                }
            }

            // Enviar notificações para cada admin (sequencialmente para melhor logging)
            console.info('[NOTIFICATIONS] Enviando notificações para administradores:', adminList.map(a => a.id).join(', '))
            const failures: Array<{ adminId: string; error?: unknown }> = []
            for (const a of adminList) {
                try {
                    const ok = await this.createNotification({
                        user_id: a.id,
                        title: payload.title,
                        message: payload.message,
                        type: payload.type || 'info',
                        related_user_id: payload.related_user_id,
                        related_event_id: payload.related_event_id,
                        related_team_id: payload.related_team_id,
                        read: false
                    })
                    if (!ok) failures.push({ adminId: a.id })
                } catch (e) {
                    failures.push({ adminId: a.id, error: e })
                }
            }

            if (failures.length > 0) {
                console.error('[NOTIFICATIONS] Falha ao enviar notificações para alguns administradores:', failures)
                return false
            }
            console.info('[NOTIFICATIONS] Notificações enviadas com sucesso para todos os administradores')
            return true
        } catch (err) {
            console.error('[NOTIFICATIONS] Erro ao notificar administradores:', err)
            return false
        }
    },

    // (Removido) Lógica de notificações sobre voluntários não alocados temporariamente desativada.
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
                // Log formatado e retorno falso para o chamador
                const formatted = logSupabaseError(error, 'Configurar perfil de administrador', { userId, email })
                console.error('❌ setupAdminProfile RPC error details:', formatted)
                return false
            }

            if (!data) {
                // RPC não retornou erro, mas retornou falsy (ex: função retornou false)
                console.error('❌ Falha na configuração do administrador: a função RPC `setup_admin_profile` retornou falso ou nulo.')
                console.error('💡 Verifique se a migration que cria `setup_admin_profile` foi aplicada no Supabase.')
                console.error('💡 Arquivo possível: supabase/migrations/SETUP_COMPLETO_DO_ZERO.sql')
                return false
            }

            // Sucesso
            console.log(SuccessMessages.ADMIN_SETUP, email)
            console.log('🔑 O usuário agora possui privilégios de administrador')
            return true
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
