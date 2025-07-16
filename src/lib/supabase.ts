import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase são obrigatórias')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos para o banco de dados
export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  avatar_url?: string
  role: 'volunteer' | 'organizer' | 'admin'
  bio?: string
  skills?: string[]
  availability?: string[]
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  location: string
  date: string
  start_time: string
  end_time: string
  max_volunteers: number
  current_volunteers: number
  organizer_id: string
  status: 'draft' | 'published' | 'completed' | 'cancelled'
  requirements?: string
  category?: string
  image_url?: string
  created_at: string
  updated_at: string
  organizer?: User
}

export interface Registration {
  id: string
  user_id: string
  event_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  registered_at: string
  updated_at: string
  user?: User
  event?: Event
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
}

// Funções utilitárias
export const getUserRole = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()
  
  if (error) return null
  return data.role
}

export const isOrganizer = async (userId: string): Promise<boolean> => {
  const role = await getUserRole(userId)
  return role === 'organizer' || role === 'admin'
}

export const isAdmin = async (userId: string): Promise<boolean> => {
  const role = await getUserRole(userId)
  return role === 'admin'
}