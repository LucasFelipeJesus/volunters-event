import { supabase } from '../lib/supabase'

/**
 * Utilitários simplificados para administração
 */

/**
 * Verificar se o usuário atual é administrador
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return false
        }

        const { data: userData, error } = await supabase
            .from('users')
            .select('role, is_active')
            .eq('id', user.id)
            .single()

        if (error) {
            console.error('Erro ao verificar role do usuário:', error)
            return false
        }

        return userData?.role === 'admin' && userData?.is_active === true
    } catch (error) {
        console.error('Erro ao verificar admin:', error)
        return false
    }
}

/**
 * Configurar usuário existente como administrador
 */
export const promoteToAdmin = async (userId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('users')
            .update({
                role: 'admin',
                is_active: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (error) {
            console.error('Erro ao promover usuário a admin:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('Erro ao promover usuário:', error)
        return false
    }
}
