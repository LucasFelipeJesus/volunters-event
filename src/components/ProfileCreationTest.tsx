import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { createMissingUserProfile } from '../utils/profileDiagnostic'

export const ProfileCreationTest: React.FC = () => {
    const [testing, setTesting] = useState(false)
    const [result, setResult] = useState<string>('')

    const testProfileCreation = async () => {
        setTesting(true)
        setResult('')

        try {
            console.log('🧪 [TEST] Iniciando teste de criação de perfil...')

            // 1. Verificar sessão atual
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError) {
                setResult(`❌ Erro de sessão: ${sessionError.message}`)
                return
            }

            if (!session?.user) {
                setResult('⚠️ Nenhuma sessão ativa. Faça login primeiro.')
                return
            }

            console.log('✅ [TEST] Sessão encontrada:', session.user.email)

            // 2. Verificar se perfil já existe
            const { data: existingProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single()

            if (existingProfile) {
                setResult('✅ Perfil já existe! Login deve estar funcionando.')
                return
            }

            console.log('🔍 [TEST] Perfil não encontrado, erro da consulta:', profileError)

            // 3. Tentar criar perfil
            console.log('🛠️ [TEST] Tentando criar perfil...')
            const newProfile = await createMissingUserProfile(session.user.id, session.user.email!)

            if (newProfile) {
                setResult('✅ Perfil criado com sucesso! Teste o login agora.')
            } else {
                setResult('❌ Falha ao criar perfil. Verifique os logs do console.')
            }

        } catch (error) {
            console.error('❌ [TEST] Erro no teste:', error)
            const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'

            if (errorMsg.includes('infinite recursion')) {
                setResult('🔄 ERRO RLS: Execute fix_profile_creation.sql no Supabase')
            } else {
                setResult(`❌ Erro: ${errorMsg}`)
            }
        } finally {
            setTesting(false)
        }
    }

    const testDirectInsert = async () => {
        setTesting(true)
        setResult('')

        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session?.user) {
                setResult('⚠️ Nenhuma sessão ativa. Faça login primeiro.')
                return
            }

            // Teste direto de inserção
            console.log('🧪 [DIRECT] Teste direto de inserção...')
            const { data, error } = await supabase
                .from('users')
                .insert({
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.email?.split('@')[0] || 'Usuário',
                    role: 'volunteer',
                    is_first_login: true,
                    is_active: true
                })
                .select()
                .single()

            if (error) {
                console.error('❌ [DIRECT] Erro direto:', error)
                setResult(`❌ Erro direto: ${error.message}`)
            } else {
                console.log('✅ [DIRECT] Inserção direta bem-sucedida:', data)
                setResult('✅ Inserção direta funcionou! Login deve estar OK agora.')
            }

        } catch (error) {
            console.error('❌ [DIRECT] Erro inesperado:', error)
            setResult(`❌ Erro inesperado: ${error instanceof Error ? error.message : 'Desconhecido'}`)
        } finally {
            setTesting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    🧪 Teste de Criação de Perfil
                </h2>

                <p className="text-gray-600 mb-6">
                    Este teste verifica se o problema de login está relacionado à criação de perfil.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={testProfileCreation}
                        disabled={testing}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {testing ? '🔄 Testando...' : '🧪 Teste Completo de Perfil'}
                    </button>

                    <button
                        onClick={testDirectInsert}
                        disabled={testing}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {testing ? '🔄 Testando...' : '⚡ Teste Direto de Inserção'}
                    </button>

                    {result && (
                        <div className={`p-4 rounded-md ${result.includes('✅') ? 'bg-green-50 text-green-800' :
                                result.includes('⚠️') ? 'bg-yellow-50 text-yellow-800' :
                                    'bg-red-50 text-red-800'
                            }`}>
                            <p className="font-mono text-sm">{result}</p>
                        </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="font-medium text-gray-900 mb-2">💡 Instruções:</h3>
                        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                            <li>Primeiro, faça login normalmente (mesmo que falhe)</li>
                            <li>Volte aqui e execute o "Teste Completo"</li>
                            <li>Se falhar, execute fix_profile_creation.sql no Supabase</li>
                            <li>Tente o "Teste Direto" se o primeiro falhar</li>
                            <li>Recarregue e teste o login novamente</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    )
}
