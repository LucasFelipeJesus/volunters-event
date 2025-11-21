import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

/**
 * Serviço para gerenciar buckets do Supabase Storage
 * Inclui criação automática de buckets se necessário
 */
export class BucketManagerService {
    private static bucketCache: Set<string> = new Set()

    /**
     * Tenta criar um bucket se ele não existir
     */
    static async ensureBucketExists(bucketId: string): Promise<boolean> {
        try {
            // Verificar cache primeiro
            if (this.bucketCache.has(bucketId)) {
                return true
            }

            // Listar buckets existentes
            const { data: buckets, error: listError } = await supabase.storage.listBuckets()

            if (listError) {
                logger.error('Erro ao listar buckets:', listError)
                return false
            }

            // Verificar se o bucket já existe
            const bucketExists = buckets?.some(bucket => bucket.id === bucketId)

            if (bucketExists) {
                logger.debug(`Bucket ${bucketId} já existe`)
                this.bucketCache.add(bucketId)
                return true
            }

            logger.debug(`Bucket ${bucketId} não existe. Tentando criar...`)

            // Tentar criar o bucket usando a API REST
            const { data, error: createError } = await supabase.storage.createBucket(bucketId, {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            })

            if (createError) {
                logger.error(`Erro ao criar bucket ${bucketId}:`, createError)

                // Se falhar, tentar uma abordagem alternativa via RPC
                return await this.createBucketViaRPC(bucketId)
            }

            logger.info(`Bucket ${bucketId} criado com sucesso:`, data)
            this.bucketCache.add(bucketId)
            return true

        } catch (error) {
            logger.error(`Erro inesperado ao verificar/criar bucket ${bucketId}:`, error)
            return false
        }
    }

    /**
     * Tenta criar bucket via RPC (função personalizada)
     */
    private static async createBucketViaRPC(bucketId: string): Promise<boolean> {
        try {
            logger.debug(`Tentando criar bucket ${bucketId} via RPC...`)

            // Chamar função personalizada que pode ter sido criada no Supabase
            const { data, error } = await supabase.rpc('create_bucket_if_not_exists', {
                bucket_id: bucketId,
                bucket_name: bucketId,
                is_public: true
            })

            if (error) {
                logger.error(`RPC para criar bucket falhou:`, error)
                return false
            }
            logger.info(`Bucket ${bucketId} criado via RPC:`, data)
            this.bucketCache.add(bucketId)
            return true

        } catch (error) {
            logger.error(`Erro ao criar bucket via RPC:`, error)
            return false
        }
    }

    /**
     * Converte imagem para base64 como fallback
     */
    static async convertToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const result = reader.result as string
                resolve(result)
            }
            reader.onerror = () => {
                reject(new Error('Erro ao converter imagem para base64'))
            }
            reader.readAsDataURL(file)
        })
    }

    /**
     * Upload com fallback automático
     */
    static async uploadWithFallback(
        file: File,
        bucketId: string,
        fileName: string,
        useBase64Fallback: boolean = true
    ): Promise<{ url: string; isBase64: boolean }> {
        try {
            // Tentar garantir que o bucket existe
            const bucketReady = await this.ensureBucketExists(bucketId)

            if (bucketReady) {
                // Tentar upload normal
                const { data, error } = await supabase.storage
                    .from(bucketId)
                    .upload(fileName, file, {
                        upsert: true,
                        contentType: file.type
                    })

                if (!error) {
                    const { data: { publicUrl } } = supabase.storage
                        .from(bucketId)
                        .getPublicUrl(data.path)

                    logger.info('Upload realizado com sucesso:', publicUrl)
                    return { url: publicUrl, isBase64: false }
                }

                logger.error('Erro no upload após criar bucket:', error)
            }

            // Fallback para base64 se habilitado
            if (useBase64Fallback) {
                logger.debug('Usando fallback base64 para imagem...')
                const base64Url = await this.convertToBase64(file)
                return { url: base64Url, isBase64: true }
            }

            throw new Error('Upload falhou e fallback está desabilitado')

        } catch (error) {
            logger.error('Erro no upload com fallback:', error)

            if (useBase64Fallback) {
                logger.debug('Usando fallback base64 após erro...')
                const base64Url = await this.convertToBase64(file)
                return { url: base64Url, isBase64: true }
            }

            throw error
        }
    }

    /**
     * Limpar cache de buckets (para forçar nova verificação)
     */
    static clearBucketCache(): void {
        this.bucketCache.clear()
        logger.debug('Cache de buckets limpo')
    }

    /**
     * Verificar status de todos os buckets necessários
     */
    static async checkRequiredBuckets(): Promise<Record<string, boolean>> {
        const requiredBuckets = ['profile-images', 'event-images']
        const status: Record<string, boolean> = {}

        for (const bucketId of requiredBuckets) {
            status[bucketId] = await this.ensureBucketExists(bucketId)
        }

        return status
    }
}
