import { useState } from 'react'

interface ViaCEPResponse {
    cep: string
    logradouro: string
    complemento: string
    bairro: string
    localidade: string
    uf: string
    ibge: string
    gia: string
    ddd: string
    siafi: string
    erro?: boolean
}

interface AddressData {
    address: string
    city: string
    state: string
    neighborhood?: string
}

export const useCEPLookup = () => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const lookupCEP = async (cep: string): Promise<AddressData | null> => {
        // Limpar CEP (remover caracteres não numéricos)
        const cleanCEP = cep.replace(/\D/g, '')

        // Validar formato do CEP
        if (cleanCEP.length !== 8) {
            setError('CEP deve conter 8 dígitos')
            return null
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)

            if (!response.ok) {
                throw new Error('Erro na consulta do CEP')
            }

            const data: ViaCEPResponse = await response.json()

            if (data.erro) {
                setError('CEP não encontrado')
                return null
            }

            // Montar endereço completo
            let fullAddress = ''
            if (data.logradouro) {
                fullAddress = data.logradouro
                if (data.bairro) {
                    fullAddress += `, ${data.bairro}`
                }
            } else if (data.bairro) {
                fullAddress = data.bairro
            }

            return {
                address: fullAddress,
                city: data.localidade,
                state: data.uf,
                neighborhood: data.bairro
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao consultar CEP'
            setError(errorMessage)
            return null
        } finally {
            setLoading(false)
        }
    }

    const formatCEP = (value: string): string => {
        const cleaned = value.replace(/\D/g, '')
        if (cleaned.length <= 5) {
            return cleaned
        }
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`
    }

    return {
        lookupCEP,
        formatCEP,
        loading,
        error,
        clearError: () => setError(null)
    }
}
