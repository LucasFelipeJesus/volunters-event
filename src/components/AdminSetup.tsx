import React, { useState, useEffect, useCallback } from 'react'
import { setupInitialAdmin, checkAdminStatus } from '../utils/adminSetup'

interface AdminSetupProps {
  onComplete?: () => void
}

export const AdminSetupComponent: React.FC<AdminSetupProps> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'checking' | 'needs_setup' | 'ready' | 'error'>('checking')
  const [message, setMessage] = useState('')

  const checkStatus = useCallback(async () => {
    setLoading(true)
    setStatus('checking')
    setMessage('Verificando configuração do administrador...')

    try {
      const isReady = await checkAdminStatus()
      if (isReady) {
        setStatus('ready')
        setMessage('Administrador configurado corretamente!')
        onComplete?.()
      } else {
        setStatus('needs_setup')
        setMessage('Administrador precisa ser configurado.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Erro ao verificar configuração.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [onComplete])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleSetup = async () => {
    setLoading(true)
    setMessage('Configurando administrador inicial...')

    try {
      const success = await setupInitialAdmin()
      if (success) {
        setStatus('ready')
        setMessage('Administrador configurado com sucesso!')
        onComplete?.()
      } else {
        setStatus('error')
        setMessage('Erro ao configurar administrador.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Erro inesperado durante a configuração.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'ready') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Sistema Configurado
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>{message}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Configuração do Sistema
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>{message}</p>
          </div>
          {status === 'needs_setup' && (
            <div className="mt-4">
              <div className="flex space-x-2">
                <button
                  onClick={handleSetup}
                  disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Configurando...' : 'Configurar Administrador'}
                </button>
                <button
                  onClick={checkStatus}
                  disabled={loading}
                  className="bg-white hover:bg-gray-50 text-yellow-600 border border-yellow-600 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  Verificar Novamente
                </button>
              </div>
              <div className="mt-3 text-xs text-yellow-600">
                <p><strong>Credenciais padrão:</strong></p>
                <p>Email: admin@sistema.com</p>
                <p>Senha: admin123</p>
                <p className="mt-1"><em>Altere a senha no primeiro login!</em></p>
              </div>
            </div>
          )}
          {status === 'error' && (
            <div className="mt-4">
              <button
                onClick={checkStatus}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminSetupComponent
