import { supabase } from '../lib/supabase'
import { authService } from '../lib/services'
import { diagnoseServerError, createAdminWithSafeFunction, checkAdminExistsWithFallback } from './serverErrorHandler'

/**
 * Script para configurar o administrador inicial do sistema
 * Execute este script uma vez para criar o administrador padrão
 * Inclui fallbacks para contornar erros 500 do servidor e recursão RLS
 */

const ADMIN_EMAIL = 'admin@sistema.com'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Administrador do Sistema'

export const setupInitialAdmin = async () => {
    try {
        console.log('🚀 Configurando administrador inicial...')

        // Primeiro, diagnosticar se há problemas de servidor
        const serverInfo = await diagnoseServerError()

        if (serverInfo.hasServerError) {
            console.log('⚠️ Problema de servidor detectado:', serverInfo.errorType)
            console.log('💡 Sugestões:')
            serverInfo.suggestions.forEach(suggestion => {
                console.log(`   - ${suggestion}`)
            })

            // Se for problema de recursão, usar função segura imediatamente
            if (serverInfo.errorType === 'recursion') {
                console.log('🔧 Recursão RLS detectada, usando função segura...')

                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

                if (safeResult.success) {
                    console.log('✅ Administrador criado com função segura!')
                    console.log('📧 Email:', ADMIN_EMAIL)
                    console.log('🔑 Senha:', ADMIN_PASSWORD)
                    console.log('⚠️  IMPORTANTE: Altere a senha no primeiro login!')
                    return true
                } else {
                    console.error('❌ Erro na função segura:', safeResult.error)
                    return false
                }
            }

            if (!serverInfo.canProceed) {
                console.log('🔧 Tentando função segura como alternativa...')

                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

                if (safeResult.success) {
                    console.log('✅ Administrador criado com função segura!')
                    console.log('📧 Email:', ADMIN_EMAIL)
                    console.log('🔑 Senha:', ADMIN_PASSWORD)
                    console.log('⚠️  IMPORTANTE: Altere a senha no primeiro login!')
                    return true
                } else {
                    console.error('❌ Erro na função segura:', safeResult.error)
                    return false
                }
            }
        }

        // Verificar se já existe um administrador (método tradicional)
        try {
            const { data: existingUsers, error: checkError } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'admin')
                .limit(1)

            if (checkError) {
                console.error('❌ Erro ao verificar administradores existentes:', checkError)

                // Se é erro de recursão, usar função segura
                if (checkError.message?.includes('infinite recursion')) {
                    console.log('🔧 Recursão detectada, usando função segura...')
                    const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                    return safeResult.success
                }

                // Outros erros, tentar método alternativo
                console.log('🔧 Erro na verificação, tentando método alternativo...')
                const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)

                if (fallbackCheck.exists && fallbackCheck.isAdmin) {
                    console.log('✅ Administrador já existe (verificado via método alternativo)')
                    return true
                } else {
                    // Usar função segura
                    const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                    return safeResult.success
                }
            }

            if (existingUsers && existingUsers.length > 0) {
                console.log('✅ Administrador já existe:', existingUsers[0].email)
                return true
            }
        } catch (dbError) {
            console.error('❌ Erro de banco ao verificar admin existente:', dbError)

            // Se é erro de recursão, usar função segura
            if (dbError instanceof Error && dbError.message?.includes('infinite recursion')) {
                console.log('🔧 Recursão detectada no catch, usando função segura...')
                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                return safeResult.success
            }

            // Usar função segura como fallback
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        }

        // Verificar se o usuário existe na auth mas não tem perfil
        try {
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

            if (authError) {
                console.error('❌ Erro ao listar usuários de autenticação:', authError)

                // Usar função segura
                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                return safeResult.success
            }

            const existingAuthUser = authUsers.users.find(user => user.email === ADMIN_EMAIL)

            if (existingAuthUser) {
                console.log('👤 Usuário encontrado na auth, configurando perfil com função segura...')

                // Usar função segura diretamente
                const { data: result, error: functionError } = await supabase
                    .rpc('create_admin_profile_safe', {
                        admin_user_id: existingAuthUser.id,
                        admin_email: ADMIN_EMAIL,
                        admin_name: ADMIN_NAME
                    })

                if (functionError) {
                    console.error('❌ Erro ao chamar função segura:', functionError)
                    return false
                }

                const functionResult = result as { success: boolean; message?: string; error?: string }

                if (functionResult.success) {
                    console.log('✅ Perfil de administrador configurado com função segura!')
                    return true
                } else {
                    console.error('❌ Função segura retornou erro:', functionResult.error)
                    return false
                }
            }
        } catch (authError) {
            console.error('❌ Erro ao verificar auth users:', authError)

            // Usar função segura
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        }

        // Criar novo usuário administrador
        console.log('👤 Criando novo usuário administrador...')

        try {
            // Tentar primeiro com função segura
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

            if (safeResult.success) {
                console.log('✅ Administrador criado com função segura!')
                console.log('📧 Email:', ADMIN_EMAIL)
                console.log('🔑 Senha:', ADMIN_PASSWORD)
                console.log('⚠️  IMPORTANTE: Altere a senha no primeiro login!')
                return true
            } else {
                console.log('⚠️ Função segura falhou, tentando método tradicional...')

                // Fallback para método tradicional
                const adminId = await authService.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

                if (adminId) {
                    console.log('✅ Administrador criado com método tradicional!')
                    console.log('📧 Email:', ADMIN_EMAIL)
                    console.log('🔑 Senha:', ADMIN_PASSWORD)
                    console.log('⚠️  IMPORTANTE: Altere a senha no primeiro login!')
                    return true
                } else {
                    console.error('❌ Ambos os métodos falharam')
                    return false
                }
            }
        } catch (createError) {
            console.error('❌ Erro ao criar admin:', createError)

            // Último recurso: função segura
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        }

    } catch (error) {
        console.error('❌ Erro inesperado:', error)

        // Último recurso: função segura
        console.log('🔧 Erro inesperado, tentando função segura...')
        try {
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        } catch (fallbackError) {
            console.error('❌ Falha total - todos os métodos falharam:', fallbackError)
            return false
        }
    }
}

// Função para verificar status do administrador
export const checkAdminStatus = async () => {
    try {
        console.log('🔍 Verificando status do administrador...')

        // Primeiro, diagnosticar problemas de servidor
        const serverInfo = await diagnoseServerError()

        if (serverInfo.hasServerError && !serverInfo.canProceed) {
            console.log('⚠️ Problema de servidor detectado, usando método alternativo...')

            const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)

            if (fallbackCheck.error) {
                console.error('❌ Erro no método alternativo:', fallbackCheck.error)
                return false
            }

            console.log('\n📊 STATUS DO ADMINISTRADOR (Método Alternativo):')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            if (fallbackCheck.exists) {
                console.log('✅ Usuário existe na autenticação')
                console.log('🎭 É Admin:', fallbackCheck.isAdmin ? '✅ Sim' : '❌ Não')

                if (fallbackCheck.needsProfileCreation) {
                    console.log('⚠️ Perfil precisa ser criado na tabela users')
                    return false
                }

                return fallbackCheck.isAdmin
            } else {
                console.log('❌ Administrador não existe')
                return false
            }
        }

        let users = null
        let authUser = null

        // Verificar na tabela users (método tradicional)
        try {
            const { data: userData, error: usersError } = await supabase
                .from('users')
                .select('*')
                .eq('email', ADMIN_EMAIL)
                .single()

            if (usersError && usersError.code !== 'PGRST116') {
                console.error('❌ Erro ao buscar usuário:', usersError)

                // Se é recursão, não tentar fallback que também usa a tabela
                if (usersError.message?.includes('infinite recursion')) {
                    console.log('🔧 Recursão detectada, verificação limitada disponível')
                    return false
                }

                // Tentar método alternativo
                const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)
                return fallbackCheck.exists && fallbackCheck.isAdmin
            }

            users = userData
        } catch (dbError) {
            console.error('❌ Erro de banco ao buscar usuário:', dbError)

            // Se é recursão, não tentar fallback
            if (dbError instanceof Error && dbError.message?.includes('infinite recursion')) {
                console.log('🔧 Recursão detectada, verificação limitada disponível')
                return false
            }

            // Tentar método alternativo
            const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)
            return fallbackCheck.exists && fallbackCheck.isAdmin
        }

        // Verificar na auth.users
        try {
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

            if (authError) {
                console.error('❌ Erro ao listar usuários de auth:', authError)

                // Tentar método alternativo
                const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)
                return fallbackCheck.exists && fallbackCheck.isAdmin
            }

            authUser = authUsers.users.find(user => user.email === ADMIN_EMAIL)
        } catch (authError) {
            console.error('❌ Erro ao verificar auth users:', authError)

            // Tentar método alternativo
            const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)
            return fallbackCheck.exists && fallbackCheck.isAdmin
        }

        console.log('\n📊 STATUS DO ADMINISTRADOR:')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        if (authUser) {
            console.log('✅ Usuário existe na autenticação')
            console.log('📧 Email:', authUser.email)
            console.log('🆔 ID:', authUser.id)
            console.log('📅 Criado em:', new Date(authUser.created_at).toLocaleString('pt-BR'))
            console.log('✉️  Email confirmado:', authUser.email_confirmed_at ? '✅ Sim' : '❌ Não')
        } else {
            console.log('❌ Usuário NÃO existe na autenticação')
        }

        if (users) {
            console.log('✅ Perfil existe na tabela users')
            console.log('👤 Nome:', users.full_name)
            console.log('🎭 Role:', users.role)
            console.log('🏃 Primeiro login:', users.is_first_login ? '⏳ Pendente' : '✅ Concluído')
            console.log('💼 Ativo:', users.is_active ? '✅ Sim' : '❌ Não')
        } else {
            console.log('❌ Perfil NÃO existe na tabela users')
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        // Verificar se precisa corrigir
        if (authUser && !users) {
            console.log('🔧 Usuário existe na auth mas não tem perfil. Execute setupInitialAdmin() para corrigir.')
            return false
        }

        if (!authUser && !users) {
            console.log('🔧 Administrador não existe. Execute setupInitialAdmin() para criar.')
            return false
        }

        if (authUser && users && users.role === 'admin') {
            console.log('✅ Administrador configurado corretamente!')
            return true
        }

        return false

    } catch (error) {
        console.error('❌ Erro ao verificar status:', error)

        // Tentar método alternativo em caso de erro (exceto recursão)
        try {
            if (error instanceof Error && error.message?.includes('infinite recursion')) {
                console.log('🔧 Recursão detectada, não é possível verificar status completamente')
                return false
            }

            const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)
            return fallbackCheck.exists && fallbackCheck.isAdmin
        } catch (fallbackError) {
            console.error('❌ Falha total na verificação:', fallbackError)
            return false
        }
    }
}

