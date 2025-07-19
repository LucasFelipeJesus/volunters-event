// Script para verificar e criar buckets necessários no Supabase
import { supabase } from '../lib/supabase'

interface BucketConfig {
    id: string
    name: string
    public: boolean
    fileSizeLimit?: number
    allowedMimeTypes?: string[]
}

const requiredBuckets: BucketConfig[] = [
    {
        id: 'profile-images',
        name: 'profile-images',
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    },
    {
        id: 'event-images',
        name: 'event-images',
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    }
]

export async function checkAndCreateBuckets(): Promise<{ success: boolean; message: string; details: string[] }> {
    const details: string[] = []

    try {
        // Listar buckets existentes
        const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()

        if (listError) {
            return {
                success: false,
                message: 'Erro ao listar buckets existentes',
                details: [listError.message]
            }
        }

        const existingBucketIds = existingBuckets?.map(b => b.id) || []
        details.push(`Buckets existentes: ${existingBucketIds.join(', ') || 'nenhum'}`)

        // Verificar quais buckets estão faltando
        const missingBuckets = requiredBuckets.filter(bucket => !existingBucketIds.includes(bucket.id))

        if (missingBuckets.length === 0) {
            details.push('Todos os buckets necessários já existem!')
            return {
                success: true,
                message: 'Verificação completa - todos os buckets estão configurados',
                details
            }
        }

        details.push(`Buckets faltantes: ${missingBuckets.map(b => b.id).join(', ')}`)

        // Nota: A criação de buckets via JavaScript não é suportada no Supabase
        // Apenas administradores podem criar buckets via Dashboard ou SQL
        details.push('⚠️  AÇÃO NECESSÁRIA: Os buckets faltantes devem ser criados manualmente')
        details.push('1. Acesse o Dashboard do Supabase')
        details.push('2. Vá para Storage > Settings')
        details.push('3. Crie os buckets faltantes com as configurações adequadas')
        details.push('4. Ou execute o script SQL fornecido')

        return {
            success: false,
            message: 'Buckets faltantes detectados - criação manual necessária',
            details
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
        return {
            success: false,
            message: 'Erro durante verificação dos buckets',
            details: [errorMessage]
        }
    }
}

export async function getBucketStatus(): Promise<Record<string, boolean>> {
    try {
        const { data: buckets } = await supabase.storage.listBuckets()
        const existingIds = buckets?.map(b => b.id) || []

        const status: Record<string, boolean> = {}
        requiredBuckets.forEach(bucket => {
            status[bucket.id] = existingIds.includes(bucket.id)
        })

        return status
    } catch (error) {
        console.error('Erro ao verificar status dos buckets:', error)
        return {}
    }
}

// Para uso em desenvolvimento/debug
export async function debugBuckets(): Promise<void> {
    console.log('🔍 Verificando buckets...')

    const result = await checkAndCreateBuckets()

    console.log(`Status: ${result.success ? '✅' : '❌'} ${result.message}`)
    result.details.forEach(detail => console.log(`   ${detail}`))

    if (!result.success) {
        console.log('\n📋 Script SQL para criar buckets faltantes:')
        console.log('Execute no SQL Editor do Supabase Dashboard:')
        console.log('\n-- Criar buckets faltantes')

        requiredBuckets.forEach(bucket => {
            console.log(`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    '${bucket.id}', 
    '${bucket.name}', 
    ${bucket.public},
    ${bucket.fileSizeLimit},
    ARRAY[${bucket.allowedMimeTypes?.map(t => `'${t}'`).join(', ')}]
)
ON CONFLICT (id) DO NOTHING;`)
        })
    }
}
