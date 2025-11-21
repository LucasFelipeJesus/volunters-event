/**
 * Códigos de erro comuns do Supabase e suas mensagens explicativas
 */

export const SupabaseErrorCodes = {
    // Erro de autorização/permissão
    '42501': {
        code: '42501',
        title: 'Permissão Insuficiente',
        message: 'Você não tem permissão para realizar esta ação',
        suggestions: [
            'Verifique se você está logado',
            'Confirme se possui o role adequado (admin/captain)',
            'Verifique as políticas RLS da tabela'
        ]
    },

    // Recurso não encontrado
    'PGRST116': {
        code: 'PGRST116',
        title: 'Recurso Não Encontrado',
        message: 'O recurso solicitado não foi encontrado',
        suggestions: [
            'Verifique se o ID está correto',
            'Confirme se o recurso existe',
            'Verifique se você tem permissão para visualizar'
        ]
    },

    // Função não encontrada
    'PGRST202': {
        code: 'PGRST202',
        title: 'Função Não Encontrada',
        message: 'A função do banco de dados não foi encontrada',
        suggestions: [
            'Execute a migration mais recente',
            'Verifique se a função foi criada corretamente',
            'Confirme se não há erros na migration'
        ]
    },

    // Violação de chave única
    '23505': {
        code: '23505',
        title: 'Conflito de Dados',
        message: 'Já existe um registro com essas informações',
        suggestions: [
            'Verifique se o email já está em uso',
            'Use informações únicas',
            'Considere atualizar em vez de criar'
        ]
    },

    // Violação de chave estrangeira
    '23503': {
        code: '23503',
        title: 'Referência Inválida',
        message: 'O registro referenciado não existe',
        suggestions: [
            'Verifique se o ID referenciado existe',
            'Confirme se o relacionamento está correto',
            'Crie o registro pai primeiro'
        ]
    },

    // Erro de validação/check constraint
    '23514': {
        code: '23514',
        title: 'Dados Inválidos',
        message: 'Os dados não atendem aos critérios de validação',
        suggestions: [
            'Verifique os valores permitidos',
            'Confirme se os dados estão no formato correto',
            'Consulte a documentação da API'
        ]
    },

    // Erro de procedure/function
    'P0001': {
        code: 'P0001',
        title: 'Erro na Função',
        message: 'Erro durante execução da função do banco',
        suggestions: [
            'Verifique os parâmetros enviados',
            'Confirme se os dados estão válidos',
            'Consulte os logs para mais detalhes'
        ]
    }
} as const

export type SupabaseErrorCode = keyof typeof SupabaseErrorCodes

interface SupabaseError {
    code?: string
    message?: string
    details?: string
    hint?: string
}

interface FormattedError {
    code: string
    title: string
    message: string
    originalMessage?: string
    suggestions: readonly string[]
    context: string
}

/**
 * Formatar erro do Supabase com mensagem explicativa
 */
export const formatSupabaseError = (error: SupabaseError, context?: string): FormattedError => {
    const errorCode = error.code as SupabaseErrorCode
    const errorInfo = SupabaseErrorCodes[errorCode]

    if (errorInfo) {
        return {
            code: errorInfo.code,
            title: errorInfo.title,
            message: errorInfo.message,
            originalMessage: error.message,
            suggestions: errorInfo.suggestions,
            context: context || 'Operação não especificada'
        }
    }

    // Erro não mapeado
    return {
        code: error.code || 'UNKNOWN',
        title: 'Erro Desconhecido',
        message: error.message || 'Erro não identificado',
        originalMessage: error.message,
        suggestions: [
            'Tente novamente em alguns momentos',
            'Verifique sua conexão com a internet',
            'Entre em contato com o suporte se persistir'
        ] as const,
        context: context || 'Operação não especificada'
    }
}

/**
 * Log formatado para erros do Supabase
 */
export const logSupabaseError = (error: SupabaseError, context: string, additionalData?: Record<string, unknown>) => {
    const formattedError = formatSupabaseError(error, context)
    // Use logger for structured output (no emojis in production)
    // Mensagem principal de erro
    // Import logger lazily to avoid circular deps in some setups
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const logger = require('./logger').default

    logger.error(`${formattedError.title}`)
    logger.error(`Contexto: ${formattedError.context}`)
    logger.error(`Código: ${formattedError.code}`)
    logger.error(`Mensagem: ${formattedError.message}`)

    if (formattedError.originalMessage !== formattedError.message) {
        logger.error(`Mensagem Original: ${formattedError.originalMessage}`)
    }

    if (additionalData) {
        logger.error('Dados Adicionais:', additionalData)
    }

    logger.info('Sugestões:')
    formattedError.suggestions.forEach((suggestion, index) => {
        logger.info(`${index + 1}. ${suggestion}`)
    })

    return formattedError
}

/**
 * Verificar se é um erro específico do Supabase
 */
export const isSupabaseError = (error: SupabaseError, code: SupabaseErrorCode): boolean => {
    return error?.code === code
}

/**
 * Mensagens de sucesso padronizadas
 */
export const SuccessMessages = {
    USER_CREATED: '✅ Usuário criado com sucesso',
    USER_UPDATED: '✅ Perfil atualizado com sucesso',
    USER_PROMOTED: '👑 Usuário promovido com sucesso',
    EVENT_CREATED: '📅 Evento criado com sucesso',
    EVENT_UPDATED: '✅ Evento atualizado com sucesso',
    TEAM_CREATED: '👥 Equipe criada com sucesso',
    TEAM_JOINED: '🤝 Entrada na equipe confirmada',
    TEAM_LEFT: '👋 Saída da equipe confirmada',
    EVALUATION_CREATED: '⭐ Avaliação registrada com sucesso',
    NOTIFICATION_SENT: '🔔 Notificação enviada',
    ADMIN_SETUP: '🎉 Administrador configurado com sucesso'
} as const
