/**
 * Utilitário de diagnóstico para problemas de perfil de usuário
 */

import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

// Função utilitária para adicionar timeout
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout em ${operation} após ${ms}ms`)), ms)
    )
    return Promise.race([promise, timeout])
}

export async function diagnoseUserProfile(userId: string): Promise<void> {
    logger.info('[DIAGNOSTIC] INÍCIO - Verificando problemas de perfil para userId:', userId)

    try {
        // 1. Verificar se a sessão está ativa
        logger.debug('[DIAGNOSTIC] Verificando sessão...')

        try {
            const { data: session, error: sessionError } = await withTimeout(
                supabase.auth.getSession(),
                5000,
                'verificação de sessão'
            )

            if (sessionError) {
                logger.error('[DIAGNOSTIC] Erro ao obter sessão:', sessionError)
                return
            }

            logger.debug('[DIAGNOSTIC] Sessão ativa:', !!session.session?.user)
            logger.debug('[DIAGNOSTIC] Email da sessão:', session.session?.user?.email)
            logger.debug('[DIAGNOSTIC] ID da sessão:', session.session?.user?.id)
        } catch (timeoutError) {
            console.error('⏰ [DIAGNOSTIC] TIMEOUT na verificação de sessão:', timeoutError)
            return
        }

        // 2. Verificar se conseguimos acessar a tabela users
        logger.debug('[DIAGNOSTIC] Testando acesso à tabela users...')

        try {
            // Usar timeout apenas em Promise.resolve para evitar problemas de tipo
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout na consulta users')), 5000)
            })

            const queryPromise = supabase.from('users').select('id, email, created_at').limit(1)

            const result = await Promise.race([queryPromise, timeoutPromise])
            const { data: users, error: usersError } = result as { data: Array<{ id: string; email: string; created_at: string }> | null; error: Error | null }

            if (usersError) {
                logger.error('[DIAGNOSTIC] Erro ao acessar tabela users:', usersError)
                logger.info('[DIAGNOSTIC] Possíveis causas do erro:')

                if (usersError.message?.includes('permission denied')) {
                    logger.info(' - Problema de RLS (Row Level Security)')
                    logger.info(' - Usuário não autenticado ou sem permissões')
                } else if (usersError.message?.includes('500')) {
                    logger.info(' - Erro interno do servidor Supabase')
                    logger.info(' - Possível problema na configuração do banco')
                } else {
                    logger.info(' - Erro desconhecido:', usersError.message)
                }

                // Continuar diagnóstico mesmo com erro na tabela users
            } else {
                logger.info('[DIAGNOSTIC] Tabela users acessível, encontrados:', users?.length || 0, 'usuários')
            }
        } catch (timeoutError) {
            console.error('⏰ [DIAGNOSTIC] TIMEOUT ao acessar tabela users:', timeoutError)
            console.log('💡 [DIAGNOSTIC] A consulta à tabela users está travando - possível problema de RLS ou conexão')
            // Continuar diagnóstico mesmo com timeout
        }

        // 3. Verificar se o usuário específico existe
        logger.debug('[DIAGNOSTIC] Procurando usuário específico:', userId)

        const { data: specificUser, error: specificError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()

        if (specificError) {
            logger.error('[DIAGNOSTIC] Erro ao buscar usuário específico:', specificError)

            if (specificError.code === 'PGRST116') {
                logger.info('[DIAGNOSTIC] Usuário não existe na tabela users')
                logger.info('[DIAGNOSTIC] SOLUÇÃO: Criar perfil manualmente ou verificar processo de registro')
            } else {
                logger.info('[DIAGNOSTIC] Possível problema de RLS ou permissões')
            }
        } else {
            logger.info('[DIAGNOSTIC] Usuário encontrado:', {
                email: specificUser.email,
                role: specificUser.role,
                isActive: specificUser.is_active
            })
        }

        logger.info('[DIAGNOSTIC] FIM - Diagnóstico concluído')

    } catch (error) {
        logger.error('[DIAGNOSTIC] Erro durante diagnóstico:', error)
    } finally {
        logger.debug('[DIAGNOSTIC] Diagnóstico finalizado, retornando ao fluxo principal')
    }
}

// Função para criar perfil manualmente se não existir
export async function createMissingUserProfile(userId: string, email: string) {
    logger.info('[CREATE_PROFILE] Criando perfil faltante para:', email)

    try {
        const { data, error } = await supabase
            .from('users')
            .insert({
                id: userId,
                email: email,
                full_name: email.split('@')[0], // Nome baseado no email
                role: 'volunteer',
                is_first_login: true,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            logger.error('[CREATE_PROFILE] Erro ao criar perfil:', error)
            return null
        }

        logger.info('[CREATE_PROFILE] Perfil criado com sucesso:', data)
        return data
    } catch (error) {
        logger.error('[CREATE_PROFILE] Erro inesperado ao criar perfil:', error)
        return null
    }
}
