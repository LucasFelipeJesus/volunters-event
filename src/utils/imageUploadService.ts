import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

interface UploadOptions {
    bucket: string
    folder?: string
    fileName?: string
    maxSize?: number // em bytes
    allowedTypes?: string[]
}

interface UploadResult {
    publicUrl: string
    path: string
}

export class ImageUploadService {
    private static readonly DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
    private static readonly DEFAULT_ALLOWED_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ]

    /**
     * Valida se um arquivo é uma imagem válida
     */
    static validateFile(file: File, options?: Pick<UploadOptions, 'maxSize' | 'allowedTypes'>): void {
        const maxSize = options?.maxSize || this.DEFAULT_MAX_SIZE
        const allowedTypes = options?.allowedTypes || this.DEFAULT_ALLOWED_TYPES

        // Verificar tipo de arquivo
        if (!allowedTypes.includes(file.type)) {
            const allowedExtensions = allowedTypes.map(type => type.split('/')[1]).join(', ')
            throw new Error(`Tipo de arquivo não permitido. Use: ${allowedExtensions}`)
        }

        // Verificar tamanho do arquivo
        if (file.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024))
            throw new Error(`A imagem deve ter no máximo ${maxSizeMB}MB`)
        }
    }

    /**
     * Verifica se um bucket existe no Supabase Storage
     */
    static async verifyBucket(bucketId: string): Promise<void> {
        try {
            const { data: buckets, error } = await supabase.storage.listBuckets()

            // `listBuckets` normalmente requer uma chave com privilégios (service_role).
            // Quando a aplicação roda no cliente (chave anônima), a chamada pode falhar
            // — não queremos bloquear o upload apenas por isso, então apenas logamos
            // e permitimos que o fluxo de upload continue.
            if (error) {
                logger.warn('Não foi possível listar buckets (provavelmente chave anônima). Ignorando verificação.', error)
                return
            }

            const bucket = buckets?.find(b => b.id === bucketId)
            if (!bucket) {
                const availableBuckets = buckets?.map(b => b.id).join(', ') || 'nenhum'
                logger.error(`Bucket ${bucketId} não encontrado. Buckets disponíveis: ${availableBuckets}`)
                throw new Error(`Bucket '${bucketId}' não configurado. Entre em contato com o administrador.`)
            }
        } catch (err) {
            // Em caso de erro inesperado, registrar e continuar — melhor permitir
            // que o upload tente seguir e falhe com o erro real do Supabase na operação.
            logger.warn('Erro ao verificar buckets de storage (ignorado):', err)
            return
        }
    }

    /**
     * Gera um nome único para o arquivo
     */
    static generateFileName(originalName: string, options?: { prefix?: string, folder?: string }): string {
        const fileExt = originalName.split('.').pop()
        const timestamp = Date.now()
        const prefix = options?.prefix || 'file'
        const folder = options?.folder ? `${options.folder}/` : ''

        return `${folder}${prefix}_${timestamp}.${fileExt}`
    }

    /**
     * Faz upload de uma imagem para o Supabase Storage
     */
    static async uploadImage(file: File, options: UploadOptions): Promise<UploadResult> {
        try {
            // Validar arquivo
            this.validateFile(file, options)

            // Verificar se o bucket existe
            await this.verifyBucket(options.bucket)

            // Gerar nome do arquivo
            const fileName = options.fileName || this.generateFileName(
                file.name,
                {
                    prefix: options.bucket.replace('-images', ''),
                    folder: options.folder
                }
            )

            logger.debug(`Fazendo upload para bucket '${options.bucket}':`, fileName)

            // Fazer upload
            const { data, error } = await supabase.storage
                .from(options.bucket)
                .upload(fileName, file, {
                    upsert: true,
                    contentType: file.type
                })

            if (error) {
                logger.error('Erro no upload do Supabase:', error)
                throw new Error(`Erro ao fazer upload da imagem: ${error.message}`)
            }

            // Obter URL pública
            const { data: { publicUrl } } = supabase.storage
                .from(options.bucket)
                .getPublicUrl(data.path)

            logger.info('Upload realizado com sucesso:', publicUrl)

            return {
                publicUrl,
                path: data.path
            }
        } catch (error) {
            logger.error('Erro no serviço de upload:', error)
            throw error
        }
    }

    /**
     * Remove uma imagem do Supabase Storage
     */
    static async deleteImage(bucket: string, path: string): Promise<void> {
        try {
            const { error } = await supabase.storage
                .from(bucket)
                .remove([path])

            if (error) {
                logger.error('Erro ao deletar imagem:', error)
                throw new Error(`Erro ao deletar imagem: ${error.message}`)
            }

            logger.info('Imagem deletada com sucesso:', path)
        } catch (error) {
            logger.error('Erro no serviço de exclusão:', error)
            throw error
        }
    }

    /**
     * Lista imagens de uma pasta específica
     */
    static async listImages(bucket: string, folder?: string): Promise<Array<{ name: string; metadata?: Record<string, unknown> }>> {
        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .list(folder)

            if (error) {
                logger.error('Erro ao listar imagens:', error)
                throw new Error(`Erro ao listar imagens: ${error.message}`)
            }

            return data || []
        } catch (error) {
            logger.error('Erro no serviço de listagem:', error)
            throw error
        }
    }
}

// Funções de conveniência para casos específicos

export const uploadProfileImage = async (file: File, userId: string): Promise<string> => {
    const result = await ImageUploadService.uploadImage(file, {
        bucket: 'profile-images',
        folder: userId,
        maxSize: 5 * 1024 * 1024 // 5MB
    })
    return result.publicUrl
}

export const uploadEventImage = async (file: File, eventId?: string): Promise<string> => {
    const result = await ImageUploadService.uploadImage(file, {
        bucket: 'event-images',
        fileName: eventId ? `event_${eventId}_${Date.now()}.${file.name.split('.').pop()}` : undefined,
        maxSize: 5 * 1024 * 1024 // 5MB
    })
    return result.publicUrl
}
