import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { userService } from '../lib/services'
import logger from '../lib/logger'
import { QuestionWithOptions, UserFormResponse } from '../types/termsForm'

interface TermsQuestionsFormProps {
    questions: QuestionWithOptions[]
    responses: UserFormResponse[]
    onChange: (responses: UserFormResponse[]) => void
    onValidation?: (isValid: boolean, errors: string[]) => void
}

export const TermsQuestionsForm: React.FC<TermsQuestionsFormProps> = ({
    questions,
    responses,
    onChange,
    onValidation
}) => {
    const { user } = useAuth()

    // Estado para pergunta fixa de veículo
    const [willGoByVehicle, setWillGoByVehicle] = useState<boolean | null>(null)
    const [vehicleSource, setVehicleSource] = useState<'profile' | 'manual'>('profile')
    const [manualModel, setManualModel] = useState('')
    const [manualPlate, setManualPlate] = useState('')
    const [profileModelFallback, setProfileModelFallback] = useState<string | null>(null)
    const [profilePlateFallback, setProfilePlateFallback] = useState<string | null>(null)

    // Helper: procura o campo de veículo em várias possíveis estruturas do objeto `user`
    const getUserField = (u: any, field: string) => {
        if (!u) return null
        if (u[field]) return u[field]
        if (u.profile && u.profile[field]) return u.profile[field]
        if (u.user_metadata && u.user_metadata[field]) return u.user_metadata[field]
        return null
    }

    // Sincroniza estado da pergunta fixa com respostas iniciais e com o usuário
    // Nota: não sobrescreveremos a escolha do usuário se não houver resposta existente,
    // para evitar que cliques sejam revertidos por efeitos de sincronização.
    useEffect(() => {
        const existing = responses.find(r => r.questionId === '__vehicle_info')
        if (existing && existing.textResponse) {
            try {
                const parsed = JSON.parse(existing.textResponse)
                setWillGoByVehicle(true)
                if (parsed.source === 'profile') {
                    setVehicleSource('profile')
                } else {
                    setVehicleSource('manual')
                    setManualModel(parsed.model || '')
                    setManualPlate(parsed.plate || '')
                }
            } catch (e) {
                // texto livre anterior — preencher como manual
                setWillGoByVehicle(true)
                setVehicleSource('manual')
                setManualModel(existing.textResponse)
            }
        }
        // se não existir resposta, não alteramos willGoByVehicle (permitir interação do usuário)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [responses, user])

    // Atualiza resposta fixa de veículo no array de respostas
    useEffect(() => {
        // Evitar loop de render: somente chamar onChange/updateResponse quando o
        // payload efetivamente mudar em relação ao que já existe em `responses`.
        if (willGoByVehicle === null) {
            // chamar validação para forçar usuário a responder esta pergunta (obrigatória)
            validateForm(responses)
            return
        }

        if (!willGoByVehicle) {
            // remover resposta se existir
            const updated = responses.filter(r => r.questionId !== '__vehicle_info')
            // Só atualizar se houver diferença
            if (updated.length !== responses.length) {
                onChange(updated)
                validateForm(updated)
            } else {
                validateForm(updated)
            }
            return
        }

        // montar payload
        let payload: any = { source: vehicleSource }
        if (vehicleSource === 'profile') {
            // prioriza campos do AuthContext, mas utiliza fallback buscado se necessário
            payload.model = getUserField(user, 'vehicle_model') || profileModelFallback || ''
            payload.plate = getUserField(user, 'vehicle_plate') || profilePlateFallback || ''
        } else {
            payload.model = manualModel
            payload.plate = manualPlate
        }

        const payloadText = JSON.stringify(payload)
        const existing = responses.find(r => r.questionId === '__vehicle_info')

        // Se já existe uma resposta igual, não reenvia para evitar loop
        if (existing && existing.textResponse === payloadText) {
            // apenas revalida
            validateForm(responses)
            return
        }

        updateResponse('__vehicle_info', [], payloadText)
        // Não incluir `responses` nas deps para evitar que onChange -> responses -> efeito -> onChange cause loop
    }, [willGoByVehicle, vehicleSource, manualModel, manualPlate, user, profileModelFallback, profilePlateFallback])

    // Se usuário selecionar usar veículo do perfil, mas os campos estão vazios,
    // buscar profile atualizado diretamente no serviço para tentar recuperar model/plate.
    useEffect(() => {
        const getUserField = (u: any, field: string) => {
            if (!u) return null
            if (u[field]) return u[field]
            if (u.profile && u.profile[field]) return u.profile[field]
            if (u.user_metadata && u.user_metadata[field]) return u.user_metadata[field]
            return null
        }

        const hasModelInUser = Boolean(getUserField(user, 'vehicle_model'))
        const hasPlateInUser = Boolean(getUserField(user, 'vehicle_plate'))

        const shouldFetchProfile = willGoByVehicle && vehicleSource === 'profile' && user && !(hasModelInUser && hasPlateInUser)
        if (!shouldFetchProfile) return

        let mounted = true
            ; (async () => {
                try {
                    const profile = await userService.getProfile((user as any).id)
                    if (!mounted) return
                    if (profile) {
                        const model = (profile as any).vehicle_model || (profile as any).profile?.vehicle_model || (profile as any).user_metadata?.vehicle_model || null
                        const plate = (profile as any).vehicle_plate || (profile as any).profile?.vehicle_plate || (profile as any).user_metadata?.vehicle_plate || null
                        setProfileModelFallback(model)
                        setProfilePlateFallback(plate)
                        logger.info('💡 vehicle fallback loaded from userService:', { model, plate })
                    }
                } catch (e) {
                    logger.warn('Não foi possível buscar profile fallback:', e)
                }
            })()

        return () => { mounted = false }
    }, [willGoByVehicle, vehicleSource, user])

    // Função para atualizar uma resposta específica
    const updateResponse = (questionId: string, selectedOptions: string[], textResponse?: string) => {
        logger.debug('Atualizando resposta:', { questionId, selectedOptions, textResponse })

        const updatedResponses = responses.filter(r => r.questionId !== questionId)

        if (selectedOptions.length > 0 || textResponse) {
            updatedResponses.push({
                questionId,
                selectedOptions,
                textResponse
            })
        }

        logger.debug('📤 Enviando respostas atualizadas:', updatedResponses)
        onChange(updatedResponses)
        validateForm(updatedResponses)
    }

    // Validar formulário
    const validateForm = (currentResponses: UserFormResponse[]) => {
        const errors: string[] = []

        questions.forEach(question => {
            if (question.is_required) {
                const response = currentResponses.find(r => r.questionId === question.id)

                if (!response) {
                    errors.push(`A pergunta "${question.question_text}" é obrigatória`)
                } else if (question.question_type === 'text') {
                    if (!response.textResponse?.trim()) {
                        errors.push(`A pergunta "${question.question_text}" requer uma resposta em texto`)
                    }
                } else {
                    if (response.selectedOptions.length === 0) {
                        errors.push(`A pergunta "${question.question_text}" requer pelo menos uma opção selecionada`)
                    }
                }
            }
        })

        // Validação da pergunta fixa de veículo (obrigatória)
        if (willGoByVehicle === null) {
            errors.push('Informe se irá de veículo ao evento (Sim / Não / Prefiro não informar)')
        } else if (willGoByVehicle) {
            if (vehicleSource === 'profile') {
                const modelVal = getUserField(user, 'vehicle_model') || profileModelFallback || ''
                const plateVal = getUserField(user, 'vehicle_plate') || profilePlateFallback || ''
                const hasModel = Boolean(modelVal && modelVal.trim())
                const hasPlate = Boolean(plateVal && plateVal.trim())
                if (!hasModel || !hasPlate) {
                    errors.push('Seu perfil não possui modelo e/ou placa. Selecione "Inserir manualmente" ou atualize seu perfil.')
                }
            } else {
                if (!manualModel.trim() || !manualPlate.trim()) {
                    errors.push('Preencha modelo e placa do veículo quando escolher inserir manualmente.')
                }
            }
        }

        onValidation?.(errors.length === 0, errors)
    }

    // Obter resposta atual para uma pergunta
    const getCurrentResponse = (questionId: string): UserFormResponse | undefined => {
        return responses.find(r => r.questionId === questionId)
    }

    // Renderizar pergunta de múltipla escolha
    const renderMultipleChoiceQuestion = (question: QuestionWithOptions) => {
        const currentResponse = getCurrentResponse(question.id)
        const selectedOptions = currentResponse?.selectedOptions || []

        const handleOptionChange = (optionId: string, checked: boolean) => {
            let newSelectedOptions: string[]

            if (question.allow_multiple) {
                // Múltiplas seleções permitidas
                if (checked) {
                    newSelectedOptions = [...selectedOptions, optionId]
                } else {
                    newSelectedOptions = selectedOptions.filter((id: string) => id !== optionId)
                }
            } else {
                // Apenas uma seleção permitida
                if (checked) {
                    newSelectedOptions = [optionId]
                } else {
                    newSelectedOptions = []
                }
            }

            updateResponse(question.id, newSelectedOptions)
        }

        return (
            <div className="space-y-3">
                {question.options.map((option) => {
                    const isSelected = selectedOptions.includes(option.id)
                    const inputType = question.allow_multiple ? 'checkbox' : 'radio'
                    const inputName = `question_${question.id}`

                    return (
                        <label
                            key={option.id}
                            className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <input
                                type={inputType}
                                name={inputName}
                                value={option.id}
                                checked={isSelected}
                                onChange={(e) => handleOptionChange(option.id, e.target.checked)}
                                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                                <span className="text-gray-900 font-medium">{option.option_text}</span>
                            </div>
                        </label>
                    )
                })}
            </div>
        )
    }

    // Renderizar pergunta de texto livre
    const renderTextQuestion = (question: QuestionWithOptions) => {
        const currentResponse = getCurrentResponse(question.id)
        const textValue = currentResponse?.textResponse || ''

        const handleTextChange = (value: string) => {
            updateResponse(question.id, [], value)
        }

        return (
            <div>
                <textarea
                    value={textValue}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Digite sua resposta aqui..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                />
            </div>
        )
    }

    if (questions.length === 0) {
        return null
    }

    return (
        <div className="space-y-6">
            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📋 Informações Adicionais
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                    Por favor, responda às perguntas abaixo para ajudar na organização do evento:
                </p>
            </div>

            {/* Pergunta fixa: Vai de veículo? */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-base font-medium text-gray-900 mb-2">Vai de veículo ao evento?</h4>
                <div className="flex items-center space-x-4 mb-3">
                    <label className={`inline-flex items-center cursor-pointer`}>
                        <input type="radio" name="will_go_vehicle" checked={willGoByVehicle === true} onChange={() => setWillGoByVehicle(true)} className="mr-2" />
                        <span>Sim</span>
                    </label>
                    <label className={`inline-flex items-center cursor-pointer`}>
                        <input type="radio" name="will_go_vehicle" checked={willGoByVehicle === false} onChange={() => setWillGoByVehicle(false)} className="mr-2" />
                        <span>Não</span>
                    </label>
                    <label className={`inline-flex items-center cursor-pointer`}>
                        <input type="radio" name="will_go_vehicle" checked={willGoByVehicle === null} onChange={() => setWillGoByVehicle(null)} className="mr-2" />
                        <span>Prefiro não informar</span>
                    </label>
                </div>

                {willGoByVehicle && (
                    <div className="mt-3 space-y-3">
                        <p className="text-sm text-gray-600">Como gostaria de informar o veículo?</p>
                        <div className="flex items-center space-x-4">
                            <label className="inline-flex items-center">
                                <input type="radio" name="vehicle_source" checked={vehicleSource === 'profile'} onChange={() => setVehicleSource('profile')} className="mr-2" />
                                <span>Usar veículo do meu perfil</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" name="vehicle_source" checked={vehicleSource === 'manual'} onChange={() => setVehicleSource('manual')} className="mr-2" />
                                <span>Inserir manualmente</span>
                            </label>
                        </div>

                        {vehicleSource === 'profile' ? (
                            <div className="text-sm text-gray-700">
                                <p>Modelo: <strong>{getUserField(user, 'vehicle_model') || profileModelFallback || 'Não informado'}</strong></p>
                                <p>Placa: <strong>{getUserField(user, 'vehicle_plate') || profilePlateFallback || 'Não informado'}</strong></p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Modelo do veículo</label>
                                    <input type="text" value={manualModel} onChange={(e) => setManualModel(e.target.value)} placeholder="Ex: Honda Civic" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
                                    <input type="text" value={manualPlate} onChange={(e) => setManualPlate(e.target.value)} placeholder="ABC-1234" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {questions
                .filter(q => q.is_active)
                .sort((a, b) => a.question_order - b.question_order)
                .map((question) => (
                    <div key={question.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="mb-4">
                            <h4 className="text-base font-medium text-gray-900 mb-1">
                                {question.question_text}
                                {question.is_required && (
                                    <span className="text-red-500 ml-1">*</span>
                                )}
                            </h4>

                            {question.question_type === 'multiple_choice' && question.allow_multiple && (
                                <p className="text-sm text-gray-500">
                                    Você pode selecionar múltiplas opções
                                </p>
                            )}

                            {question.question_type === 'single_choice' && (
                                <p className="text-sm text-gray-500">
                                    Selecione apenas uma opção
                                </p>
                            )}
                        </div>

                        {question.question_type === 'text' ? (
                            renderTextQuestion(question)
                        ) : (
                            renderMultipleChoiceQuestion(question)
                        )}
                    </div>
                ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                    <div className="text-blue-600 mt-0.5">ℹ️</div>
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Importante:</p>
                        <p>
                            Suas respostas ajudarão na organização e distribuição das atividades.
                            As informações não garantem alocação específica, servem apenas como indicativo
                            de preferências para melhor planejamento do evento.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
