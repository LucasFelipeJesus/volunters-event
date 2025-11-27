import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { useAuth } from '../../hooks/useAuth'
import { Users, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

const schema = yup.object().shape({
  email: yup.string().email('Email inválido').required('Email é obrigatório'),
  password: yup.string().min(6, 'Senha deve ter pelo menos 6 caracteres').required('Senha é obrigatória')
})

interface FormData {
  email: string
  password: string
}

export const Login: React.FC = () => {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const from = location.state?.from?.pathname || '/'
  const emailFromRegister = location.state?.email || ''
  const messageFromRegister = location.state?.message || ''

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: yupResolver(schema)
  })

  // Detectar dados vindos do registro e configurar mensagem de sucesso
  useEffect(() => {
    if (messageFromRegister) {
      setSuccessMessage(messageFromRegister)
      // Limpar mensagem após 5 segundos
      setTimeout(() => setSuccessMessage(null), 5000)
    }
    if (emailFromRegister) {
      setValue('email', emailFromRegister)
    }
  }, [messageFromRegister, emailFromRegister, setValue])

  // Limpa mensagens informativas automaticamente
  useEffect(() => {
    if (!infoMessage) return
    const t = setTimeout(() => setInfoMessage(null), 8000)
    return () => clearTimeout(t)
  }, [infoMessage])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🚀 Iniciando processo de login para:', data.email)
      await signIn(data.email, data.password)
      console.log('✅ Login realizado com sucesso, redirecionando...')
      navigate(from, { replace: true })
    } catch (error) {
      console.error('❌ Erro capturado na página de login:', error)

      // Mensagens específicas baseadas no tipo de erro
      let errorMessage = 'Erro ao fazer login'

      if (error instanceof Error && error.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = '🔐 Email ou senha incorretos. Verifique suas credenciais.'
        } else if (error.message.includes('Too many requests')) {
          errorMessage = '⏰ Muitas tentativas de login. Tente novamente em alguns minutos.'
        } else if (error.message.includes('User not found')) {
          errorMessage = '👤 Usuário não encontrado. Verifique o email ou cadastre-se.'
        } else {
          errorMessage = error.message
        }
      }

      setError(errorMessage)
      console.log('💡 Dica: Para testar o admin, use email: admin@sistema.com')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Entrar na sua conta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ou{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
            >
              criar uma nova conta
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400" />
                <div className="ml-3">
                  <p className="text-sm text-blue-700">{infoMessage}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              {...register('email')}
              type="email"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Digite seu email"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <div className="mt-1 relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                placeholder="Digite sua senha"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <button
                type="button"
                onClick={() => {
                  // Mostra instrução para contatar o administrador (telefone não exibido)
                  setInfoMessage('Para recuperar a senha, entre em contato com o administrador.')
                }}
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Entrar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}