import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface DiagnosticStep {
    name: string
    status: 'pending' | 'success' | 'error' | 'warning'
    message: string
    details?: string
}

export const AuthDiagnostic: React.FC = () => {
    const { user, session, loading } = useAuth()
    const [steps, setSteps] = useState<DiagnosticStep[]>([])
    const [running, setRunning] = useState(false)

    const addStep = (step: DiagnosticStep) => {
        setSteps(prev => [...prev, step])
    }

    const runDiagnostic = async () => {
        setRunning(true)
        setSteps([])

        // Passo 1: Verificar contexto de autenticação
        addStep({
            name: 'Contexto de Autenticação',
            status: user ? 'success' : 'error',
            message: user ? `Usuário carregado: ${user.email}` : 'Nenhum usuário no contexto',
            details: user ? `Role: ${user.role}, ID: ${user.id}` : 'Verifique se o AuthProvider está funcionando'
        })

        // Passo 2: Verificar sessão Supabase
        try {
            const { data: { session: currentSession }, error } = await supabase.auth.getSession()

            addStep({
                name: 'Sessão Supabase',
                status: currentSession ? 'success' : 'error',
                message: currentSession ? `Sessão ativa: ${currentSession.user.email}` : 'Nenhuma sessão ativa',
                details: error ? `Erro: ${error.message}` : currentSession ? `Token válido até: ${new Date(currentSession.expires_at! * 1000).toLocaleString()}` : 'Usuário não autenticado no Supabase'
            })

            // Passo 3: Verificar perfil na base de dados
            if (currentSession?.user?.id) {
                try {
                    const { data: profile, error: profileError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', currentSession.user.id)
                        .single()

                    addStep({
                        name: 'Perfil na Base de Dados',
                        status: profile ? 'success' : 'error',
                        message: profile ? `Perfil encontrado: ${profile.full_name}` : 'Perfil não encontrado',
                        details: profileError ? `Erro: ${profileError.message}` : profile ? `Role: ${profile.role}, Ativo: ${profile.is_active}` : 'Perfil pode estar corrompido ou não existir'
                    })

                    // Passo 4: Verificar permissões admin e RLS
                    if (profile?.role === 'admin') {
                        try {
                            const { data: adminTest, error: adminError } = await supabase
                                .from('users')
                                .select('id')
                                .limit(1)

                            addStep({
                                name: 'Permissões de Administrador',
                                status: adminTest ? 'success' : 'error',
                                message: adminTest ? 'Admin pode acessar dados' : 'Admin sem permissões',
                                details: adminError ? `Erro RLS: ${adminError.message}` : 'Políticas RLS funcionando corretamente'
                            })
                        } catch (adminErr) {
                            const errorMsg = adminErr instanceof Error ? adminErr.message : 'Desconhecido'
                            addStep({
                                name: 'Permissões de Administrador',
                                status: 'error',
                                message: errorMsg.includes('infinite recursion') ? 'RECURSÃO RLS DETECTADA!' : 'Erro ao testar permissões admin',
                                details: errorMsg.includes('infinite recursion') ?
                                    '🔄 Execute fix_rls_policies_final.sql para corrigir' :
                                    `Erro: ${errorMsg}`
                            })
                        }
                    }

                } catch (profileErr) {
                    addStep({
                        name: 'Perfil na Base de Dados',
                        status: 'error',
                        message: 'Erro ao buscar perfil',
                        details: `Erro: ${profileErr instanceof Error ? profileErr.message : 'Desconhecido'}`
                    })
                }
            }

        } catch (sessionErr) {
            addStep({
                name: 'Sessão Supabase',
                status: 'error',
                message: 'Erro ao verificar sessão',
                details: `Erro: ${sessionErr instanceof Error ? sessionErr.message : 'Desconhecido'}`
            })
        }

        // Passo 5: Verificar estado do loading
        addStep({
            name: 'Estado de Carregamento',
            status: loading ? 'warning' : 'success',
            message: loading ? 'Sistema ainda carregando' : 'Carregamento finalizado',
            details: loading ? 'Se continuar carregando, pode haver um problema no fetchUserProfile' : 'Estado normal'
        })

        // Passo 6: Verificar localStorage
        const savedAuth = localStorage.getItem('supabase.auth.token')
        addStep({
            name: 'Armazenamento Local',
            status: savedAuth ? 'success' : 'warning',
            message: savedAuth ? 'Token salvo no localStorage' : 'Nenhum token no localStorage',
            details: savedAuth ? 'Autenticação persistida' : 'Usuário precisará fazer login novamente'
        })

        setRunning(false)
    }

    useEffect(() => {
        runDiagnostic()
    }, []) // eslint-disable-line

    const getStatusIcon = (status: DiagnosticStep['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />
            default:
                return <div className="w-5 h-5 rounded-full border-2 border-gray-300 animate-pulse" />
        }
    }

    const getStatusColor = (status: DiagnosticStep['status']) => {
        switch (status) {
            case 'success':
                return 'border-green-200 bg-green-50'
            case 'error':
                return 'border-red-200 bg-red-50'
            case 'warning':
                return 'border-yellow-200 bg-yellow-50'
            default:
                return 'border-gray-200 bg-gray-50'
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">🔧 Diagnóstico de Autenticação</h2>
                            <p className="text-gray-600 mt-2">
                                Verificando problemas de login e autenticação
                            </p>
                        </div>
                        <button
                            onClick={runDiagnostic}
                            disabled={running}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />
                            {running ? 'Verificando...' : 'Verificar Novamente'}
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded-lg border ${getStatusColor(step.status)}`}
                            >
                                <div className="flex items-start space-x-3">
                                    {getStatusIcon(step.status)}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-gray-900">
                                            {step.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {step.message}
                                        </p>
                                        {step.details && (
                                            <p className="text-xs text-gray-500 mt-2 font-mono bg-gray-100 p-2 rounded">
                                                {step.details}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {running && (
                            <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="text-gray-600 mt-2">Executando diagnóstico...</p>
                            </div>
                        )}
                    </div>

                    {steps.length > 0 && !running && (
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Dicas de Solução:</h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• <strong>Se RECURSÃO RLS detectada:</strong> Execute fix_rls_policies_final.sql no Supabase</li>
                                <li>• Se a sessão Supabase falhar: Verifique as configurações do Supabase</li>
                                <li>• Se o perfil não for encontrado: Execute o SQL_PARA_SUPABASE.sql</li>
                                <li>• Se admin sem permissões: Corrija as políticas RLS no Supabase</li>
                                <li>• Se continuar carregando: Pode haver recursão infinita no AuthProvider</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Resumo do Estado Atual */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">📊 Estado Atual do Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white p-3 rounded border">
                        <strong>Usuário:</strong><br />
                        {user ? `${user.email} (${user.role})` : 'Não logado'}
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <strong>Sessão:</strong><br />
                        {session ? 'Ativa' : 'Inativa'}
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <strong>Loading:</strong><br />
                        {loading ? 'Sim (Problema?)' : 'Não'}
                    </div>
                </div>
            </div>
        </div>
    )
}
