import React, { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase, User } from '../lib/supabase'
import { userService, authService } from '../lib/services'
import { logSupabaseError } from '../lib/errorHandling'
import { diagnoseUserProfile, createMissingUserProfile } from '../utils/profileDiagnostic'
import { AuthContext, AuthContextType } from './AuthContext'

// ✅ FAST REFRESH: Somente default export do componente
export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [isFirstLogin, setIsFirstLogin] = useState(false)

    useEffect(() => {
        // Buscar sessão inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('🔍 [INIT] Verificando sessão inicial:', session?.user?.email || 'Nenhuma sessão')
            setSession(session)
            if (session?.user) {
                fetchUserProfile(session.user.id)
            } else {
                console.log('ℹ️ [INIT] Nenhuma sessão ativa, definindo loading como false')
                setLoading(false)
            }
        })

        // Escutar mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔄 [AUTH_STATE] Mudança de autenticação:', {
                    event,
                    email: session?.user?.email || 'Nenhuma sessão',
                    userId: session?.user?.id,
                    hasSession: !!session
                })

                setSession(session)

                if (session?.user) {
                    console.log('👤 [AUTH_STATE] Usuário detectado, iniciando fetchUserProfile...')
                    await fetchUserProfile(session.user.id)
                } else {
                    console.log('🚪 [AUTH_STATE] Nenhum usuário, limpando estado...')
                    setUser(null)
                    setIsFirstLogin(false)
                    setLoading(false)
                }
            }
        )

        // Expor funções de diagnóstico globalmente para debug
        if (typeof window !== 'undefined') {
            // @ts-expect-error - Adicionando propriedades de debug ao window
            window.debugAuth = {
                diagnoseProfile: diagnoseUserProfile,
                createProfile: createMissingUserProfile,
                getCurrentUser: () => ({ user, session, loading, isFirstLogin }),
                supabase: supabase
            }
            console.log('🔧 [DEBUG] Funções de debug disponíveis em window.debugAuth')
        }

        return () => subscription.unsubscribe()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const fetchUserProfile = async (userId: string) => {
        console.log('📋 [FETCH_PROFILE] INÍCIO - Buscando perfil do usuário:', userId)

        try {
            // Definir timeout para evitar travamento
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout ao buscar perfil')), 10000) // 10 segundos
            })

            // Fazer a busca com timeout
            const profilePromise = userService.getProfile(userId)

            console.log('⏰ [FETCH_PROFILE] Aguardando resposta do getProfile...')
            const profile = await Promise.race([profilePromise, timeoutPromise]) as User | null

            console.log('🔍 [FETCH_PROFILE] Resultado da busca:', {
                found: !!profile,
                email: profile?.email,
                role: profile?.role,
                id: profile?.id
            })

            if (profile) {
                console.log('✅ [FETCH_PROFILE] Perfil encontrado')

                // Bloquear usuários desativados imediatamente
                if ((profile as any).is_active === false) {
                    console.warn('⛔ [FETCH_PROFILE] Usuário inativo detectado - forçando logout:', userId)
                    try {
                        alert('Sua conta foi desativada. Se achar que é um erro, entre em contato com um administrador.')
                    } catch (e) {
                        // Ignore em ambientes sem alert
                    }
                    // Fazer logout para invalidar sessão local
                    await signOut()
                    setLoading(false)
                    return
                }

                console.log('✅ [FETCH_PROFILE] Definindo usuário ativo...')
                setUser(profile)

                try {
                    console.log('🔍 [FETCH_PROFILE] Verificando primeiro login...')
                    const firstLogin = await authService.isFirstLogin(userId)
                    console.log('📝 [FETCH_PROFILE] Primeiro login:', firstLogin)
                    setIsFirstLogin(firstLogin)
                } catch (firstLoginError) {
                    console.error('⚠️ [FETCH_PROFILE] Erro ao verificar primeiro login, assumindo false:', firstLoginError)
                    setIsFirstLogin(false)
                }
            } else {
                console.log('⚠️ [FETCH_PROFILE] Perfil não encontrado para o usuário:', userId)
                console.log('🔧 [FETCH_PROFILE] Executando diagnóstico...')

                // Executar diagnóstico para entender o problema
                await diagnoseUserProfile(userId)

                // Tentar criar perfil se for um usuário autenticado sem perfil
                const { data: session } = await supabase.auth.getSession()
                if (session.session?.user?.email) {
                    console.log('🛠️ [FETCH_PROFILE] Tentando criar perfil faltante...')
                    const newProfile = await createMissingUserProfile(userId, session.session.user.email)

                    if (newProfile) {
                        console.log('✅ [FETCH_PROFILE] Perfil criado automaticamente')
                        setUser(newProfile)
                        setIsFirstLogin(true)
                    }
                }
            }
        } catch (error) {
            console.error('❌ [FETCH_PROFILE] Erro ao buscar perfil:', error)

            // Verificar se é erro de timeout RLS
            if (error instanceof Error && (
                error.message.includes('Timeout RLS') ||
                error.message === 'Timeout ao buscar perfil'
            )) {
                console.error('🔄 [FETCH_PROFILE] TIMEOUT RLS DETECTADO!')
                console.error('💡 [FETCH_PROFILE] Problema nas políticas RLS travando a query')
                console.error('🛠️ [FETCH_PROFILE] Execute fix_profile_creation.sql no Supabase')

                // Mostrar alerta apenas uma vez por sessão
                if (!sessionStorage.getItem('rlsTimeoutShown')) {
                    sessionStorage.setItem('rlsTimeoutShown', 'true')
                    alert('🚨 Timeout RLS detectado!\n\n' +
                        '💡 As políticas RLS estão travando a consulta.\n' +
                        '🛠️ Execute fix_profile_creation.sql no Supabase.\n' +
                        '🔄 Depois recarregue a página.')
                }
            } else if (error instanceof Error && error.message.includes('infinite recursion detected')) {
                console.error('🔄 [FETCH_PROFILE] ERRO DE RECURSÃO RLS DETECTADO!')
                console.error('💡 [FETCH_PROFILE] Solução: Execute o SQL fix_profile_creation.sql no Supabase')

                // Não tentar criar perfil quando há erro de RLS
                if (!sessionStorage.getItem('rlsErrorShown')) {
                    sessionStorage.setItem('rlsErrorShown', 'true')
                    alert('❌ Erro crítico de configuração RLS!\n\n💡 Execute fix_profile_creation.sql no Supabase')
                }
            } else {
                console.error('❌ [FETCH_PROFILE] Erro não tratado:', error)

                // Executar diagnóstico para outros erros
                console.log('🔧 [FETCH_PROFILE] Executando diagnóstico...')
                await diagnoseUserProfile(userId)
            }
        } finally {
            console.log('🏁 [FETCH_PROFILE] FIM - Finalizando busca de perfil')
            setLoading(false)
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            console.log('🔑 [LOGIN] Iniciando login para:', email)
            setLoading(true) // Garantir que loading está ativo

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            console.log('🔍 [LOGIN] Resposta do Supabase auth:', {
                hasData: !!data,
                hasUser: !!data?.user,
                hasSession: !!data?.session,
                hasError: !!error,
                userId: data?.user?.id
            })

            if (error) {
                console.error('❌ [LOGIN] Erro no login:', {
                    message: error.message,
                    status: error.status,
                    details: error
                })

                // Log do erro para análise
                try {
                    logSupabaseError(error, 'Login falhou', { email })
                } catch (logError) {
                    console.error('Erro ao fazer log:', logError)
                }

                // Verificar se é erro de email não confirmado e tentar ignorar
                if (error.message.includes('Email not confirmed')) {
                    console.warn('⚠️ [LOGIN] Email não confirmado detectado - tentando bypass...')

                    // Tentar pegar o usuário mesmo com erro de confirmação
                    try {
                        const { data: userData } = await supabase.auth.getUser()
                        if (userData.user && userData.user.email === email) {
                            console.log('✅ [LOGIN] Usuário encontrado via getUser() apesar do erro de confirmação')
                            console.log('🔄 [LOGIN] onAuthStateChange será chamado automaticamente para carregar perfil')
                            return // Sair da função sem erro
                        }
                    } catch (getUserError) {
                        console.warn('⚠️ [LOGIN] getUser() também falhou:', getUserError)
                    }

                    // Se não conseguir bypass, mostrar mensagem amigável
                    throw new Error('Por favor, confirme seu email ou entre em contato com o suporte.')
                }

                // Mensagens específicas para outros tipos de erro
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Email ou senha incorretos. Verifique suas credenciais.')
                } else if (error.message.includes('Too many requests')) {
                    throw new Error('Muitas tentativas de login. Tente novamente em alguns minutos.')
                } else {
                    throw new Error(error.message || 'Erro ao fazer login')
                }
            }

            if (data.user) {
                console.log('✅ [LOGIN] Login realizado com sucesso:', data.user.email)
                console.log('🔄 [LOGIN] onAuthStateChange será chamado automaticamente para carregar perfil')
                // O perfil será carregado automaticamente pelo onAuthStateChange
                // NÃO definir setLoading(false) aqui - deixar para fetchUserProfile
            } else {
                console.error('⚠️ [LOGIN] Login sem erro mas sem usuário - situação inesperada')
                setLoading(false)
            }

        } catch (error) {
            console.error('❌ [LOGIN] Erro durante login:', error)
            setLoading(false) // Garantir que loading é desativado em caso de erro
            throw error
        }
    }

    const signUp = async (email: string, password: string, fullName: string) => {
        try {
            console.log('🔄 [SIGNUP] Iniciando cadastro para:', email)

            // Tentar criar usuário com confirmação automática de email
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    },
                    emailRedirectTo: undefined // Desabilita redirecionamento de email
                }
            })

            if (error) {
                console.error('❌ [SIGNUP] Erro no cadastro:', error.message)
                throw error
            }

            if (!data.user) {
                console.error('❌ [SIGNUP] Usuário não foi criado')
                throw new Error('Erro ao criar usuário')
            }

            console.log('✅ [SIGNUP] Usuário criado:', data.user.id)
            console.log('📧 [SIGNUP] Email confirmado?', data.user.email_confirmed_at ? 'Sim' : 'Não')

            // Aguardar um pouco para garantir que a sessão esteja estabelecida
            await new Promise(resolve => setTimeout(resolve, 500))

            // Criar perfil do usuário na tabela users (sempre criar, independente da confirmação)
            try {
                const profileCreated = await authService.createUserProfile({
                    id: data.user.id,
                    email,
                    full_name: fullName,
                    role: 'volunteer',
                    is_first_login: true,
                    is_active: true
                })

                if (profileCreated) {
                    console.log('✅ [SIGNUP] Perfil criado com sucesso')
                } else {
                    console.warn('⚠️ [SIGNUP] Perfil não foi criado adequadamente')
                }
            } catch (profileError) {
                console.error('❌ [SIGNUP] Erro ao criar perfil:', profileError)
                // Não interromper o processo por erro de perfil
            }

            console.log('✅ [SIGNUP] Processo de cadastro concluído')
            console.log('💡 [SIGNUP] Redirecionando para login...')

            return {
                user: data.user,
                needsConfirmation: !data.user.email_confirmed_at,
                session: data.session
            }

        } catch (error) {
            console.error('❌ [SIGNUP] Erro geral no cadastro:', error)
            throw error
        }
    }

    const signOut = async () => {
        try {
            console.log('🚪 Iniciando logout...')
            const { error } = await supabase.auth.signOut()

            if (error) {
                // Log simplificado para não impactar performance do logout
                console.error('⚠️ Erro durante logout (ignorado):', error.message)
            } else {
                console.log('✅ Logout realizado com sucesso')
            }

            // Limpa o estado local independente de erros do Supabase
            setUser(null)
            setSession(null)
            setIsFirstLogin(false)

            console.log('🧹 Estado local limpo')
        } catch (error) {
            console.error('❌ Erro inesperado durante logout:', error)

            // Mesmo com erro, limpa o estado local para garantir logout
            setUser(null)
            setSession(null)
            setIsFirstLogin(false)

            console.log('🧹 Estado local limpo após erro')
        }
    }

    const updateProfile = async (updates: Partial<User>) => {
        if (!user) throw new Error('Usuário não autenticado')

        const success = await userService.updateProfile(user.id, updates)
        if (!success) throw new Error('Erro ao atualizar perfil')

        // Atualizar estado local
        setUser({ ...user, ...updates })
    }

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
    }

    const promoteUser = async (userId: string): Promise<boolean> => {
        if (!user || user.role !== 'admin') {
            throw new Error('Acesso negado: apenas administradores podem promover usuários')
        }
        return await userService.promoteToCaptain(userId)
    }

    const demoteUser = async (userId: string): Promise<boolean> => {
        if (!user || user.role !== 'admin') {
            throw new Error('Acesso negado: apenas administradores podem demover usuários')
        }
        return await userService.demoteToVolunteer(userId)
    }

    const demoteCaptainsAfterEvent = async (eventId: string): Promise<number> => {
        if (!user || user.role !== 'admin') {
            throw new Error('Acesso negado: apenas administradores podem executar demoção em lote')
        }
        return await userService.demoteCaptainsAfterEvent(eventId)
    }

    const deleteAccount = async (): Promise<boolean> => {
        if (!user) throw new Error('Usuário não autenticado')

        const success = await userService.deleteAccount(user.id)
        if (success) {
            await signOut()
        }
        return success
    }

    const completeFirstLogin = async () => {
        if (!user) throw new Error('Usuário não autenticado')

        const success = await authService.completeFirstLogin(user.id)
        if (success) {
            setIsFirstLogin(false)
        }
    }

    const value: AuthContextType = {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        resetPassword,
        promoteUser,
        demoteUser,
        demoteCaptainsAfterEvent,
        deleteAccount,
        isFirstLogin,
        completeFirstLogin
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
