import { supabase } from '../lib/supabase'

/**
 * Utilitário para lidar com erros 500 do servidor Supabase
 * Fornece diagnósticos e soluções alternativas
 */

export interface ServerErrorInfo {
    hasServerError: boolean
    errorType: 'rls' | 'auth' | 'connection' | 'recursion' | 'unknown'
    suggestions: string[]
    canProceed: boolean
}

export const diagnoseServerError = async (): Promise<ServerErrorInfo> => {
    console.log('🔍 [SERVER ERROR] Diagnosticando erro 500...')

    const info: ServerErrorInfo = {
        hasServerError: false,
        errorType: 'unknown',
        suggestions: [],
        canProceed: false
    }

    try {
        // Teste 1: Verificar autenticação
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
            console.error('❌ [SERVER ERROR] Problema na sessão:', sessionError)
            info.hasServerError = true
            info.errorType = 'auth'
            info.suggestions.push('Problema de autenticação - faça login novamente')
            return info
        }

        if (!session) {
            console.log('⚠️ [SERVER ERROR] Nenhuma sessão ativa')
            info.hasServerError = true
            info.errorType = 'auth'
            info.suggestions.push('Usuário não autenticado')
            return info
        }

        console.log('✅ [SERVER ERROR] Sessão ativa:', session.user.email)

        // Teste 2: Verificar acesso básico ao Supabase
        try {
            const { error: basicError } = await supabase
                .from('users')
                .select('count')
                .limit(0)

            if (basicError) {
                console.error('❌ [SERVER ERROR] Erro básico de acesso:', basicError)

                if (basicError.message?.includes('permission denied') || basicError.message?.includes('policy')) {
                    info.hasServerError = true
                    info.errorType = 'rls'
                    info.suggestions.push('Problema de Row Level Security (RLS)')
                    info.suggestions.push('Verifique as políticas de acesso no Supabase')
                    info.suggestions.push('O usuário pode não ter permissão para acessar a tabela users')
                } else if (basicError.message?.includes('infinite recursion')) {
                    info.hasServerError = true
                    info.errorType = 'recursion'
                    info.suggestions.push('Recursão infinita detectada nas políticas RLS')
                    info.suggestions.push('Execute a migração fix_rls_recursion.sql')
                    info.suggestions.push('Use a função segura create_admin_profile_safe')
                } else if (basicError.message?.includes('500')) {
                    info.hasServerError = true
                    info.errorType = 'connection'
                    info.suggestions.push('Erro interno do servidor Supabase')
                    info.suggestions.push('Verifique a configuração do banco de dados')
                    info.suggestions.push('Possível problema na migração ou nas políticas RLS')
                } else {
                    info.hasServerError = true
                    info.errorType = 'unknown'
                    info.suggestions.push(`Erro desconhecido: ${basicError.message}`)
                }
                return info
            }

            console.log('✅ [SERVER ERROR] Acesso básico funcionando')
            info.canProceed = true

        } catch (error) {
            console.error('❌ [SERVER ERROR] Erro de conexão:', error)
            info.hasServerError = true
            info.errorType = 'connection'
            info.suggestions.push('Problema de conectividade com o Supabase')
            info.suggestions.push('Verifique sua conexão com a internet')
            return info
        }

        // Se chegou até aqui, não há erros detectados
        console.log('✅ [SERVER ERROR] Nenhum erro de servidor detectado')
        info.canProceed = true
        return info

    } catch (error) {
        console.error('❌ [SERVER ERROR] Erro inesperado no diagnóstico:', error)
        info.hasServerError = true
        info.errorType = 'unknown'
        info.suggestions.push('Erro inesperado durante o diagnóstico')
        return info
    }
}

/**
 * Função para criar admin usando a função segura do banco
 * Contorna problemas de RLS e recursão infinita
 */
export const createAdminWithSafeFunction = async (email: string, password: string, name: string) => {
    console.log('🔧 [SAFE] Criando admin com função segura do banco...')

    try {
        // Método 1: Tentar criar usuário diretamente na auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: 'admin'
                }
            }
        })

        if (authError) {
            console.error('❌ [SAFE] Erro ao criar usuário na auth:', authError)
            return { success: false, error: authError.message }
        }

        if (!authData.user) {
            console.error('❌ [SAFE] Usuário não foi criado')
            return { success: false, error: 'Usuário não foi criado' }
        }

        console.log('✅ [SAFE] Usuário criado na auth:', authData.user.email)

        // Aguardar um pouco para a criação do perfil via trigger
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Usar a função segura do banco para criar o perfil
        const { data: result, error: functionError } = await supabase
            .rpc('create_admin_profile_safe', {
                admin_user_id: authData.user.id,
                admin_email: email,
                admin_name: name
            })

        if (functionError) {
            console.error('❌ [SAFE] Erro ao chamar função segura:', functionError)
            return {
                success: false,
                error: `Erro ao criar perfil: ${functionError.message}`,
                userId: authData.user.id
            }
        }

        const functionResult = result as { success: boolean; message?: string; error?: string; user_id?: string }

        if (!functionResult.success) {
            console.error('❌ [SAFE] Função retornou erro:', functionResult.error)
            return {
                success: false,
                error: functionResult.error || 'Erro desconhecido na função',
                userId: authData.user.id
            }
        }

        console.log('✅ [SAFE] Perfil criado com função segura:', functionResult.message)

        return {
            success: true,
            userId: authData.user.id,
            message: 'Admin criado com sucesso usando função segura do banco'
        }

    } catch (error) {
        console.error('❌ [SAFE] Erro inesperado:', error)
        return { success: false, error: `Erro inesperado: ${error}` }
    }
}

/**
 * Verificar se admin existe usando métodos alternativos
 */
export const checkAdminExistsWithFallback = async (email: string) => {
    console.log('🔍 [FALLBACK] Verificando admin com método alternativo...')

    try {
        // Método 1: Tentar via auth users (não requer RLS)
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
            console.error('❌ [FALLBACK] Erro ao verificar usuário atual:', authError)
            return { exists: false, isAdmin: false, error: authError.message }
        }

        if (user && user.email === email) {
            console.log('✅ [FALLBACK] Usuário encontrado na auth:', user.email)

            // Tentar verificar perfil na tabela users
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single()

            if (profileError) {
                console.log('⚠️ [FALLBACK] Não foi possível verificar role na tabela users')
                return {
                    exists: true,
                    isAdmin: false,
                    needsProfileCreation: true,
                    userId: user.id
                }
            }

            return {
                exists: true,
                isAdmin: profile.role === 'admin',
                userId: user.id,
                role: profile.role
            }
        }

        return { exists: false, isAdmin: false }

    } catch (error) {
        console.error('❌ [FALLBACK] Erro inesperado:', error)
        return { exists: false, isAdmin: false, error: `Erro inesperado: ${error}` }
    }
}
