// Utilitários para normalizar números e gerar links do WhatsApp
import { parsePhoneNumberFromString } from 'libphonenumber-js'

function detectCountryFromLocaleIso(): string | null {
    try {
        const locale = navigator.language || (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().locale) || ''
        if (!locale) return null
        const parts = locale.split('-')
        if (parts.length > 1) {
            return parts[1].toUpperCase()
        }
    } catch (e) {
        // ignore
    }
    return null
}

export function normalizeDigits(phone?: string): string {
    if (!phone) return ''
    return phone.replace(/\D/g, '').replace(/^0+/, '')
}

export function formatWhatsappLink(phone?: string, opts?: { message?: string, eventLocation?: string }): string {
    if (!phone) return '#'

    // First try libphonenumber-js to parse and produce E.164
    try {
        // Try parsing without default country
        let parsed = parsePhoneNumberFromString(phone)
        if (!parsed || !parsed.isValid()) {
            // Try with locale-derived country
            const localeCountry = detectCountryFromLocaleIso()
            if (localeCountry) {
                parsed = parsePhoneNumberFromString(phone, localeCountry)
            }
        }

        if (parsed && parsed.isValid()) {
            // parsed.number is in E.164 like +5511999998888
            const e164 = parsed.number.replace(/^\+/, '')
            const base = `https://wa.me/${e164}`
            if (opts?.message) return `${base}?text=${encodeURIComponent(opts.message)}`
            return base
        }
    } catch (e) {
        // ignore and fallback
        console.warn('libphonenumber parse failed, falling back to heuristics', e)
    }

    // Fallback: simple normalization and assume BR if not specified
    const digits = normalizeDigits(phone)
    if (!digits) return '#'
    let normalized = digits
    if (!normalized.startsWith('55') && !normalized.startsWith('1') && !normalized.startsWith('44')) {
        // If locale suggests a country, try to prefix its calling code
        const localeCountry = detectCountryFromLocaleIso()
        if (localeCountry === 'BR') normalized = '55' + normalized
        if (localeCountry === 'PT') normalized = '351' + normalized
        // otherwise fallback to BR
        if (!normalized.startsWith('55') && !normalized.startsWith('1') && !normalized.startsWith('44')) {
            normalized = '55' + normalized
        }
    }
    const base = `https://wa.me/${normalized}`
    if (opts?.message) return `${base}?text=${encodeURIComponent(opts.message)}`
    return base
}

export default {
    normalizeDigits,
    formatWhatsappLink
}
