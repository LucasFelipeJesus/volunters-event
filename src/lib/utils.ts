// Utilitários compartilhados do cliente
export function filterValidUUIDs(ids: any[] | undefined | null): string[] {
    if (!Array.isArray(ids)) return []
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    const seen = new Set<string>()
    const out: string[] = []
    for (const v of ids) {
        if (typeof v !== 'string') continue
        const s = v.trim()
        if (s && uuidRe.test(s) && !seen.has(s)) {
            seen.add(s)
            out.push(s)
        }
    }
    return out
}
