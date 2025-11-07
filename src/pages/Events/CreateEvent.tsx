import React, { useState, useEffect } from 'react'
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
    const [termsContent, setTermsContent] = useState('')

    // --- FUNÇÃO DE AJUDA PARA FORMATAR A DATA PARA EXIBIÇÃO ---
    // Converte "YYYY-MM-DD" para "DD/MM/YYYY" de forma segura.
    const formatDateForDisplay = (dateString?: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    // Função utilitária para gerar o texto do termo
    function gerarTextoTermoEvento(nomeEvento: string, cidade: string, dataEvento: string) {
        return `FAQ ${cidade} - Perguntas e Respostas Iniciais\n\nOlá! obrigado por seu interesse em participar do time de churrasqueiros no show "${nomeEvento}" em ${cidade} que acontecerá no dia ${dataEvento}.\n\nLeia com atenção esse FAQ e ao final responda se concorda com todas as premissas do evento.\n\nAqui estão algumas informações preliminares:\n\n1. Existe algum tipo de ajuda de custo?\nInfelizmente não há ajuda de custo para esse tipo de evento.\n\n1.1 O que o voluntario ganha em ir?\nUm ingresso cortesia que poderá ser concedido à um acompanhante ou vendido com intenção de ajudar nos custos de locomoção, estadia, etc (venda sob total responsabilidade do voluntário). Em caso de não comparecimento, o ingresso é automaticamente cancelado.\nAlém de um boné oficial e exclusivo do TEAM ON FIRE, terá a oportunidade de aprender ou colocar em prática os aprendizados adquiridos até então. Poderá divulgar seu nome ou marca com boné e avental próprio (fotos liberadas). Fará um incrível network entre os envolvidos, experiência, amizades e ao final uma divertida confraternização com cervejas e risadas.\n\n2. Qual a jornada de trabalho?\nNormalmente de 8 a 12 horas, dependendo da estação que ficar alocado.\n\n3. É possível desconto na compra de ingressos?\nNão temos descontos ou qualquer outro tipo de bonificação em relação à ingressos.\n\n4. O que terei que fazer?\nTodos os voluntários passarão por todas as etapas dentro da estação de trabalho, ou seja, retirar proteínas no caminhão frigorífico, assar em parrilla, porcionar peças, organizar e limpar local de trabalho, atender ao público, etc. \n\n5. O que preciso levar?\nÉ necessário que cada voluntário leve seus utensílios essenciais como faca e pegador, podendo levar também outros itens que julgue necessário como por exemplo luva térmica, chaira, etc. Lembrando que todos esses itens são de responsabilidade pessoal. Cuide para não perde los!\n\n6. Posso me alimentar durante o trabalho?\nSim. A comida fica a disposição para todos os voluntários durante o trabalho.\n\n7. Posso beber bebida alcoólica?\nNão! Trabalhamos em regime de lei seca. Ao término do evento temos nossa confraternização onde todos poderão ingerir bebida alcoólica e se divertir!\n\n8. Posso sair da minha estação para assistir ao show?\nNão. Precisamos manter as atividades em andamento até o final do show. Dependendo do movimento, seu supervisor avisará sobre essa possibilidade.\n\n9. Local do evento\nSerá divulgado no grupo de voluntários no Whatsapp.\n\n10. Caso pretenda ir de carro ao evento, preencha os dados do veiculo no fim desse questionário.\n\nLembramos que cada voluntário é responsável pela sua condição física e não nos responsabilizamos por acidentes com facas, fogo, etc.\n\nMais informações no grupo dos voluntários confirmados.\n\nObrigado pelo seu interesse em estar conosco!`;
    }

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors }
    } = useForm<EventFormData>({
        defaultValues: {
            category: 'agenda-FS',
            max_volunteers: 10,
            title: '',
            description: '',
            location: '',
            event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            start_time: '09:00',
            end_time: '17:00',
            registration_start_date: new Date().toISOString().split('T')[0],
            registration_end_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            requirements: '',
            image_url: ''
        }
    })

    const title = watch('title');
    const location = watch('location');
    const eventDateValue = watch('event_date');

    // Sugere o texto do termo automaticamente ao preencher título, local e data
    useEffect(() => {
        if (title && location && eventDateValue) {
            // CORREÇÃO: Usar a função auxiliar para formatar a data corretamente.
            const formattedDate = formatDateForDisplay(eventDateValue);
            setTermsContent(
                gerarTextoTermoEvento(
                    title,
                    location,
                    formattedDate
                )
            );
        }
    }, [title, location, eventDateValue]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Por favor, selecione apenas arquivos de imagem')
                return
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('A imagem deve ter no máximo 5MB')
                return
            }
            setImageFile(file)
            const reader = new FileReader()
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)
            setError(null)
        }
    }

    const removeImage = () => {
        setImageFile(null)
        setImagePreview(null)
    }

    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            setUploadingImage(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `event-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const { data, error } = await supabase.storage
                .from('event-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                })
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage
                .from('event-images')
                .getPublicUrl(data.path)
            return publicUrl
        } catch (error) {
            console.error('Erro ao fazer upload da imagem:', error)
            throw new Error('Erro ao fazer upload da imagem. Tente novamente.')
        } finally {
            setUploadingImage(false)
        }
    }

    const onSubmit = async (data: EventFormData) => {
        setIsLoading(true)
        setError(null)

        try {
            if (user?.role !== 'admin' && user?.role !== 'captain') {
                throw new Error('Você não tem permissão para criar eventos');
            }

            // --- CORREÇÃO NA VALIDAÇÃO DE DATAS ---
            // Comparar as datas como strings no formato YYYY-MM-DD é seguro e evita erros de fuso horário.
            const todayString = new Date().toISOString().split('T')[0];

            if (data.event_date < todayString) {
                throw new Error('A data do evento não pode ser no passado.');
            }

            if (data.registration_start_date && data.registration_end_date && data.registration_start_date >= data.registration_end_date) {
                throw new Error('A data de início das inscrições deve ser anterior à data de fim.');
            }

            if (data.registration_end_date && data.registration_end_date >= data.event_date) {
                throw new Error('A data de fim das inscrições deve ser anterior à data do evento.');
            }

            if (data.start_time >= data.end_time) {
                throw new Error('O horário de início deve ser anterior ao horário de término.');
            }

            if (data.max_volunteers && (data.max_volunteers < 1 || data.max_volunteers > 1000)) {
                throw new Error('O número máximo de voluntários deve estar entre 1 e 1000.');
            }

            let imageUrl = null
            if (imageFile) {
                imageUrl = await uploadImage(imageFile)
            }

            const { data: eventData, error: insertError } = await supabase
                .from('events')
                .insert([
                    {
                        title: data.title,
                        description: data.description,
                        location: data.location,
                        // Enviando a data como string, que é o correto para colunas do tipo 'date'
                        event_date: data.event_date, 
                        start_time: data.start_time,
                        end_time: data.end_time,
                        max_volunteers: data.max_volunteers || 10,
                        registration_start_date: data.registration_start_date || null,
                        registration_end_date: data.registration_end_date || null,
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

            if (termsContent && eventData?.id) {
                await supabase.from('event_terms').insert([
                    {
                        event_id: eventData.id,
                        terms_content: termsContent,
                        is_required: true,
                        is_active: true,
                        created_by: user.id
                    }
                ])
            }

            // Adicionar pergunta padrão de área de preferência para eventos Agenda FS
            if (data.category === 'agenda-FS' && eventData?.id) {
                try {
                    // Criar a pergunta
                    const { data: questionData, error: questionError } = await supabase
                        .from('event_terms_questions')
                        .insert({
                            event_id: eventData.id,
                            question_text: 'Qual área de sua preferência? Pode escolher mais de uma opção (não é certeza que você será alocado nessa área, é apenas um indicativo)',
                            question_type: 'multiple_choice',
                            is_required: false,
                            allow_multiple: true,
                            question_order: 1,
                            is_active: true
                        })
                        .select()
                        .single()

                    if (questionError) throw questionError

                    // Criar as opções da pergunta
                    if (questionData?.id) {
                        const options = [
                            { text: 'Parrilla', value: 'parrilla', order: 1 },
                            { text: 'Fogo de chão', value: 'fogo_chao', order: 2 },
                            { text: 'Pitsmoker (defumação)', value: 'pitsmoker', order: 3 },
                            { text: 'Burger', value: 'burger', order: 4 },
                            { text: 'Carreteiro', value: 'carreteiro', order: 5 },
                            { text: 'Pão de Alho', value: 'pao_alho', order: 6 },
                            { text: 'Sobremesa', value: 'sobremesa', order: 7 },
                            { text: 'Tortilha', value: 'tortilha', order: 8 },
                            { text: 'Macarrão Campeiro', value: 'macarrao_campeiro', order: 9 },
                            { text: 'Não tenho preferência (pau para toda obra)', value: 'sem_preferencia', order: 10 }
                        ]

                        const optionsToInsert = options.map(option => ({
                            question_id: questionData.id,
                            option_text: option.text,
                            option_value: option.value,
                            option_order: option.order
                        }))

                        await supabase
                            .from('event_terms_question_options')
                            .insert(optionsToInsert)
                    }
                } catch (questionError) {
                    console.error('Erro ao criar pergunta padrão:', questionError)
                    // Não falha a criação do evento se houver erro na pergunta
                }
            }

            // Opcional: Registrar criador (verificar se a lógica de status 'registered' está correta para seu fluxo)
            if (eventData?.id && user?.id) {
                await supabase.from('event_registrations').insert([
                    {
                        event_id: eventData.id,
                        user_id: user.id,
                        registration_type: 'direct',
                        status: 'confirmed', // 'confirmed' pode ser mais apropriado para o criador
                        terms_accepted: true,
                        terms_accepted_at: new Date().toISOString(),
                    }
                ])
            }

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
        { value: 'agenda-FS', label: 'Agenda FS' },
        { value: 'corporativo', label: 'Corporativo' }      
    ]

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate(-1)} // Navega para a página anterior
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Voltar"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Criar Novo Evento</h1>
                    <p className="text-gray-600 mt-1">
                        Preencha as informações para criar um evento de voluntariado.
                    </p>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-red-800 text-sm font-medium">{error}</p>
                    </div>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                {/* Informações Básicas */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <FileText className="w-6 h-6 text-blue-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Informações Básicas</h2>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                Título do Evento *
                            </label>
                            <input
                                id="title"
                                {...register('title', { required: 'Título é obrigatório' })}
                                type="text"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Mutirão de Limpeza do Parque Central"
                            />
                            {errors.title && (
                                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                                Descrição *
                            </label>
                            <textarea
                                id="description"
                                {...register('description', { required: 'Descrição é obrigatória' })}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Descreva o evento, objetivos e o que os voluntários irão fazer..."
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                                    Local *
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="location"
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
                                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                                    Categoria *
                                </label>
                                <select
                                    id="category"
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
                        </div>
                    </div>
                </div>

                {/* Data e Horário */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <Calendar className="w-6 h-6 text-green-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Data e Horário</h2>
                        </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="event_date" className="block text-sm font-medium text-gray-700 mb-2">
                                Data do Evento *
                            </label>
                            <input
                                id="event_date"
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
                            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-2">
                                Hora de Início *
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    id="start_time"
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
                            <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-2">
                                Hora de Término *
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    id="end_time"
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

                {/* Período de Inscrições e Vagas */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <Settings className="w-6 h-6 text-purple-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Inscrições e Vagas</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="registration_start_date" className="block text-sm font-medium text-gray-700 mb-2">
                                    Início das Inscrições *
                                </label>
                                <input
                                    id="registration_start_date"
                                    {...register('registration_start_date', { required: 'Data de início é obrigatória' })}
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    max={eventDateValue ? eventDateValue : undefined}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {errors.registration_start_date && (
                                    <p className="mt-1 text-sm text-red-600">{errors.registration_start_date.message}</p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="registration_end_date" className="block text-sm font-medium text-gray-700 mb-2">
                                    Fim das Inscrições *
                                </label>
                                <input
                                    id="registration_end_date"
                                    {...register('registration_end_date', { required: 'Data de fim é obrigatória' })}
                                    type="date"
                                    min={watch('registration_start_date') || new Date().toISOString().split('T')[0]}
                                    max={eventDateValue ? eventDateValue : undefined}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {errors.registration_end_date && (
                                    <p className="mt-1 text-sm text-red-600">{errors.registration_end_date.message}</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="max_volunteers" className="block text-sm font-medium text-gray-700 mb-2">
                                Máximo de Voluntários *
                            </label>
                            <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    id="max_volunteers"
                                    {...register('max_volunteers', { valueAsNumber: true, required: "Número de vagas é obrigatório", min: 1, max: 1000 })}
                                    type="number"
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

                {/* Imagem e Requisitos */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <Upload className="w-6 h-6 text-orange-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Detalhes Adicionais</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Imagem do Evento (opcional)
                            </label>
                            {!imagePreview ? (
                                <label htmlFor="image-upload" className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-center flex flex-col items-center justify-center hover:border-blue-500 transition-colors">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <span className="text-sm font-semibold text-blue-600">Clique para fazer upload</span>
                                    <span className="text-xs text-gray-500 mt-1">PNG, JPG, GIF até 5MB</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="image-upload"
                                    />
                                </label>
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
                                        className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-colors"
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
                            <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 mb-2">
                                Requisitos para Participação (opcional)
                            </label>
                            <textarea
                                id="requirements"
                                {...register('requirements')}
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Disponibilidade para trabalhar ao ar livre, trazer água e protetor solar..."
                            />
                        </div>
                    </div>
                </div>

                {/* Termos do Evento (FAQ) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <FileText className="w-6 h-6 text-gray-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Termos do Evento (FAQ)</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <label htmlFor="terms" className="block text-sm font-medium text-gray-700 mb-2">
                            Conteúdo do FAQ para voluntários
                        </label>
                        <textarea
                            id="terms"
                            value={termsContent}
                            onChange={e => setTermsContent(e.target.value)}
                            rows={16}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="O texto do FAQ é gerado automaticamente ao preencher os campos acima, mas pode ser editado."
                            required
                        />
                        <p className="text-xs text-gray-500 mt-2">O texto é sugerido automaticamente, mas pode ser editado pelo administrador antes de salvar.</p>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 mt-8">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
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
