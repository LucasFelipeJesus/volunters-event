import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCEPLookup } from '../../hooks/useCEPLookup'
import { supabase } from '../../lib/supabase'
import {
    User,
    Save,
    Camera,
    Edit,
    X,
    AlertCircle,
    CheckCircle,
    Eye,
    EyeOff,
    Car,
    Phone,
    FileText,
    Shield,
    Trash2
} from 'lucide-react'

interface UserProfile {
    id: string
    email: string
    full_name: string
    phone?: string
    avatar_url?: string
    bio?: string
    skills?: string[]
    availability?: string[]
    cpf?: string
    birth_date?: string
    address?: string
    city?: string
    state?: string
    postal_code?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    vehicle_type?: 'car' | 'motorcycle' | 'bicycle' | 'none'
    vehicle_model?: string
    vehicle_plate?: string
    has_drivers_license?: boolean
    profile_image_url?: string
    role: string
    created_at: string
    updated_at: string
}

interface PasswordData {
    currentPassword: string
    newPassword: string
    confirmPassword: string
}

export const Profile: React.FC = () => {
    const { user } = useAuth()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'vehicle' | 'password'>('personal')

    // Estados para dados editáveis
    const [editData, setEditData] = useState<Partial<UserProfile>>({})
    const [passwordData, setPasswordData] = useState<PasswordData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })

    // Estados para upload de imagem
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [uploadingImage, setUploadingImage] = useState(false)

    // Estados para senha
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)

    // Hook para consulta de CEP
    const { lookupCEP, formatCEP, loading: cepLoading, error: cepError, clearError: clearCepError } = useCEPLookup()

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true)

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user?.id)
                .single()

            if (error) throw error

            setProfile(data)
            setEditData(data)
        } catch (error: unknown) {
            console.error('Erro ao carregar perfil:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar perfil'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [user?.id])

    useEffect(() => {
        if (user?.id) {
            fetchProfile()
        }
    }, [user?.id, fetchProfile])

    const uploadProfileImage = async (file: File): Promise<string> => {
        try {
            if (!user?.id) {
                throw new Error('Usuário não autenticado')
            }

            // Validar tipo de arquivo
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
            if (!allowedTypes.includes(file.type)) {
                throw new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.')
            }

            // Validar tamanho do arquivo (máximo 5MB)
            const maxSize = 5 * 1024 * 1024 // 5MB
            if (file.size > maxSize) {
                throw new Error('A imagem deve ter no máximo 5MB')
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}/profile_${Date.now()}.${fileExt}`

            console.log('Tentando fazer upload da imagem:', fileName)

            // Primeiro, verificar se o bucket existe e se temos acesso
            console.log('Verificando acesso ao bucket...')

            try {
                // Tentar listar arquivos do bucket para verificar acesso
                const { data: listData, error: listError } = await supabase.storage
                    .from('profile-images')
                    .list('', { limit: 1 })

                if (listError) {
                    console.error('Erro ao acessar bucket:', listError)
                    throw new Error(`Acesso negado ao bucket: ${listError.message}`)
                }

                console.log('Bucket acessível, listagem:', listData)
            } catch (bucketError) {
                console.error('Erro na verificação do bucket:', bucketError)
                throw new Error('Não foi possível verificar o bucket de armazenamento')
            }

            // Tentar upload direto
            console.log('Iniciando upload...')
            const { data, error } = await supabase.storage
                .from('profile-images')
                .upload(fileName, file, {
                    upsert: true,
                    contentType: file.type
                })

            if (error) {
                console.error('Erro no upload:', error)
                console.error('Detalhes do erro:', JSON.stringify(error, null, 2))
                throw new Error(`Erro ao fazer upload: ${error.message}`)
            }

            // Se chegou até aqui, upload foi bem-sucedido
            const { data: { publicUrl } } = supabase.storage
                .from('profile-images')
                .getPublicUrl(data.path)

            console.log('Upload realizado com sucesso:', publicUrl)
            return publicUrl

        } catch (error) {
            console.error('Erro detalhado no upload:', error)
            throw error
        }
    }

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecione apenas arquivos de imagem')
            return
        }

        // Validar tamanho do arquivo (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('A imagem deve ter no máximo 5MB')
            return
        }

        // Criar preview da imagem
        const reader = new FileReader()
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
        setError(null)

        // Fazer upload imediato da imagem
        try {
            setUploadingImage(true)
            const imageUrl = await uploadProfileImage(file)

            // Atualizar o banco de dados com a nova imagem
            const { error } = await supabase
                .from('users')
                .update({
                    profile_image_url: imageUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user?.id)

            if (error) throw error

            // Atualizar os dados locais
            setEditData(prev => ({ ...prev, profile_image_url: imageUrl }))
            setSuccess('Foto de perfil atualizada com sucesso!')

            // Recarregar o perfil para ter os dados mais recentes
            await fetchProfile()

        } catch (error: unknown) {
            console.error('Erro ao atualizar foto:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar foto'
            setError(errorMessage)
            setImagePreview(null)
        } finally {
            setUploadingImage(false)
        }
    }

    const handleSaveProfile = async () => {
        try {
            setSaving(true)
            setError(null)

            // Validações básicas
            if (!editData.full_name || !editData.email) {
                throw new Error('Nome completo e email são obrigatórios')
            }

            // Atualizar perfil (a imagem já foi salva no handleImageChange)
            const { error } = await supabase
                .from('users')
                .update({
                    ...editData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user?.id)

            if (error) throw error

            setSuccess('Perfil atualizado com sucesso!')
            setIsEditing(false)
            setImagePreview(null)
            await fetchProfile()

        } catch (error: unknown) {
            console.error('Erro ao atualizar perfil:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar perfil'
            setError(errorMessage)
        } finally {
            setSaving(false)
            setUploadingImage(false)
        }
    }

    const handleChangePassword = async () => {
        try {
            setChangingPassword(true)
            setError(null)

            // Validações
            if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
                throw new Error('Todos os campos de senha são obrigatórios')
            }

            if (passwordData.newPassword !== passwordData.confirmPassword) {
                throw new Error('A nova senha e confirmação não coincidem')
            }

            if (passwordData.newPassword.length < 6) {
                throw new Error('A nova senha deve ter pelo menos 6 caracteres')
            }

            // Atualizar senha no Supabase Auth
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            })

            if (error) throw error

            setSuccess('Senha alterada com sucesso!')
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            })

        } catch (error: unknown) {
            console.error('Erro ao alterar senha:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao alterar senha'
            setError(errorMessage)
        } finally {
            setChangingPassword(false)
        }
    }

    const handleCEPChange = async (cep: string) => {
        const formattedCEP = formatCEP(cep)
        setEditData({ ...editData, postal_code: formattedCEP })
        clearCepError()

        // Se CEP tem 9 caracteres (formato 00000-000), fazer consulta
        if (formattedCEP.length === 9) {
            const addressData = await lookupCEP(formattedCEP)
            if (addressData) {
                setEditData(prev => ({
                    ...prev,
                    postal_code: formattedCEP,
                    address: addressData.address,
                    city: addressData.city,
                    state: addressData.state
                }))
                setSuccess('Endereço preenchido automaticamente via CEP!')
                // Limpar a mensagem após alguns segundos
                setTimeout(() => setSuccess(null), 3000)
            }
        }
    }

    const handleDeleteProfileImage = async () => {
        if (!window.confirm('Tem certeza que deseja remover sua foto de perfil?')) {
            return
        }

        try {
            setSaving(true)

            // Atualizar banco de dados removendo a URL da imagem
            const { error } = await supabase
                .from('users')
                .update({
                    profile_image_url: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user?.id)

            if (error) throw error

            setSuccess('Foto de perfil removida com sucesso!')
            await fetchProfile()

        } catch (error: unknown) {
            console.error('Erro ao remover foto:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao remover foto'
            setError(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return ''
        return new Date(dateString).toLocaleDateString('pt-BR')
    }

    const getVehicleTypeText = (type?: string) => {
        switch (type) {
            case 'car': return 'Carro'
            case 'motorcycle': return 'Motocicleta'
            case 'bicycle': return 'Bicicleta'
            case 'none': return 'Não possuo veículo'
            default: return 'Não informado'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Perfil não encontrado</h3>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
                    <p className="text-gray-600 mt-2">Gerencie suas informações pessoais e configurações</p>
                </div>

                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                        <span>Editar Perfil</span>
                    </button>
                ) : (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleSaveProfile}
                            disabled={saving || uploadingImage}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {saving || uploadingImage ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>Salvar</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false)
                                setEditData(profile)
                                setImagePreview(null)
                                setError(null)
                            }}
                            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            <span>Cancelar</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Mensagens de erro e sucesso */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {cepError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <p className="text-yellow-800">CEP: {cepError}</p>
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800">{success}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar - Foto de Perfil e Info Básica */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="text-center">
                            {/* Foto de Perfil */}
                            <div className="relative inline-block group">
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 mx-auto border-4 border-white shadow-lg">
                                    {imagePreview || editData.profile_image_url ? (
                                        <img
                                            src={imagePreview || editData.profile_image_url || ''}
                                            alt="Foto de perfil"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                                            <User className="w-16 h-16 text-blue-400" />
                                        </div>
                                    )}
                                </div>

                                {isEditing && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <label className="cursor-pointer">
                                            <div className="bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-200 hover:scale-105 transform">
                                                <Camera className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                                title="Selecionar nova foto"
                                            />
                                        </label>
                                    </div>
                                )}

                                {!isEditing && (editData.profile_image_url || imagePreview) && (
                                    <div className="absolute bottom-2 right-2">
                                        <div className="bg-green-500 p-1.5 rounded-full shadow-lg">
                                            <CheckCircle className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {imagePreview && (
                                <div className="mt-3">
                                    <div className="inline-flex items-center space-x-2 text-xs font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>Nova foto selecionada</span>
                                    </div>
                                </div>
                            )}

                            {/* Botão para remover foto */}
                            {(editData.profile_image_url || imagePreview) && isEditing && (
                                <button
                                    onClick={handleDeleteProfileImage}
                                    className="mt-3 inline-flex items-center space-x-2 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                    title="Remover foto de perfil"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Remover foto</span>
                                </button>
                            )}

                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-gray-900">{profile.full_name}</h3>
                                <p className="text-sm text-gray-600 capitalize">{profile.role}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Membro desde {formatDate(profile.created_at)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conteúdo Principal */}
                <div className="lg:col-span-3">
                    {/* Tabs */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="border-b border-gray-200">
                            <nav className="flex space-x-8 px-6">
                                {[
                                    { id: 'personal', name: 'Dados Pessoais', icon: User },
                                    { id: 'contact', name: 'Contato', icon: Phone },
                                    { id: 'vehicle', name: 'Veículo', icon: Car },
                                    { id: 'password', name: 'Senha', icon: Shield }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as 'personal' | 'contact' | 'vehicle' | 'password')}
                                        className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                        title={tab.name}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        <span>{tab.name}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>

                        <div className="p-6">
                            {/* Dados Pessoais */}
                            {activeTab === 'personal' && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <User className="w-5 h-5 mr-2" />
                                        Informações Pessoais
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nome Completo *
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    title="Nome completo"
                                                    value={editData.full_name || ''}
                                                    onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <p className="text-gray-900">{profile.full_name}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email *
                                            </label>
                                            <p className="text-gray-900">{profile.email}</p>
                                            <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                CPF
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    title="CPF"
                                                    value={editData.cpf || ''}
                                                    onChange={(e) => setEditData({ ...editData, cpf: e.target.value })}
                                                    placeholder="000.000.000-00"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <p className="text-gray-900">{profile.cpf || 'Não informado'}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Data de Nascimento
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    title="Data de nascimento"
                                                    value={editData.birth_date || ''}
                                                    onChange={(e) => setEditData({ ...editData, birth_date: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <p className="text-gray-900">
                                                    {profile.birth_date ? formatDate(profile.birth_date) : 'Não informado'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Biografia
                                        </label>
                                        {isEditing ? (
                                            <textarea
                                                title="Biografia"
                                                value={editData.bio || ''}
                                                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                                                rows={4}
                                                placeholder="Conte um pouco sobre você..."
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        ) : (
                                            <p className="text-gray-900">{profile.bio || 'Não informado'}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Contato */}
                            {activeTab === 'contact' && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Phone className="w-5 h-5 mr-2" />
                                        Informações de Contato
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Telefone
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="tel"
                                                    title="Telefone"
                                                    value={editData.phone || ''}
                                                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                                    placeholder="(11) 99999-9999"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <p className="text-gray-900">{profile.phone || 'Não informado'}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                CEP
                                            </label>
                                            {isEditing ? (
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        title="CEP"
                                                        value={editData.postal_code || ''}
                                                        onChange={(e) => handleCEPChange(e.target.value)}
                                                        placeholder="00000-000"
                                                        maxLength={9}
                                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${cepLoading ? 'border-blue-300 bg-blue-50' :
                                                                cepError ? 'border-red-300' : 'border-gray-300'
                                                            }`}
                                                    />
                                                    {cepLoading && (
                                                        <div className="absolute right-3 top-2.5">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                        </div>
                                                    )}
                                                    {cepError && (
                                                        <p className="text-red-600 text-xs mt-1">{cepError}</p>
                                                    )}
                                                    <p className="text-gray-500 text-xs mt-1">
                                                        Digite o CEP para preenchimento automático do endereço
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-gray-900">{profile.postal_code || 'Não informado'}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Endereço
                                            <span className="text-xs text-gray-500 ml-2">(preenchido automaticamente via CEP)</span>
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                title="Endereço"
                                                value={editData.address || ''}
                                                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                                                placeholder="Rua, número, complemento"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        ) : (
                                            <p className="text-gray-900">{profile.address || 'Não informado'}</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Cidade
                                                <span className="text-xs text-gray-500 ml-2">(via CEP)</span>
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    title="Cidade"
                                                    value={editData.city || ''}
                                                    onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <p className="text-gray-900">{profile.city || 'Não informado'}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Estado
                                                <span className="text-xs text-gray-500 ml-2">(via CEP)</span>
                                            </label>
                                            {isEditing ? (
                                                <select
                                                    title="Estado"
                                                    value={editData.state || ''}
                                                    onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">Selecione um estado</option>
                                                    <option value="AC">Acre</option>
                                                    <option value="AL">Alagoas</option>
                                                    <option value="AP">Amapá</option>
                                                    <option value="AM">Amazonas</option>
                                                    <option value="BA">Bahia</option>
                                                    <option value="CE">Ceará</option>
                                                    <option value="DF">Distrito Federal</option>
                                                    <option value="ES">Espírito Santo</option>
                                                    <option value="GO">Goiás</option>
                                                    <option value="MA">Maranhão</option>
                                                    <option value="MT">Mato Grosso</option>
                                                    <option value="MS">Mato Grosso do Sul</option>
                                                    <option value="MG">Minas Gerais</option>
                                                    <option value="PA">Pará</option>
                                                    <option value="PB">Paraíba</option>
                                                    <option value="PR">Paraná</option>
                                                    <option value="PE">Pernambuco</option>
                                                    <option value="PI">Piauí</option>
                                                    <option value="RJ">Rio de Janeiro</option>
                                                    <option value="RN">Rio Grande do Norte</option>
                                                    <option value="RS">Rio Grande do Sul</option>
                                                    <option value="RO">Rondônia</option>
                                                    <option value="RR">Roraima</option>
                                                    <option value="SC">Santa Catarina</option>
                                                    <option value="SP">São Paulo</option>
                                                    <option value="SE">Sergipe</option>
                                                    <option value="TO">Tocantins</option>
                                                </select>
                                            ) : (
                                                <p className="text-gray-900">{profile.state || 'Não informado'}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <h4 className="font-medium text-yellow-800 mb-3">Contato de Emergência</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-yellow-700 mb-2">
                                                    Nome
                                                </label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        title="Nome do contato de emergência"
                                                        value={editData.emergency_contact_name || ''}
                                                        onChange={(e) => setEditData({ ...editData, emergency_contact_name: e.target.value })}
                                                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                                    />
                                                ) : (
                                                    <p className="text-yellow-800">{profile.emergency_contact_name || 'Não informado'}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-yellow-700 mb-2">
                                                    Telefone
                                                </label>
                                                {isEditing ? (
                                                    <input
                                                        type="tel"
                                                        title="Telefone do contato de emergência"
                                                        value={editData.emergency_contact_phone || ''}
                                                        onChange={(e) => setEditData({ ...editData, emergency_contact_phone: e.target.value })}
                                                        placeholder="(11) 99999-9999"
                                                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                                    />
                                                ) : (
                                                    <p className="text-yellow-800">{profile.emergency_contact_phone || 'Não informado'}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Veículo */}
                            {activeTab === 'vehicle' && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Car className="w-5 h-5 mr-2" />
                                        Informações do Veículo
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Tipo de Veículo
                                            </label>
                                            {isEditing ? (
                                                <select
                                                    title="Tipo de veículo"
                                                    value={editData.vehicle_type || ''}
                                                    onChange={(e) => setEditData({ ...editData, vehicle_type: e.target.value as 'car' | 'motorcycle' | 'bicycle' | 'none' })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">Selecione o tipo</option>
                                                    <option value="car">Carro</option>
                                                    <option value="motorcycle">Motocicleta</option>
                                                    <option value="bicycle">Bicicleta</option>
                                                    <option value="none">Não possuo veículo</option>
                                                </select>
                                            ) : (
                                                <p className="text-gray-900">{getVehicleTypeText(profile.vehicle_type)}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Possui CNH?
                                            </label>
                                            {isEditing ? (
                                                <select
                                                    title="Possui CNH"
                                                    value={editData.has_drivers_license ? 'true' : 'false'}
                                                    onChange={(e) => setEditData({ ...editData, has_drivers_license: e.target.value === 'true' })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="false">Não</option>
                                                    <option value="true">Sim</option>
                                                </select>
                                            ) : (
                                                <p className="text-gray-900">{profile.has_drivers_license ? 'Sim' : 'Não'}</p>
                                            )}
                                        </div>

                                        {(editData.vehicle_type && editData.vehicle_type !== 'none' && editData.vehicle_type !== 'bicycle') && (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Modelo do Veículo
                                                    </label>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            title="Modelo do veículo"
                                                            value={editData.vehicle_model || ''}
                                                            onChange={(e) => setEditData({ ...editData, vehicle_model: e.target.value })}
                                                            placeholder="Ex: Honda Civic, Honda CB600F"
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        />
                                                    ) : (
                                                        <p className="text-gray-900">{profile.vehicle_model || 'Não informado'}</p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Placa do Veículo
                                                    </label>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            title="Placa do veículo"
                                                            value={editData.vehicle_plate || ''}
                                                            onChange={(e) => setEditData({ ...editData, vehicle_plate: e.target.value })}
                                                            placeholder="ABC-1234"
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        />
                                                    ) : (
                                                        <p className="text-gray-900">{profile.vehicle_plate || 'Não informado'}</p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-start space-x-3">
                                            <FileText className="w-5 h-5 text-blue-600 mt-1" />
                                            <div>
                                                <h4 className="font-medium text-blue-800">Por que precisamos dessas informações?</h4>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    As informações do veículo são importantes para eventos que podem requerer transporte
                                                    ou quando há necessidade de organizar carona solidária entre voluntários.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Senha */}
                            {activeTab === 'password' && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Shield className="w-5 h-5 mr-2" />
                                        Alterar Senha
                                    </h3>

                                    <div className="max-w-md space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Senha Atual *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showCurrentPassword ? 'text' : 'password'}
                                                    title="Senha atual"
                                                    value={passwordData.currentPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                                    title={showCurrentPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                                >
                                                    {showCurrentPassword ? (
                                                        <EyeOff className="w-4 h-4 text-gray-400" />
                                                    ) : (
                                                        <Eye className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nova Senha *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showNewPassword ? 'text' : 'password'}
                                                    title="Nova senha"
                                                    value={passwordData.newPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                                    title={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                                >
                                                    {showNewPassword ? (
                                                        <EyeOff className="w-4 h-4 text-gray-400" />
                                                    ) : (
                                                        <Eye className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Confirmar Nova Senha *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    title="Confirmar nova senha"
                                                    value={passwordData.confirmPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                                    title={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                                >
                                                    {showConfirmPassword ? (
                                                        <EyeOff className="w-4 h-4 text-gray-400" />
                                                    ) : (
                                                        <Eye className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleChangePassword}
                                            disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Alterar senha"
                                        >
                                            {changingPassword ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            ) : (
                                                <Shield className="w-4 h-4" />
                                            )}
                                            <span>Alterar Senha</span>
                                        </button>

                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                            <h4 className="font-medium text-gray-800 mb-2">Requisitos de Senha:</h4>
                                            <ul className="text-sm text-gray-600 space-y-1">
                                                <li>• Mínimo de 6 caracteres</li>
                                                <li>• Recomendamos usar uma combinação de letras, números e símbolos</li>
                                                <li>• Evite senhas muito simples ou previsíveis</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
