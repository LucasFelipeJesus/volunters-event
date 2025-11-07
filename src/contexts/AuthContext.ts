import { createContext } from 'react'
import { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { User } from '../lib/supabase'

export interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, fullName: string) => Promise<{ user: SupabaseUser, needsConfirmation: boolean, session: Session | null }>
    signOut: () => Promise<void>
    updateProfile: (updates: Partial<User>) => Promise<void>
    resetPassword: (email: string) => Promise<void>
    promoteUser: (userId: string) => Promise<boolean>
    demoteUser: (userId: string) => Promise<boolean>
    demoteCaptainsAfterEvent: (eventId: string) => Promise<number>
    deleteAccount: () => Promise<boolean>
    isFirstLogin: boolean
    completeFirstLogin: () => Promise<void>
}

// FAST REFRESH: Context em arquivo separado
export const AuthContext = createContext<AuthContextType | undefined>(undefined)