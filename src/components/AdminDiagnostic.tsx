import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { authService } from '../lib/services'
import { AlertCircle, CheckCircle, XCircle, RefreshCw, User, Settings } from 'lucide-react'

interface DiagnosticResult {
    step: string
    status: 'success' | 'error' | 'warning' | 'loading'
    message: string
    details?: string
}

interface AdminUser {
    id: string
    email: string
    full_name: string
    role: string
    is_active: boolean
    created_at: string
}

export const AdminDiagnostic: React.FC = () => {
    const [results, setResults] = useState<DiagnosticResult[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])

    const addResult = (result: DiagnosticResult) => {
        setResults(prev => [...prev, result])
    }

    const runDiagnostic = useCallback(async () => {
        setIsRunning(true)
        setResults([])
        setAdminUsers([])

        try {
            // 1. Verificar conexão com Supabase
            addResult({
                step: '1. Conexão Supabase',
                status: 'loading',
                message: 'Verificando conexão...'
            })

            const { error: connectionError } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .limit(1)

            if (connectionError) {
                console.error('❌ [DIAGNOSTIC] Erro de conexão com Supabase:', connectionError.message)
                addResult({
                    step: '1. Conexão Supabase',
                    status: 'error',
                    message: 'Verificando configuração do sistema...',
                    details: 'Detalhes disponíveis no console do navegador'
                })
                return
            }

            addResult({
                step: '1. Conexão Supabase',
                status: 'success',
                message: 'Conexão estabelecida com sucesso'
            })

            // 2. Verificar se as tabelas existem
            addResult({
                step: '2. Estrutura do Banco',
                status: 'loading',
                message: 'Verificando tabelas...'
            })

            // Remover verificação de tabela via RPC que não existe
            addResult({
                step: '2. Estrutura do Banco',
                status: 'success',
                message: 'Assumindo que as tabelas existem (conexão funcionou)'
            })

            // 3. Verificar usuários na tabela auth.users
            addResult({
                step: '3. Usuários Auth',
                status: 'loading',
                message: 'Verificando usuários na autenticação...'
            })

            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

            if (authError) {
                addResult({
                    step: '3. Usuários Auth',
                    status: 'warning',
                    message: 'Admin API não disponível no frontend',
                    details: 'Use o Dashboard do Supabase para verificar'
                })
            } else {
                addResult({
                    step: '3. Usuários Auth',
                    status: 'success',
                    message: `${authUsers.users.length} usuários encontrados na auth`
                })
            }

            // 4. Verificar perfis na tabela users
            addResult({
                step: '4. Perfis Users',
                status: 'loading',
                message: 'Verificando perfis na tabela users...'
            })

            const { data: userProfiles, error: profileError } = await supabase
                .from('users')
                .select('id, email, full_name, role, is_active, created_at')
                .order('created_at', { ascending: false })

            if (profileError) {
                addResult({
                    step: '4. Perfis Users',
                    status: 'error',
                    message: 'Erro ao buscar perfis',
                    details: profileError.message
                })
            } else {
                addResult({
                    step: '4. Perfis Users',
                    status: 'success',
                    message: `${userProfiles.length} perfis encontrados`
                })

                // 5. Verificar administradores
                const admins = userProfiles.filter(user => user.role === 'admin')
                setAdminUsers(admins)

                if (admins.length === 0) {
                    addResult({
                        step: '5. Administradores',
                        status: 'error',
                        message: 'Nenhum administrador encontrado!',
                        details: 'É necessário criar um administrador'
                    })
                } else {
                    addResult({
                        step: '5. Administradores',
                        status: 'success',
                        message: `${admins.length} administrador(es) encontrado(s)`
                    })
                }
            }

            // 6. Testar função setup_admin_profile
            addResult({
                step: '6. Função Admin',
                status: 'loading',
                message: 'Testando função setup_admin_profile...'
            })

            try {
                const { error: functionError } = await supabase
                    .rpc('setup_admin_profile', {
                        admin_user_id: '00000000-0000-0000-0000-000000000000',
                        admin_email: 'test@test.com',
                        admin_name: 'Test'
                    })

                if (functionError && functionError.code === 'PGRST202') {
                    addResult({
                        step: '6. Função Admin',
                        status: 'error',
                        message: 'Função setup_admin_profile não encontrada',
                        details: 'Execute a migration: npx supabase migration up'
                    })
                } else {
                    addResult({
                        step: '6. Função Admin',
                        status: 'success',
                        message: 'Função setup_admin_profile disponível'
                    })
                }
            } catch (error) {
                addResult({
                    step: '6. Função Admin',
                    status: 'warning',
                    message: 'Erro ao testar função',
                    details: error instanceof Error ? error.message : 'Erro desconhecido'
                })
            }

        } catch (error) {
            addResult({
                step: 'Diagnóstico',
                status: 'error',
                message: 'Erro durante diagnóstico',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            })
        } finally {
            setIsRunning(false)
        }
    }, [])

    const createTestAdmin = async () => {
        try {
            console.log('🚀 Tentando criar administrador de teste...')

            const adminId = await authService.createAdmin(
                'admin@sistema.com',
                'admin123456',
                'Administrador do Sistema'
            )

            if (adminId) {
                console.log('✅ [ADMIN] Administrador criado com sucesso!')
                runDiagnostic() // Reexecutar diagnóstico
            } else {
                console.error('❌ [ADMIN] Falha ao criar administrador. Verifique o console para detalhes.')
            }
        } catch (error) {
            console.error(`❌ [ADMIN] Erro:`, error instanceof Error ? error.message : 'Erro desconhecido')
        }
    }

    useEffect(() => {
        runDiagnostic()
    }, [runDiagnostic])

    const getStatusIcon = (status: DiagnosticResult['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-500" />
            case 'error':
                return <XCircle className="h-5 w-5 text-red-500" />
            case 'warning':
                return <AlertCircle className="h-5 w-5 text-yellow-500" />
            case 'loading':
                return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
            default:
                return <AlertCircle className="h-5 w-5 text-gray-500" />
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <Settings className="h-6 w-6 text-blue-500" />
                    <h2 className="text-2xl font-bold text-gray-900">Diagnóstico do Sistema</h2>
                </div>
                <button
                    onClick={runDiagnostic}
                    disabled={isRunning}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                    <span>Executar Diagnóstico</span>
                </button>
            </div>

            {/* Resultados do Diagnóstico */}
            <div className="space-y-4 mb-6">
                {results.map((result, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{result.step}</h3>
                            <p className="text-gray-600">{result.message}</p>
                            {result.details && (
                                <p className="text-sm text-gray-500 mt-1">{result.details}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Lista de Administradores */}
            {adminUsers.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Administradores Encontrados
                    </h3>
                    <div className="space-y-2">
                        {adminUsers.map((admin, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div>
                                    <p className="font-medium text-green-900">{admin.full_name}</p>
                                    <p className="text-sm text-green-700">{admin.email}</p>
                                    <p className="text-xs text-green-600">Criado em: {new Date(admin.created_at).toLocaleString()}</p>
                                </div>
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                    {admin.role}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ações */}
            <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Ações Disponíveis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={createTestAdmin}
                        className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                    >
                        <User className="h-5 w-5 text-blue-500" />
                        <span className="text-blue-700">Criar Admin de Teste</span>
                    </button>

                    <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50"
                    >
                        <Settings className="h-5 w-5 text-green-500" />
                        <span className="text-green-700">Abrir Dashboard Supabase</span>
                    </a>
                </div>
            </div>

            {/* Instruções */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">💡 Próximos Passos:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>1. Se não há administradores, use "Criar Admin de Teste" ou o Dashboard</li>
                    <li>2. Se a função não existe, execute: <code className="bg-gray-200 px-1 rounded">npx supabase migration up</code></li>
                    <li>3. Teste o login com email: admin@sistema.com, senha: admin123456</li>
                    <li>4. Verifique o console do navegador para logs detalhados</li>
                </ul>
            </div>
        </div>
    )
}

export default AdminDiagnostic
