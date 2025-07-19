// Types para o sistema de formulários dos termos
// Criado em: 18/07/2025
// Propósito: Definir tipos para perguntas e respostas dos termos dos eventos

export interface EventTermsQuestion {
    id: string
    event_id: string
    question_text: string
    question_type: 'multiple_choice' | 'single_choice' | 'text'
    is_required: boolean
    allow_multiple: boolean // Para múltipla escolha, permitir múltiplas seleções
    question_order: number
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string
    options?: EventTermsQuestionOption[]
}

export interface EventTermsQuestionOption {
    id: string
    question_id: string
    option_text: string
    option_value: string // Valor interno para processamento
    option_order: number
    is_active: boolean
    created_at: string
}

export interface EventTermsResponse {
    id: string
    user_id: string
    event_id: string
    question_id: string
    selected_options: string[] // Array de option_ids selecionadas
    text_response?: string // Para perguntas de texto livre
    responded_at: string
}

// Tipos para o formulário de resposta
export interface QuestionFormData {
    [questionId: string]: {
        question_type: string
        selected_options: string[]
        text_response?: string
    }
}

// Tipo para a validação das respostas
export interface ValidationResult {
    isValid: boolean
    errors: string[]
}

// Tipo para a pergunta com suas opções (usado na interface)
export interface QuestionWithOptions extends EventTermsQuestion {
    options: EventTermsQuestionOption[]
}

// Tipo para o modal de termos com formulário
export interface TermsModalData {
    isOpen: boolean
    eventId: string
    eventName: string
    termsContent: string
    questions: QuestionWithOptions[]
    loading: boolean
}

// Tipo para dados do usuário no formulário (usado na resposta)
export interface UserFormResponse {
    questionId: string
    selectedOptions: string[]
    textResponse?: string
}
