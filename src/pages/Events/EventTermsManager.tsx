import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, FileText, AlertCircle, CheckCircle, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { EventTermsManager as QuestionsManager } from '../../components/EventTermsManager'

interface Event {
    id: string
    title: string
    status: string
}

interface EventTerms {
    id: string
    event_id: string
    terms_content: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export const EventTermsManager: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [event, setEvent] = useState<Event | null>(null)
    const [terms, setTerms] = useState<EventTerms | null>(null)
    const [termsContent, setTermsContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [showQuestions, setShowQuestions] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    useEffect(() => {
        const fetchEventAndTerms = async () => {
            try {
                setLoading(true)

                // Buscar evento
                const { data: eventData, error: eventError } = await supabase
                    .from('events')
                    .select('id, title, status')
                    .eq('id', eventId)
                    .single()

                if (eventError) throw eventError
                setEvent(eventData)

                // Buscar termos existentes
                const { data: termsData, error: termsError } = await supabase
                    .from('event_terms')
                    .select('*')
                    .eq('event_id', eventId)
                    .eq('is_active', true)
                    .maybeSingle()

                if (termsError && termsError.code !== 'PGRST116') {
                    throw termsError
                }

                if (termsData) {
                    setTerms(termsData)
                    setTermsContent(termsData.terms_content)
                } else {
                    // Definir conteúdo padrão baseado no exemplo fornecido
                    setTermsContent(getDefaultTermsContent(eventData.title))
                    setHasUnsavedChanges(true) // Marca como não salvo porque é conteúdo novo
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error)
                setMessage({
                    type: 'error',
                    text: 'Erro ao carregar dados do evento. Tente novamente.'
                })
            } finally {
                setLoading(false)
            }
        }

        if (eventId) {
            fetchEventAndTerms()
        }
    }, [eventId])

    const getDefaultTermsContent = (eventName: string) => {
        return `Olá! Obrigado por seu interesse em participar do evento "${eventName}".

Leia com atenção essas informações e ao final responda se concorda com todas as premissas do evento.

Aqui estão algumas informações preliminares:

1. Existe algum tipo de ajuda de custo?
Infelizmente não há ajuda de custo para esse tipo de evento.

1.1 O que o voluntário ganha em ir?
Um ingresso cortesia que poderá ser concedido à um acompanhante ou vendido com intenção de ajudar nos custos de locomoção, estadia, etc (venda sob total responsabilidade do voluntário). Em caso de não comparecimento, o ingresso é automaticamente cancelado.
Além disso, terá a oportunidade de aprender e colocar em prática os conhecimentos adquiridos. Poderá divulgar seu nome ou marca (fotos liberadas). Fará um incrível network entre os envolvidos, experiência, amizades e ao final uma divertida confraternização.

2. Qual a jornada de trabalho?
Normalmente de 8 a 12 horas, dependendo da função que ficar alocado.

3. É possível desconto na compra de ingressos?
Não temos descontos ou qualquer outro tipo de bonificação em relação à ingressos.

4. O que terei que fazer?
Todos os voluntários passarão por todas as etapas dentro da função de trabalho designada.

5. O que preciso levar?
É necessário que cada voluntário leve seus utensílios essenciais conforme orientação da equipe. Todos esses itens são de responsabilidade pessoal. Cuide para não perdê-los!

6. Posso me alimentar durante o trabalho?
Sim. A alimentação fica à disposição para todos os voluntários durante o trabalho.

7. Posso beber bebida alcoólica?
Não! Trabalhamos em regime de lei seca. Ao término do evento temos nossa confraternização onde todos poderão ingerir bebida alcoólica e se divertir!

8. Posso sair da minha função para assistir ao show?
Não. Precisamos manter as atividades em andamento até o final do evento. Dependendo do movimento, seu supervisor avisará sobre essa possibilidade.

9. Local do evento
Será divulgado no grupo de voluntários.

10. Responsabilidades
Lembramos que cada voluntário é responsável pela sua condição física e segurança pessoal.

11. AUTORIZAÇÃO DE USO DE IMAGEM
AUTORIZO o uso de minha imagem, em fotos e/ ou vídeos, sem finalidade comercial, para ser utilizada nos trabalhos desenvolvidos no âmbito do evento Churrasco On fire. A presente autorização é concedida a título gratuito, abrangendo o uso da imagem em todo território nacional e no exterior, sempre para fins de divulgação do evento. Por esta ser a expressão da minha vontade, declaro que autorizo o uso acima descrito sem que nada haja a ser reclamado a título de direitos conexos à minha imagem ou a qualquer outro.

Lembramos que cada voluntário é responsável pela sua condição física e não nos responsabilizamos por acidentes com facas, fogo, etc.

Mais informações serão compartilhadas com os voluntários confirmados.

Obrigado pelo seu interesse em estar conosco!`
    }


    const handleTermsContentChange = (newContent: string) => {
        setTermsContent(newContent)
        // Marca como não salvo se o conteúdo mudou em relação ao original
        const originalContent = terms?.terms_content || ''
        setHasUnsavedChanges(newContent !== originalContent)
    }

    const handleSave = async () => {
        if (!eventId || !user) return

        try {
            setSaving(true)
            setMessage(null)

            if (terms) {
                // Atualizar termos existentes
                const { error } = await supabase
                    .from('event_terms')
                    .update({
                        terms_content: termsContent,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', terms.id)

                if (error) throw error
            } else {
                // Criar novos termos
                const { data, error } = await supabase
                    .from('event_terms')
                    .insert({
                        event_id: eventId,
                        terms_content: termsContent,
                        is_active: true,
                        created_by: user.id
                    })
                    .select()
                    .single()

                if (error) throw error
                setTerms(data)
            }

            setMessage({
                type: 'success',
                text: 'Termos salvos com sucesso!'
            })

            setHasUnsavedChanges(false) // Marca como salvo

        } catch (error) {
            console.error('Erro ao salvar termos:', error)
            setMessage({
                type: 'error',
                text: 'Erro ao salvar termos. Tente novamente.'
            })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando...</p>
                </div>
            </div>
        )
    }

    if (!event) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Evento não encontrado</h2>
                <p className="text-gray-600 mb-4">O evento solicitado não foi encontrado.</p>
                <button
                    onClick={() => navigate('/events')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Voltar aos Eventos
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/events')}
                        title="Voltar aos eventos"
                        className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                            <FileText className="w-6 h-6 text-blue-600" />
                            <span>Termos e Condições</span>
                        </h1>
                        <p className="text-gray-600">Evento: {event.title}</p>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        <button
                            onClick={() => setShowQuestions(false)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${!showQuestions
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <FileText className="w-4 h-4 inline mr-2" />
                            Texto dos Termos
                            {hasUnsavedChanges && (
                                <span className="ml-1 inline-block w-2 h-2 bg-orange-500 rounded-full"></span>
                            )}
                        </button>
                        <button
                            onClick={() => setShowQuestions(true)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${showQuestions
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <Plus className="w-4 h-4 inline mr-2" />
                            Perguntas do Formulário
                        </button>
                    </nav>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="w-5 h-5" />
                    ) : (
                        <AlertCircle className="w-5 h-5" />
                    )}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Content */}
            {!showQuestions ? (
                // Aba de Termos
                <>
                    <div className="bg-white rounded-lg shadow border border-gray-200">
                        <div className="p-6">
                            <div className="mb-4">
                                <label htmlFor="terms-content" className="block text-sm font-medium text-gray-700 mb-2">
                                    Conteúdo dos Termos e Condições
                                </label>
                                <p className="text-sm text-gray-600 mb-4">
                                    Este conteúdo será exibido para os voluntários no momento da inscrição no evento.
                                    Eles precisarão ler e aceitar estes termos para confirmar sua participação.
                                </p>
                            </div>

                            <textarea
                                id="terms-content"
                                value={termsContent}
                                onChange={(e) => handleTermsContentChange(e.target.value)}
                                rows={20}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                placeholder="Digite os termos e condições do evento..."
                            />

                            <div className="mt-4 text-sm text-gray-500">
                                <p>
                                    <strong>Dica:</strong> Use quebras de linha para organizar o conteúdo.
                                    O texto será exibido exatamente como digitado aqui.
                                </p>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !termsContent.trim()}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${saving || !termsContent.trim()
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : hasUnsavedChanges
                                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    <Save className="w-4 h-4" />
                                    <span>
                                        {saving
                                            ? 'Salvando...'
                                            : hasUnsavedChanges
                                                ? 'Salvar Alterações'
                                                : 'Salvar Termos'
                                        }
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {termsContent.trim() && (
                        <div className="mt-6 bg-white rounded-lg shadow border border-gray-200">
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    Pré-visualização (como o voluntário verá)
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm">
                                        {termsContent}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                // Aba de Perguntas
                <div className="bg-white rounded-lg shadow border border-gray-200">
                    <div className="p-6">
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Perguntas do Formulário
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                                Configure perguntas que os voluntários devem responder junto com a aceitação dos termos.
                                Perguntas obrigatórias impedirão a inscrição se não forem respondidas.
                            </p>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">
                                            Como funciona a validação:
                                        </p>
                                        <div className="text-sm text-amber-700 mt-1 space-y-1">
                                            <p>• <strong>Sem perguntas obrigatórias:</strong> Voluntários só precisam aceitar os termos</p>
                                            <p>• <strong>Com perguntas obrigatórias:</strong> Voluntários devem responder todas para se inscrever</p>
                                            <p>• <strong>Lembre-se:</strong> Salve os termos na aba "Texto dos Termos" antes de finalizar</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {eventId && event && (
                            <QuestionsManager
                                eventId={eventId}
                                eventTitle={event.title}
                                onClose={() => { }}
                                isModal={false}
                            />
                        )}

                        {/* Botão para salvar termos também na aba de perguntas */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    <p className="font-medium mb-1">
                                        {hasUnsavedChanges ? '⚠️ Termos não salvos!' : '✅ Termos salvos'}
                                    </p>
                                    <p>As perguntas são salvas automaticamente, mas os termos precisam ser salvos separadamente.</p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !termsContent.trim()}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${saving || !termsContent.trim()
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : hasUnsavedChanges
                                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                >
                                    <Save className="w-4 h-4" />
                                    <span>
                                        {saving
                                            ? 'Salvando...'
                                            : hasUnsavedChanges
                                                ? 'Salvar Alterações'
                                                : 'Termos Salvos'
                                        }
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
