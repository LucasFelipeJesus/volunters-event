import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    FileText,
    Settings,
    AlertCircle,
    Save,
    ArrowLeft,
    Upload,
    X
} from 'lucide-react'

// Schema de validação
interface EventFormData {
    title: string
    description: string
    location: string
    event_date: string
    start_time: string
    end_time: string
    max_volunteers: number
    registration_start_date: string
    registration_end_date: string
    category: string
    requirements?: string
    image_url?: string
}

export const CreateEvent: React.FC = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [uploadingImage, setUploadingImage] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors }
    } = useForm<EventFormData>({
        defaultValues: {
            category: 'social',
            max_volunteers: 10,
            title: '',
            description: '',
            location: '',
            event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias no futuro
            start_time: '09:00',
            end_time: '17:00',
            registration_start_date: new Date().toISOString().split('T')[0], // hoje
            registration_end_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 25 dias no futuro
            requirements: '',
            image_url: ''
        }
    })

    const eventDate = watch('event_date')
    const registrationEndDate = watch('registration_end_date')

    // Validar se a data de fim das inscrições não é posterior ao evento
    React.useEffect(() => {
        if (eventDate && registrationEndDate) {
            const eventDateTime = new Date(eventDate)
            const regEndDateTime = new Date(registrationEndDate)

            if (regEndDateTime >= eventDateTime) {
                setError('A data de fim das inscrições deve ser anterior à data do evento')
            } else {
                // Limpar erro se as datas estão corretas
                if (error === 'A data de fim das inscrições deve ser anterior à data do evento') {
                    setError(null)
                }
            }
        }
    }, [eventDate, registrationEndDate, error])

    // Função para gerenciar seleção de arquivo
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
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

            setImageFile(file)

            // Criar preview da imagem
            const reader = new FileReader()
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)
            setError(null)
        }
    }

    // Função para remover imagem selecionada
    const removeImage = () => {
        setImageFile(null)
        setImagePreview(null)
    }

    // Função para fazer upload da imagem para o Supabase Storage
    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploadingImage(true)
            console.log('Iniciando upload da imagem:', file.name, 'Tamanho:', file.size)

            // Gerar nome único para o arquivo
            const fileExt = file.name.split('.').pop()
            const fileName = `event-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            console.log('Nome do arquivo gerado:', fileName)

            // Upload para o bucket 'event-images'
            const { data, error } = await supabase.storage
                .from('event-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (error) {
                console.error('Erro detalhado do upload:', error)
                throw error
            }

            console.log('Upload realizado com sucesso:', data)

            // Obter URL pública da imagem
            const { data: { publicUrl } } = supabase.storage
                .from('event-images')
                .getPublicUrl(data.path)

            console.log('URL pública gerada:', publicUrl)
            return publicUrl
        } catch (error) {
            console.error('Erro ao fazer upload da imagem:', error)
            
            // Erro mais específico baseado no tipo de erro
            if (error && typeof error === 'object' && 'message' in error) {
                const errorMessage = (error as { message: string }).message || ''
                if (errorMessage.includes('row-level security policy')) {
                    throw new Error('Erro de permissão. Verifique se você está logado e tem permissão para fazer upload.')
                } else if (errorMessage.includes('Unauthorized')) {
                    throw new Error('Não autorizado. Faça login novamente.')
                }
            }
            
            throw new Error('Erro ao fazer upload da imagem. Tente novamente.')
        } finally {
            setUploadingImage(false)
        }
    }

    const onSubmit = async (data: EventFormData) => {
        console.log('onSubmit chamado com dados:', data) // Debug
        setIsLoading(true)
        setError(null)

        try {
            // Validar se é admin ou captain
            if (user?.role !== 'admin' && user?.role !== 'captain') {
                setError('Você não tem permissão para criar eventos')
                setIsLoading(false)
                return
            }

            // Validar e converter datas
            const eventDate = new Date(data.event_date)
            if (isNaN(eventDate.getTime())) {
                setError('Data do evento inválida. Por favor, selecione uma data válida')
                setIsLoading(false)
                return
            }

            let registrationStartDate = null
            let registrationEndDate = null

            if (data.registration_start_date) {
                registrationStartDate = new Date(data.registration_start_date)
                if (isNaN(registrationStartDate.getTime())) {
                    setError('Data de início das inscrições inválida. Por favor, selecione uma data válida')
                    setIsLoading(false)
                    return
                }
            }

            if (data.registration_end_date) {
                registrationEndDate = new Date(data.registration_end_date)
                if (isNaN(registrationEndDate.getTime())) {
                    setError('Data de fim das inscrições inválida. Por favor, selecione uma data válida')
                    setIsLoading(false)
                    return
                }
            }

            // Validar data mínima (uma semana a partir de hoje)
            const today = new Date()
            const minDate = new Date(today)
            minDate.setDate(today.getDate() + 7)

            if (eventDate < minDate) {
                setError('O evento deve ser criado com pelo menos uma semana de antecedência')
                setIsLoading(false)
                return
            }

            // Validar se data de início das inscrições é antes da data de fim
            if (registrationStartDate && registrationEndDate && registrationStartDate >= registrationEndDate) {
                setError('A data de início das inscrições deve ser anterior à data de fim das inscrições')
                setIsLoading(false)
                return
            }

            // Validar se data de fim das inscrições é antes do evento
            if (registrationEndDate && registrationEndDate >= eventDate) {
                setError('A data de fim das inscrições deve ser anterior à data do evento')
                setIsLoading(false)
                return
            }

            // Validar horários
            if (data.start_time >= data.end_time) {
                setError('O horário de início deve ser anterior ao horário de término')
                setIsLoading(false)
                return
            }

            // Validar número máximo de voluntários
            if (data.max_volunteers && (data.max_volunteers < 1 || data.max_volunteers > 1000)) {
                setError('O número máximo de voluntários deve estar entre 1 e 1000')
                setIsLoading(false)
                return
            }

            // Upload da imagem se foi selecionada
            let imageUrl = null
            if (imageFile) {
                imageUrl = await uploadImage(imageFile)
            }

            // Inserir evento no banco
            const { data: eventData, error: insertError } = await supabase
                .from('events')
                .insert([
                    {
                        title: data.title,
                        description: data.description,
                        location: data.location,
                        event_date: eventDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
                        start_time: data.start_time,
                        end_time: data.end_time,
                        max_volunteers: data.max_volunteers || 10,
                        registration_start_date: registrationStartDate ? registrationStartDate.toISOString().split('T')[0] : null,
                        registration_end_date: registrationEndDate ? registrationEndDate.toISOString().split('T')[0] : null,
                        category: data.category,
                        requirements: data.requirements || null,
                        image_url: imageUrl,
                        admin_id: user.id,
                        status: 'published'
                    }
                ])
                .select()
                .single()

            if (insertError) throw insertError

            // Redirecionar para a página do evento
            navigate(`/events/${eventData.id}`)
        } catch (error: unknown) {
            console.error('Erro ao criar evento:', error)
            const errorMessage = error instanceof Error ? error.message : 'Erro ao criar evento. Tente novamente.'
            setError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const categories = [
        { value: 'education', label: 'Educação' },
        { value: 'health', label: 'Saúde' },
        { value: 'environment', label: 'Meio Ambiente' },
        { value: 'social', label: 'Social' },
        { value: 'culture', label: 'Cultura' },
        { value: 'sports', label: 'Esportes' },
        { value: 'technology', label: 'Tecnologia' },
        { value: 'community', label: 'Comunidade' }
    ]

    // Calcular data mínima para inscrições (mais flexível)
    const getMinRegistrationDate = () => {
        if (!eventDate) return new Date().toISOString().split('T')[0]

        const event = new Date(eventDate)
        const oneWeekBefore = new Date(event)
        oneWeekBefore.setDate(oneWeekBefore.getDate() - 7) // 1 semana antes ao invés de 1 mês

        const today = new Date()

        // Retorna a data mais recente entre hoje e 1 semana antes do evento
        return oneWeekBefore > today
            ? oneWeekBefore.toISOString().split('T')[0]
            : today.toISOString().split('T')[0]
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/events')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Voltar para eventos"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Criar Novo Evento</h1>
                    <p className="text-gray-600 mt-2">
                        Preencha as informações para criar um evento de voluntariado
                    </p>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* Informações Básicas */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Informações Básicas</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Título do Evento *
                            </label>
                            <input
                                {...register('title', { required: 'Título é obrigatório' })}
                                type="text"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Mutirão de Limpeza do Parque Central"
                            />
                            {errors.title && (
                                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                            )}
                        </div>

                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descrição *
                            </label>
                            <textarea
                                {...register('description', { required: 'Descrição é obrigatória' })}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Descreva o evento, objetivos e o que os voluntários irão fazer..."
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Local *
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    {...register('location', { required: 'Localização é obrigatória' })}
                                    type="text"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ex: Parque Central, Rua das Flores, 123"
                                />
                            </div>
                            {errors.location && (
                                <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Categoria *
                            </label>
                            <select
                                {...register('category', { required: 'Categoria é obrigatória' })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {categories.map((category) => (
                                    <option key={category.value} value={category.value}>
                                        {category.label}
                                    </option>
                                ))}
                            </select>
                            {errors.category && (
                                <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Imagem do Evento (opcional)
                            </label>

                            {!imagePreview ? (
                                <div>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            id="image-upload"
                                        />
                                        <label
                                            htmlFor="image-upload"
                                            className="cursor-pointer flex flex-col items-center space-y-2"
                                        >
                                            <Upload className="w-8 h-8 text-gray-400" />
                                            <span className="text-sm text-gray-600">
                                                Clique para selecionar uma imagem
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                PNG, JPG, GIF até 5MB
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <img
                                        src={imagePreview}
                                        alt="Preview da imagem"
                                        className="w-full h-48 object-cover rounded-lg border border-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                        title="Remover imagem"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {uploadingImage && (
                                <div className="mt-2 text-sm text-blue-600 flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                    Fazendo upload da imagem...
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Máximo de Voluntários *
                            </label>
                            <div className="relative">
                                <Users className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    {...register('max_volunteers', { valueAsNumber: true })}
                                    type="number"
                                    min="1"
                                    max="1000"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="10"
                                />
                            </div>
                            {errors.max_volunteers && (
                                <p className="mt-1 text-sm text-red-600">{errors.max_volunteers.message}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Data e Horário */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <Calendar className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Data e Horário</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Data do Evento *
                            </label>
                            <input
                                {...register('event_date', { required: 'Data do evento é obrigatória' })}
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.event_date && (
                                <p className="mt-1 text-sm text-red-600">{errors.event_date.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hora de Início *
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    {...register('start_time', { required: 'Horário de início é obrigatório' })}
                                    type="time"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            {errors.start_time && (
                                <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Hora de Término *
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    {...register('end_time', { required: 'Horário de término é obrigatório' })}
                                    type="time"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            {errors.end_time && (
                                <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Período de Inscrições */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <Settings className="w-6 h-6 text-purple-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Período de Inscrições</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                                <AlertCircle className="w-5 h-5 text-blue-600" />
                                <p className="text-blue-800 text-sm">
                                    <strong>Dica:</strong> As inscrições devem terminar antes da data do evento. Recomendamos pelo menos 1 semana de antecedência.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Início das Inscrições *
                                </label>
                                <input
                                    {...register('registration_start_date')}
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    max={getMinRegistrationDate()}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {errors.registration_start_date && (
                                    <p className="mt-1 text-sm text-red-600">{errors.registration_start_date.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Fim das Inscrições *
                                </label>
                                <input
                                    {...register('registration_end_date')}
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    max={eventDate ? new Date(eventDate).toISOString().split('T')[0] : undefined}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {errors.registration_end_date && (
                                    <p className="mt-1 text-sm text-red-600">{errors.registration_end_date.message}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requisitos */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <FileText className="w-6 h-6 text-orange-600" />
                        <h2 className="text-xl font-semibold text-gray-900">Requisitos (Opcional)</h2>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Requisitos para Participação
                        </label>
                        <textarea
                            {...register('requirements')}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: Disponibilidade para trabalhar ao ar livre, trazer água e protetor solar..."
                        />
                        {errors.requirements && (
                            <p className="mt-1 text-sm text-red-600">{errors.requirements.message}</p>
                        )}
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => navigate('/events')}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        <span>{isLoading ? 'Criando...' : 'Criar Evento'}</span>
                    </button>
                </div>
            </form>
        </div>
    )
}
