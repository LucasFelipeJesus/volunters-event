import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { QuestionWithOptions, EventTermsQuestion, EventTermsQuestionOption } from '../types/termsForm'
import { Plus, Trash2, X } from 'lucide-react'

interface EventTermsManagerProps {
    eventId: string
    eventTitle: string
    onClose: () => void
    isModal?: boolean // Nova prop para controlar se deve ser modal ou inline
}

export const EventTermsManager: React.FC<EventTermsManagerProps> = ({
    eventId,
    eventTitle,
    onClose,
    isModal = true
}) => {
    const [questions, setQuestions] = useState<QuestionWithOptions[]>([])
    const [loading, setLoading] = useState(true)
    const [newQuestion, setNewQuestion] = useState<Partial<EventTermsQuestion>>({
        question_text: '',
        question_type: 'multiple_choice',
        is_required: true,
        allow_multiple: false
    })
    const [showNewQuestionForm, setShowNewQuestionForm] = useState(false)

    const loadQuestions = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('event_terms_questions')
                .select(`
          *,
          options:event_terms_question_options(*)
        `)
                .eq('event_id', eventId)
                .order('question_order')

            if (error) throw error

            const processedQuestions: QuestionWithOptions[] = (data || []).map(question => ({
                ...question,
                options: (question.options || []).sort((a: EventTermsQuestionOption, b: EventTermsQuestionOption) => a.option_order - b.option_order)
            }))

            setQuestions(processedQuestions)
        } catch (error) {
            console.error('Erro ao carregar perguntas:', error)
            alert('Erro ao carregar perguntas')
        } finally {
            setLoading(false)
        }
    }, [eventId])

    useEffect(() => {
        loadQuestions()
    }, [loadQuestions])

    const saveQuestion = async () => {
        if (!newQuestion.question_text?.trim()) {
            alert('O texto da pergunta é obrigatório')
            return
        }

        try {
            const questionOrder = questions.length + 1

            const { error: questionError } = await supabase
                .from('event_terms_questions')
                .insert({
                    event_id: eventId,
                    question_text: newQuestion.question_text,
                    question_type: newQuestion.question_type,
                    is_required: newQuestion.is_required,
                    allow_multiple: newQuestion.allow_multiple,
                    question_order: questionOrder
                })
                .select()
                .single()

            if (questionError) throw questionError

            // Resetar formulário
            setNewQuestion({
                question_text: '',
                question_type: 'multiple_choice',
                is_required: true,
                allow_multiple: false
            })
            setShowNewQuestionForm(false)

            // Recarregar perguntas
            await loadQuestions()
            alert('Pergunta criada com sucesso!')

        } catch (error) {
            console.error('Erro ao salvar pergunta:', error)
            alert('Erro ao salvar pergunta')
        }
    }

    const deleteQuestion = async (questionId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta pergunta?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('event_terms_questions')
                .delete()
                .eq('id', questionId)

            if (error) throw error

            await loadQuestions()
            alert('Pergunta excluída com sucesso!')

        } catch (error) {
            console.error('Erro ao excluir pergunta:', error)
            alert('Erro ao excluir pergunta')
        }
    }

    const addOption = async (questionId: string, optionText: string) => {
        if (!optionText.trim()) {
            alert('O texto da opção é obrigatório')
            return
        }

        try {
            const question = questions.find(q => q.id === questionId)
            const optionOrder = (question?.options?.length || 0) + 1

            const { error } = await supabase
                .from('event_terms_question_options')
                .insert({
                    question_id: questionId,
                    option_text: optionText,
                    option_value: optionText.toLowerCase().replace(/\s+/g, '_'),
                    option_order: optionOrder
                })

            if (error) throw error

            await loadQuestions()

        } catch (error) {
            console.error('Erro ao adicionar opção:', error)
            alert('Erro ao adicionar opção')
        }
    }

    const deleteOption = async (optionId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta opção?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('event_terms_question_options')
                .delete()
                .eq('id', optionId)

            if (error) throw error

            await loadQuestions()

        } catch (error) {
            console.error('Erro ao excluir opção:', error)
            alert('Erro ao excluir opção')
        }
    }

    const QuestionForm = ({ question, isNew = false }: { question: Partial<EventTermsQuestion>, isNew?: boolean }) => (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto da Pergunta
                </label>
                <textarea
                    value={question.question_text || ''}
                    onChange={(e) => isNew
                        ? setNewQuestion(prev => ({ ...prev, question_text: e.target.value }))
                        : null
                    }
                    placeholder="Digite a pergunta aqui..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Pergunta
                    </label>
                    <select
                        value={question.question_type || 'multiple_choice'}
                        onChange={(e) => isNew
                            ? setNewQuestion(prev => ({ ...prev, question_type: e.target.value as 'multiple_choice' | 'single_choice' | 'text' }))
                            : null
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        title="Tipo de pergunta"
                    >
                        <option value="multiple_choice">Múltipla Escolha</option>
                        <option value="single_choice">Escolha Única</option>
                        <option value="text">Texto Livre</option>
                    </select>
                </div>

                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={question.is_required || false}
                            onChange={(e) => isNew
                                ? setNewQuestion(prev => ({ ...prev, is_required: e.target.checked }))
                                : null
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Obrigatória</span>
                    </label>
                </div>

                {question.question_type === 'multiple_choice' && (
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={question.allow_multiple || false}
                                onChange={(e) => isNew
                                    ? setNewQuestion(prev => ({ ...prev, allow_multiple: e.target.checked }))
                                    : null
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Múltiplas Seleções</span>
                        </label>
                    </div>
                )}
            </div>

            {isNew && (
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={() => setShowNewQuestionForm(false)}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={saveQuestion}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Salvar Pergunta
                    </button>
                </div>
            )}
        </div>
    )

    const OptionManager = ({ question }: { question: QuestionWithOptions }) => {
        const [newOptionText, setNewOptionText] = useState('')

        const handleAddOption = () => {
            addOption(question.id, newOptionText)
            setNewOptionText('')
        }

        return (
            <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Opções:</h4>

                {question.options.map((option) => (
                    <div key={option.id} className="flex items-center justify-between bg-white p-2 rounded border">
                        <span className="text-sm">{option.option_text}</span>
                        <button
                            onClick={() => deleteOption(option.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir opção"
                            aria-label={`Excluir opção: ${option.option_text}`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={newOptionText}
                        onChange={(e) => setNewOptionText(e.target.value)}
                        placeholder="Nova opção..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                    />
                    <button
                        onClick={handleAddOption}
                        disabled={!newOptionText.trim()}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                        title="Adicionar opção"
                        aria-label="Adicionar nova opção"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-center mt-4">Carregando...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={isModal ? "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" : ""}>
            <div className={isModal ? "bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col" : "w-full"}>
                {/* Header - só mostrar se for modal */}
                {isModal && (
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Gerenciar Perguntas dos Termos
                            </h2>
                            <p className="text-sm text-gray-600">
                                Evento: {eventTitle}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            title="Fechar"
                            className="p-2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className={isModal ? "flex-1 overflow-y-auto p-6 space-y-6" : "w-full space-y-6"}>
                    {/* Botão para adicionar nova pergunta */}
                    {!showNewQuestionForm && (
                        <button
                            onClick={() => setShowNewQuestionForm(true)}
                            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                        >
                            <Plus className="w-6 h-6 mx-auto mb-2" />
                            Adicionar Nova Pergunta
                        </button>
                    )}

                    {/* Formulário de nova pergunta */}
                    {showNewQuestionForm && (
                        <QuestionForm question={newQuestion} isNew={true} />
                    )}

                    {/* Lista de perguntas existentes */}
                    {questions.map((question) => (
                        <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="font-medium text-gray-900 mb-2">
                                        {question.question_text}
                                    </h3>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            {question.question_type === 'multiple_choice' ? 'Múltipla Escolha' :
                                                question.question_type === 'single_choice' ? 'Escolha Única' : 'Texto Livre'}
                                        </span>
                                        {question.is_required && (
                                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                                                Obrigatória
                                            </span>
                                        )}
                                        {question.allow_multiple && (
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                                Múltiplas Seleções
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteQuestion(question.id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Excluir pergunta"
                                    aria-label={`Excluir pergunta: ${question.question_text}`}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Gerenciador de opções para perguntas de múltipla escolha */}
                            {(question.question_type === 'multiple_choice' || question.question_type === 'single_choice') && (
                                <OptionManager question={question} />
                            )}
                        </div>
                    ))}

                    {questions.length === 0 && !showNewQuestionForm && (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-lg font-medium mb-2">Nenhuma pergunta criada</p>
                            <p>Adicione perguntas para coletar informações dos voluntários</p>
                        </div>
                    )}
                </div>

                {/* Footer - só mostrar se for modal */}
                {isModal && (
                    <div className="p-6 border-t border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">
                                {questions.length} pergunta(s) configurada(s)
                            </p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Concluído
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
