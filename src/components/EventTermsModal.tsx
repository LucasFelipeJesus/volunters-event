import React, { useState, useEffect } from 'react'
import { X, FileText, AlertCircle } from 'lucide-react'
import { TermsQuestionsForm } from './TermsQuestionsForm'
import { QuestionWithOptions, UserFormResponse } from '../types/termsForm'

interface EventTermsModalProps {
    isOpen: boolean
    onClose: () => void
    onAccept: (responses: UserFormResponse[]) => void
    eventName: string
    termsContent: string
    questions?: QuestionWithOptions[]
    loading?: boolean
}

export const EventTermsModal: React.FC<EventTermsModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    eventName,
    termsContent,
    questions = [],
    loading = false
}) => {
    const [hasAccepted, setHasAccepted] = useState(false)
    const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false)
    const [formResponses, setFormResponses] = useState<UserFormResponse[]>([])
    // Form só é válido inicialmente se não há perguntas obrigatórias
    const [formIsValid, setFormIsValid] = useState(questions.filter(q => q.is_required).length === 0)
    const [formErrors, setFormErrors] = useState<string[]>([])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget

        // Calcula a área de scroll disponível
        const scrollableHeight = scrollHeight - clientHeight
        const scrollPercentage = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 100

        console.log('Scroll event:', {
            scrollTop,
            scrollHeight,
            clientHeight,
            scrollableHeight,
            percentage: scrollPercentage.toFixed(1) + '%',
            hasReachedEnd: scrollPercentage >= 90
        })

        // Usuário deve rolar até pelo menos 90% do conteúdo ou chegar ao final
        const hasReachedEnd = scrollPercentage >= 90 || scrollTop + clientHeight >= scrollHeight - 5
        if (hasReachedEnd) {
            console.log('Chegou ao final do scroll - habilitando aceitação')
            setHasScrolledToEnd(true)
        }
    }

    // Reset estados quando modal abre
    useEffect(() => {
        if (isOpen) {
            console.log('Modal aberto - resetando estados')
            setHasAccepted(false)
            setHasScrolledToEnd(false)
            setFormResponses([])
            setFormIsValid(questions.filter(q => q.is_required).length === 0)
            setFormErrors([])
        }
    }, [isOpen, questions])

    // Validação do formulário quando respostas ou perguntas mudam
    useEffect(() => {
        console.log('🔍 Validando formulário:', {
            questionsLength: questions.length,
            responsesLength: formResponses.length,
            questions: questions.map(q => ({ id: q.id, text: q.question_text, required: q.is_required })),
            responses: formResponses
        })

        const requiredQuestions = questions.filter(q => q.is_required)

        if (requiredQuestions.length === 0) {
            console.log('✅ Nenhuma pergunta obrigatória - formulário válido')
            setFormIsValid(true)
            setFormErrors([])
            return
        }

        const errors: string[] = []
        const answeredQuestionIds = new Set(formResponses.map(r => r.questionId))

        requiredQuestions.forEach(question => {
            if (!answeredQuestionIds.has(question.id)) {
                errors.push(`Pergunta obrigatória não respondida: ${question.question_text}`)
            } else {
                const response = formResponses.find(r => r.questionId === question.id)
                if (response) {
                    if (question.question_type === 'text' && (!response.textResponse || response.textResponse.trim() === '')) {
                        errors.push(`Resposta de texto obrigatória: ${question.question_text}`)
                    } else if (['multiple_choice', 'single_choice'].includes(question.question_type) &&
                        (!response.selectedOptions || response.selectedOptions.length === 0)) {
                        errors.push(`Seleção obrigatória: ${question.question_text}`)
                    }
                }
            }
        })

        console.log('🚨 Erros de validação:', errors)
        console.log('📝 Formulário válido:', errors.length === 0)

        setFormErrors(errors)
        setFormIsValid(errors.length === 0)
    }, [questions, formResponses])

    const handleFormChange = (responses: UserFormResponse[]) => {
        console.log('📝 Atualizando respostas do formulário:', responses)
        setFormResponses(responses)
    }

    const handleAccept = () => {
        console.log('🎯 Tentativa de aceitar:', {
            hasAccepted,
            hasScrolledToEnd,
            formIsValid,
            formErrors,
            formResponses
        })

        if (hasAccepted && hasScrolledToEnd && formIsValid) {
            console.log('✅ Aceitando termos e enviando respostas')
            onAccept(formResponses)
        } else {
            console.log('❌ Condições não atendidas para aceitar')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Termos e Condições
                            </h2>
                            <p className="text-sm text-gray-600">
                                Evento: {eventName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        title="Fechar"
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content - Altura fixa para garantir scroll funcione */}
                <div className="h-[500px] overflow-hidden border-t border-b border-gray-200">
                    <div
                        className="terms-content-scroll h-full p-6 overflow-y-auto bg-gray-50"
                        onScroll={handleScroll}
                    >
                        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
                            {/* Termos e Condições */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">📜 Termos e Condições</h3>
                                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm">
                                    {termsContent}
                                </div>
                            </div>

                            {/* Formulário de Perguntas */}
                            {questions.length > 0 && (
                                <TermsQuestionsForm
                                    questions={questions}
                                    responses={formResponses}
                                    onChange={handleFormChange}
                                />
                            )}

                            {/* Espaçamento extra para garantir scroll - altura maior com formulário */}
                            <div className={`flex items-center justify-center text-gray-500 text-sm mt-8 border-t pt-4 ${questions.length > 0 ? 'h-32' : 'h-20'
                                }`}>
                                ↑ Certifique-se de ter lido todo o conteúdo e respondido as perguntas acima ↑
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alert for scrolling and form validation */}
                {(!hasScrolledToEnd || !formIsValid) && (
                    <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
                        <div className="space-y-2">
                            {!hasScrolledToEnd && (
                                <div className="flex items-center space-x-2 text-amber-800">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm font-medium">
                                        Você deve rolar e ler todo o conteúdo acima para continuar
                                    </span>
                                </div>
                            )}

                            {!formIsValid && formErrors.length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-2 text-amber-800">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="text-sm font-medium">
                                            Complete o formulário:
                                        </span>
                                    </div>
                                    {formErrors.map((error, index) => (
                                        <div key={index} className="text-sm text-amber-700 ml-6">
                                            • {error}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="space-y-4">
                        <label className="flex items-start space-x-3">
                            <input
                                type="checkbox"
                                checked={hasAccepted}
                                onChange={(e) => setHasAccepted(e.target.checked)}
                                disabled={!hasScrolledToEnd}
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                            />
                            <span className={`text-sm ${!hasScrolledToEnd ? 'text-gray-400' : 'text-gray-700'}`}>
                                Li e concordo com todos os termos e condições apresentados acima.
                                Entendo que minha participação está condicionada ao cumprimento
                                dessas diretrizes.
                            </span>
                        </label>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAccept}
                                disabled={!hasAccepted || !hasScrolledToEnd || !formIsValid || loading}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors ${hasAccepted && hasScrolledToEnd && formIsValid && !loading
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {loading ? 'Processando...' : 'Aceitar e Continuar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
