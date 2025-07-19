// Instância global do contexto para permitir acesso externo
let globalAuthContext: Record<string, unknown> | null = null;

export function setGlobalAuthContext(context: Record<string, unknown>) {
    globalAuthContext = context;
}

export function getGlobalAuthContext() {
    return globalAuthContext;
}
