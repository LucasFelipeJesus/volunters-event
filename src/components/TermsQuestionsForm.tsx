import React from 'react'
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
    // Função para atualizar uma resposta específica
    const updateResponse = (questionId: string, selectedOptions: string[], textResponse?: string) => {
        console.log('🔄 Atualizando resposta:', { questionId, selectedOptions, textResponse })

        const updatedResponses = responses.filter(r => r.questionId !== questionId)

        if (selectedOptions.length > 0 || textResponse) {
            updatedResponses.push({
                questionId,
                selectedOptions,
                textResponse
            })
        }

        console.log('📤 Enviando respostas atualizadas:', updatedResponses)
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
