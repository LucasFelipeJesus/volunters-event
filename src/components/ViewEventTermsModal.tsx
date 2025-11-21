import React from 'react'
import { X, FileText, Calendar, Check } from 'lucide-react'
import { QuestionWithOptions, UserFormResponse } from '../types/termsForm'

interface ViewEventTermsModalProps {
    isOpen: boolean
    onClose: () => void
    eventName: string
    termsContent: string
    acceptanceDate?: string | null
    questions?: QuestionWithOptions[]
    userResponses?: UserFormResponse[]
}

export const ViewEventTermsModal: React.FC<ViewEventTermsModalProps> = ({
    isOpen,
    onClose,
    eventName,
    termsContent,
    acceptanceDate,
    questions = [],
    userResponses = []
}) => {
    if (!isOpen) return null

    const formatAcceptanceDate = (dateString: string | null) => {
        if (!dateString) return 'Data não disponível'

        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Função para encontrar a resposta do usuário para uma pergunta
    const getUserResponseForQuestion = (questionId: string) => {
        return userResponses.find(response => response.questionId === questionId)
    }

    const specialUserResponses = userResponses.filter(r => typeof r.questionId === 'string' && r.questionId.startsWith('__'))

    // Função para obter o texto da opção selecionada
    const getOptionText = (question: QuestionWithOptions, optionId: string) => {
        const option = question.options.find(opt => opt.id === optionId)
        return option?.option_text || 'Opção não encontrada'
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Termos e Condições
                            </h2>
                            <p className="text-sm text-gray-600">{eventName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Fechar modal"
                        aria-label="Fechar modal"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Status de Aceitação */}
                {acceptanceDate && (
                    <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                                Termos aceitos em:
                            </span>
                            <div className="flex items-center space-x-1 text-sm text-green-700">
                                <Calendar className="w-4 h-4" />
                                <span>{formatAcceptanceDate(acceptanceDate)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Conteúdo dos Termos */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Termos e Condições */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">📜 Termos e Condições</h3>
                            <div className="text-gray-900 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-lg">
                                {termsContent}
                            </div>
                        </div>

                        {/* Perguntas e Respostas */}
                        {questions.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 Suas Respostas</h3>
                                <div className="space-y-4">
                                    {questions.map((question, index) => {
                                        const userResponse = getUserResponseForQuestion(question.id)

                                        return (
                                            <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                <div className="flex items-start space-x-2 mb-3">
                                                    <span className="text-sm font-medium text-gray-600 mt-1">
                                                        {index + 1}.
                                                    </span>
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-gray-900">
                                                            {question.question_text}
                                                            {question.is_required && (
                                                                <span className="text-red-500 ml-1">*</span>
                                                            )}
                                                        </h4>
                                                    </div>
                                                </div>

                                                {/* Exibir resposta do usuário */}
                                                <div className="ml-6">
                                                    {userResponse ? (
                                                        <>
                                                            {question.question_type === 'text' ? (
                                                                <div className="bg-white p-3 rounded border border-gray-200">
                                                                    <p className="text-gray-800 italic">
                                                                        "{userResponse.textResponse}"
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {userResponse.selectedOptions.map(optionId => (
                                                                        <div key={optionId} className="flex items-center space-x-2 bg-white p-2 rounded border border-gray-200">
                                                                            <Check className="w-4 h-4 text-green-600" />
                                                                            <span className="text-gray-800">{getOptionText(question, optionId)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="text-gray-500 italic text-sm">
                                                            Nenhuma resposta encontrada
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Espaçamento extra para garantir scroll até o final */}
                                <div className="h-8"></div>
                            </div>
                        )}

                        {/* Respostas Especiais (ex.: veículo) */}
                        {specialUserResponses.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">🚗 Informações adicionais</h3>
                                <div className="space-y-4">
                                    {specialUserResponses.map((sr) => {
                                        if (sr.questionId === '__vehicle_info') {
                                            // tentamos parsear JSON estruturado, se houver
                                            try {
                                                const parsed = sr.textResponse ? JSON.parse(sr.textResponse) : null
                                                if (parsed && typeof parsed === 'object') {
                                                    return (
                                                        <div key={sr.questionId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                            <h4 className="font-medium text-gray-900 mb-2">Veículo</h4>
                                                            <div className="text-sm text-gray-700">
                                                                {parsed.model && <div><strong>Modelo:</strong> {parsed.model}</div>}
                                                                {parsed.plate && <div><strong>Placa:</strong> {parsed.plate}</div>}
                                                                {parsed.notes && <div><strong>Observações:</strong> {parsed.notes}</div>}
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                            } catch (e) {
                                                // cai para exibir como texto cru
                                            }
                                        }

                                        // fallback: apresentar como texto simples
                                        return (
                                            <div key={sr.questionId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                <h4 className="font-medium text-gray-900 mb-2">{sr.questionId.replace('__', '')}</h4>
                                                <div className="text-sm text-gray-700">{sr.textResponse}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