// Função para reset do administrador (usar com cuidado)
export const resetAdmin = async () => {
    try {
        console.log('⚠️  RESETANDO administrador...')

        // Remover da tabela users
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('email', ADMIN_EMAIL)

        if (deleteError) {
            console.error('❌ Erro ao remover perfil:', deleteError)
        } else {
            console.log('✅ Perfil removido')
        }

        // Remover da auth (requer privilégios admin)
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

        if (!authError) {
            const authUser = authUsers.users.find(user => user.email === ADMIN_EMAIL)
            if (authUser) {
                const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id)
                if (deleteAuthError) {
                    console.error('❌ Erro ao remover usuário da auth:', deleteAuthError)
                } else {
                    console.log('✅ Usuário removido da auth')
                }
            }
        }

        console.log('✅ Reset concluído. Execute setupInitialAdmin() para recriar.')

    } catch (error) {
        console.error('❌ Erro no reset:', error)
    }
}

// Se executado diretamente
if (typeof window !== 'undefined' && window.location) {
    // Browser environment - adicionar funções ao window para debug
    (window as typeof window & { adminUtils?: { setup: () => Promise<boolean>; check: () => Promise<boolean | undefined>; reset: () => Promise<void> } }).adminUtils = {
        setup: setupInitialAdmin,
        check: checkAdminStatus,
        reset: resetAdmin
    }

    console.log('🛠️  Admin Utils carregados!')
    console.log('Use: adminUtils.setup(), adminUtils.check(), ou adminUtils.reset()')
}
