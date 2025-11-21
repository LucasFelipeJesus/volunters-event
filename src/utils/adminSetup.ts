import { supabase } from '../lib/supabase'
import { authService } from '../lib/services'
import logger from '../lib/logger'
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
        logger.info('Configurando administrador inicial...')

        // Primeiro, diagnosticar se há problemas de servidor
        const serverInfo = await diagnoseServerError()

        if (serverInfo.hasServerError) {
            logger.warn('Problema de servidor detectado:', serverInfo.errorType)
            logger.info('Sugestões:')
            serverInfo.suggestions.forEach(suggestion => {
                logger.info(`   - ${suggestion}`)
            })

            // Se for problema de recursão, usar função segura imediatamente
            if (serverInfo.errorType === 'recursion') {
                logger.info('Recursão RLS detectada, usando função segura...')

                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

                if (safeResult.success) {
                    logger.info('Administrador criado com função segura!')
                    logger.info('Email:', ADMIN_EMAIL)
                    logger.info('Senha:', ADMIN_PASSWORD)
                    logger.info('IMPORTANTE: Altere a senha no primeiro login!')
                    return true
                } else {
                    logger.error('Erro na função segura:', safeResult.error)
                    return false
                }
            }

            if (!serverInfo.canProceed) {
                logger.info('Tentando função segura como alternativa...')

                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

                if (safeResult.success) {
                    logger.info('Administrador criado com função segura!')
                    logger.info('Email:', ADMIN_EMAIL)
                    logger.info('Senha:', ADMIN_PASSWORD)
                    logger.info('IMPORTANTE: Altere a senha no primeiro login!')
                    return true
                } else {
                    logger.error('Erro na função segura:', safeResult.error)
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
                logger.error('Erro ao verificar administradores existentes:', checkError)

                // Se é erro de recursão, usar função segura
                if (checkError.message?.includes('infinite recursion')) {
                    logger.info('Recursão detectada, usando função segura...')
                    const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                    return safeResult.success
                }

                // Outros erros, tentar método alternativo
                console.log('🔧 Erro na verificação, tentando método alternativo...')
                const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)

                if (fallbackCheck.exists && fallbackCheck.isAdmin) {
                    logger.info('Administrador já existe (verificado via método alternativo)')
                    return true
                } else {
                    // Usar função segura
                    const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                    return safeResult.success
                }
            }

            if (existingUsers && existingUsers.length > 0) {
                logger.info('Administrador já existe:', existingUsers[0].email)
                return true
            }
        } catch (dbError) {
            logger.error('Erro de banco ao verificar admin existente:', dbError)

            // Se é erro de recursão, usar função segura
            if (dbError instanceof Error && dbError.message?.includes('infinite recursion')) {
                logger.info('Recursão detectada no catch, usando função segura...')
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
                logger.error('Erro ao listar usuários de autenticação:', authError)

                // Usar função segura
                const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
                return safeResult.success
            }

            const existingAuthUser = authUsers.users.find(user => user.email === ADMIN_EMAIL)

            if (existingAuthUser) {
                logger.info('Usuário encontrado na auth, configurando perfil com função segura...')

                // Usar função segura diretamente
                const { data: result, error: functionError } = await supabase
                    .rpc('create_admin_profile_safe', {
                        admin_user_id: existingAuthUser.id,
                        admin_email: ADMIN_EMAIL,
                        admin_name: ADMIN_NAME
                    })

                if (functionError) {
                    logger.error('Erro ao chamar função segura:', functionError)
                    return false
                }

                const functionResult = result as { success: boolean; message?: string; error?: string }

                if (functionResult.success) {
                    logger.info('Perfil de administrador configurado com função segura!')
                    return true
                } else {
                    logger.error('Função segura retornou erro:', functionResult.error)
                    return false
                }
            }
        } catch (authError) {
            logger.error('Erro ao verificar auth users:', authError)

            // Usar função segura
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        }

        // Criar novo usuário administrador
        logger.info('Criando novo usuário administrador...')

        try {
            // Tentar primeiro com função segura
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

            if (safeResult.success) {
                logger.info('Administrador criado com função segura!')
                logger.info('Email:', ADMIN_EMAIL)
                logger.info('Senha:', ADMIN_PASSWORD)
                logger.info('IMPORTANTE: Altere a senha no primeiro login!')
                return true
            } else {
                logger.warn('Função segura falhou, tentando método tradicional...')

                // Fallback para método tradicional
                const adminId = await authService.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

                if (adminId) {
                    logger.info('Administrador criado com método tradicional!')
                    logger.info('Email:', ADMIN_EMAIL)
                    logger.info('Senha:', ADMIN_PASSWORD)
                    logger.info('IMPORTANTE: Altere a senha no primeiro login!')
                    return true
                } else {
                    logger.error('Ambos os métodos falharam')
                    return false
                }
            }
        } catch (createError) {
            logger.error('Erro ao criar admin:', createError)

            // Último recurso: função segura
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        }

    } catch (error) {
        logger.error('Erro inesperado:', error)

        // Último recurso: função segura
        logger.info('Erro inesperado, tentando função segura...')
        try {
            const safeResult = await createAdminWithSafeFunction(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
            return safeResult.success
        } catch (fallbackError) {
            logger.error('Falha total - todos os métodos falharam:', fallbackError)
            return false
        }
    }
}

