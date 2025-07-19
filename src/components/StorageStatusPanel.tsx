import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertCircle, CheckCircle, RefreshCw, Settings, Wrench } from 'lucide-react'

interface BucketStatus {
    id: string
    name: string
    exists: boolean
    accessible: boolean
    error?: string
}

export const StorageStatusPanel: React.FC = () => {
    const [buckets, setBuckets] = useState<BucketStatus[]>([])
    const [loading, setLoading] = useState(false)
    const [setupRunning, setSetupRunning] = useState(false)
    const [lastCheck, setLastCheck] = useState<Date | null>(null)

    const requiredBuckets = ['profile-images', 'event-images']

    const checkBucketsStatus = async () => {
        setLoading(true)
        try {
            const { data: existingBuckets, error } = await supabase.storage.listBuckets()

            const status: BucketStatus[] = requiredBuckets.map(bucketId => {
                const exists = existingBuckets?.some(b => b.id === bucketId) || false
                return {
                    id: bucketId,
                    name: bucketId,
                    exists,
                    accessible: exists, // Simplificado por enquanto
                    error: error?.message
                }
            })

            setBuckets(status)
            setLastCheck(new Date())
        } catch (error) {
            console.error('Erro ao verificar buckets:', error)
            setBuckets(requiredBuckets.map(id => ({
                id,
                name: id,
                exists: false,
                accessible: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            })))
        } finally {
            setLoading(false)
        }
    }

    const runStorageSetup = async () => {
        setSetupRunning(true)
        try {
            console.log('Executando setup automático de storage...')

            const { data, error } = await supabase.rpc('setup_storage_buckets')

            if (error) {
                console.error('Erro no setup:', error)
                alert(`Erro no setup automático: ${error.message}. Tente executar o script SQL manualmente.`)
            } else {
                console.log('Setup concluído:', data)
                alert('Setup automático executado! Verificando status...')
                await checkBucketsStatus()
            }
        } catch (error) {
            console.error('Erro inesperado no setup:', error)
            alert('Erro inesperado no setup. Verifique o console e tente executar o script SQL manualmente.')
        } finally {
            setSetupRunning(false)
        }
    }

    useEffect(() => {
        checkBucketsStatus()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const allBucketsReady = buckets.every(b => b.exists && b.accessible)
    const hasErrors = buckets.some(b => b.error)

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Settings className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Status do Storage</h3>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={checkBucketsStatus}
                        disabled={loading}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                        title="Verificar status"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>Verificar</span>
                    </button>
                    {!allBucketsReady && (
                        <button
                            onClick={runStorageSetup}
                            disabled={setupRunning}
                            className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            title="Executar setup automático"
                        >
                            <Wrench className={`w-4 h-4 ${setupRunning ? 'animate-pulse' : ''}`} />
                            <span>{setupRunning ? 'Configurando...' : 'Auto Setup'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Status geral */}
            <div className={`mb-4 p-3 rounded-lg border ${allBucketsReady
                ? 'bg-green-50 border-green-200'
                : hasErrors
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                <div className="flex items-center space-x-2">
                    {allBucketsReady ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                    <span className={`font-medium ${allBucketsReady ? 'text-green-800' : 'text-yellow-800'
                        }`}>
                        {allBucketsReady
                            ? 'Storage configurado corretamente'
                            : 'Storage requer configuração'
                        }
                    </span>
                </div>
            </div>

            {/* Lista de buckets */}
            <div className="space-y-2">
                {buckets.map(bucket => (
                    <div
                        key={bucket.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                        <div className="flex items-center space-x-3">
                            {bucket.exists ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                            <div>
                                <span className="font-medium text-gray-900">{bucket.name}</span>
                                <div className="text-sm text-gray-600">
                                    {bucket.exists ? 'Configurado' : 'Não encontrado'}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bucket.exists
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                                }`}>
                                {bucket.exists ? 'OK' : 'Erro'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Informações adicionais */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                    {lastCheck && (
                        <p>Última verificação: {lastCheck.toLocaleTimeString()}</p>
                    )}
                    {!allBucketsReady && (
                        <div className="mt-2 space-y-1">
                            <p><strong>Para corrigir manualmente:</strong></p>
                            <p>1. Execute o script <code>CREATE_BUCKET_FUNCTIONS.sql</code> no SQL Editor</p>
                            <p>2. Ou clique em "Auto Setup" acima</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default StorageStatusPanel
