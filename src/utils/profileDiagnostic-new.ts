/**
 * Utilitário de diagnóstico para problemas de perfil de usuário
 */

import { supabase } from '../lib/supabase'

export async function diagnoseUserProfile(userId: string): Promise<void> {
    console.log('🔧 [DIAGNOSTIC] INÍCIO - Verificando problemas de perfil para userId:', userId)

    try {
        // 1. Verificar se a sessão está ativa
        console.log('🔑 [DIAGNOSTIC] Verificando sessão...')
        const { data: session, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
            console.error('❌ [DIAGNOSTIC] Erro ao obter sessão:', sessionError)
            return
        }

        console.log('🔑 [DIAGNOSTIC] Sessão ativa:', !!session.session?.user)
        console.log('📧 [DIAGNOSTIC] Email da sessão:', session.session?.user?.email)
        console.log('🆔 [DIAGNOSTIC] ID da sessão:', session.session?.user?.id)

        // 2. Verificar se conseguimos acessar a tabela users
        console.log('🔍 [DIAGNOSTIC] Testando acesso à tabela users...')

        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, created_at')
            .limit(1)

        if (usersError) {
            console.error('❌ [DIAGNOSTIC] Erro ao acessar tabela users:', usersError)
        } else {
            console.log('✅ [DIAGNOSTIC] Tabela users acessível, encontrados:', users?.length || 0, 'usuários')
        }

        // 3. Verificar se o usuário específico existe
        console.log('🎯 [DIAGNOSTIC] Procurando usuário específico:', userId)

        const { data: specificUser, error: specificError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()

        if (specificError) {
            console.error('❌ [DIAGNOSTIC] Erro ao buscar usuário específico:', specificError)

            if (specificError.code === 'PGRST116') {
                console.log('💡 [DIAGNOSTIC] Usuário não existe na tabela users')
                console.log('🔧 [DIAGNOSTIC] SOLUÇÃO: Criar perfil manualmente ou verificar processo de registro')
            } else {
                console.log('💡 [DIAGNOSTIC] Possível problema de RLS ou permissões')
            }
        } else {
            console.log('✅ [DIAGNOSTIC] Usuário encontrado:', {
                email: specificUser.email,
                role: specificUser.role,
                isActive: specificUser.is_active
            })
        }

        console.log('🏁 [DIAGNOSTIC] FIM - Diagnóstico concluído')

    } catch (error) {
        console.error('❌ [DIAGNOSTIC] Erro durante diagnóstico:', error)
    } finally {
        console.log('🔄 [DIAGNOSTIC] Diagnóstico finalizado, retornando ao fluxo principal')
    }
}

// Função para criar perfil manualmente se não existir
export async function createMissingUserProfile(userId: string, email: string) {
    console.log('🔨 [CREATE_PROFILE] Criando perfil faltante para:', email)

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
            console.error('❌ [CREATE_PROFILE] Erro ao criar perfil:', error)
            return null
        }

        console.log('✅ [CREATE_PROFILE] Perfil criado com sucesso:', data)
        return data
    } catch (error) {
        console.error('❌ [CREATE_PROFILE] Erro inesperado ao criar perfil:', error)
        return null
    }
}