// Função para verificar status do administrador
export const checkAdminStatus = async () => {
    try {
        logger.info('Verificando status do administrador...')

        // Primeiro, diagnosticar problemas de servidor
        const serverInfo = await diagnoseServerError()

        if (serverInfo.hasServerError && !serverInfo.canProceed) {
            logger.warn('Problema de servidor detectado, usando método alternativo...')

            const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)

            if (fallbackCheck.error) {
                logger.error('Erro no método alternativo:', fallbackCheck.error)
                return false
            }

            logger.info('\nSTATUS DO ADMINISTRADOR (Método Alternativo):')
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            if (fallbackCheck.exists) {
                logger.info('Usuário existe na autenticação')
                logger.info('É Admin:', fallbackCheck.isAdmin ? 'Sim' : 'Não')

                if (fallbackCheck.needsProfileCreation) {
                    logger.warn('Perfil precisa ser criado na tabela users')
                    return false
                }

                return fallbackCheck.isAdmin
            } else {
                logger.info('Administrador não existe')
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

        logger.info('\nSTATUS DO ADMINISTRADOR:')
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        if (authUser) {
            logger.info('Usuário existe na autenticação')
            logger.info('Email:', authUser.email)
            logger.info('ID:', authUser.id)
            logger.info('Criado em:', new Date(authUser.created_at).toLocaleString('pt-BR'))
            logger.info('Email confirmado:', authUser.email_confirmed_at ? 'Sim' : 'Não')
        } else {
            console.log('❌ Usuário NÃO existe na autenticação')
        }

        if (users) {
            logger.info('Perfil existe na tabela users')
            logger.info('Nome:', users.full_name)
            logger.info('Role:', users.role)
            logger.info('Primeiro login:', users.is_first_login ? 'Pendente' : 'Concluído')
            logger.info('Ativo:', users.is_active ? 'Sim' : 'Não')
        } else {
            console.log('❌ Perfil NÃO existe na tabela users')
        }

        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        // Verificar se precisa corrigir
        if (authUser && !users) {
            logger.info('Usuário existe na auth mas não tem perfil. Execute setupInitialAdmin() para corrigir.')
            return false
        }

        if (!authUser && !users) {
            logger.info('Administrador não existe. Execute setupInitialAdmin() para criar.')
            return false
        }

        if (authUser && users && users.role === 'admin') {
            logger.info('Administrador configurado corretamente!')
            return true
        }

        return false

    } catch (error) {
        logger.error('Erro ao verificar status:', error)

        // Tentar método alternativo em caso de erro (exceto recursão)
        try {
            if (error instanceof Error && error.message?.includes('infinite recursion')) {
                logger.info('Recursão detectada, não é possível verificar status completamente')
                return false
            }

            const fallbackCheck = await checkAdminExistsWithFallback(ADMIN_EMAIL)
            return fallbackCheck.exists && fallbackCheck.isAdmin
        } catch (fallbackError) {
            logger.error('Falha total na verificação:', fallbackError)
            return false
        }
    }
}

// Função para reset do administrador (usar com cuidado)
export const resetAdmin = async () => {
    try {
        logger.warn('RESETANDO administrador...')

        // Remover da tabela users
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('email', ADMIN_EMAIL)

        if (deleteError) {
            logger.error('Erro ao remover perfil:', deleteError)
        } else {
            logger.info('Perfil removido')
        }

        // Remover da auth (requer privilégios admin)
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

        if (!authError) {
            const authUser = authUsers.users.find(user => user.email === ADMIN_EMAIL)
            if (authUser) {
                const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id)
                if (deleteAuthError) {
                    logger.error('Erro ao remover usuário da auth:', deleteAuthError)
                } else {
                    logger.info('Usuário removido da auth')
                }
            }
        }

        logger.info('Reset concluído. Execute setupInitialAdmin() para recriar.')

    } catch (error) {
        logger.error('Erro no reset:', error)
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

    logger.info('Admin Utils carregados!')
    logger.info('Use: adminUtils.setup(), adminUtils.check(), ou adminUtils.reset()')
}
