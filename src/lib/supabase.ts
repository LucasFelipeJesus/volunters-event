import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase são obrigatórias')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configurações para tentar contornar a confirmação de email
    detectSessionInUrl: false,
    persistSession: true,
    // Outras configurações que podem ajudar
    autoRefreshToken: true,
    storageKey: 'supabase.auth.token'
  }
})

// Tipos para o banco de dados
export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  avatar_url?: string
  profile_image_url?: string
  role: 'volunteer' | 'captain' | 'admin'
  bio?: string
  skills?: string[]
  availability?: string[]
  is_first_login: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  location: string
  event_date: string
  start_time: string
  end_time: string
  max_teams: number
  current_teams: number
  max_volunteers?: number
  registration_start_date?: string
  registration_end_date?: string
  admin_id: string
  status: 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'
  requirements?: string
  category?: string
  image_url?: string
  created_at: string
  updated_at: string
  admin?: User
  teams?: Team[]
  event_registrations?: EventRegistration[]
}

export interface Team {
  id: string
  name: string
  event_id: string
  captain_id?: string
  arrival_time?: string
  max_volunteers: number
  current_volunteers: number
  status: 'forming' | 'complete' | 'active' | 'finished'
  created_by: string
  created_at: string
  updated_at: string
  event?: Event
  captain?: User
  members?: TeamMember[]
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role_in_team: 'captain' | 'volunteer'
  status: 'active' | 'inactive' | 'removed'
  joined_at: string
  left_at?: string
  team?: Team
  user?: User
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'transferred'
  registration_notes?: string
  created_at: string
  updated_at: string
  event?: Event
  user?: User
}

export interface Evaluation {
  id: string
  volunteer_id: string
  captain_id: string
  event_id: string
  team_id: string
  rating: number
  comments?: string
  skills_demonstrated?: string[]
  areas_for_improvement?: string
  would_work_again: boolean
  created_at: string
  updated_at: string
  volunteer?: User
  captain?: User
  event?: Event
  team?: Team
}

export interface AdminEvaluation {
  id: string
  captain_id: string
  admin_id: string
  event_id: string
  team_id: string
  leadership_rating: number
  team_management_rating: number
  communication_rating: number
  overall_rating: number
  comments?: string
  strengths?: string
  areas_for_improvement?: string
  promotion_ready: boolean
  created_at: string
  updated_at: string
  captain?: User
  admin?: User
  event?: Event
  team?: Team
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'evaluation'
  related_event_id?: string
  related_team_id?: string
  related_user_id?: string
  related_user?: User
  read: boolean
  created_at: string
  related_event?: Event
  related_team?: Team
}

// Views types
export interface UserEventHistory {
  user_id: string
  full_name: string
  event_id: string
  event_title: string
  event_date: string
  start_time: string
  end_time: string
  location: string
  event_status: string
  team_id: string
  team_name: string
  role_in_team: string
  membership_status: string
  joined_at: string
  left_at?: string
}

export interface TeamDetails {
  team_id: string
  team_name: string
  event_id: string
  event_title: string
  event_date: string
  arrival_time?: string
  captain_id?: string
  captain_name?: string
  max_volunteers: number
  current_volunteers: number
  team_status: string
  members: Array<{
    user_id: string
    full_name: string
    role_in_team: string
    status: string
    joined_at: string
  }>
}

export interface EvaluationDetails {
  evaluation_id: string
  rating: number
  comments?: string
  skills_demonstrated?: string[]
  areas_for_improvement?: string
  would_work_again: boolean
  evaluation_date: string
  volunteer_id: string
  volunteer_name: string
  volunteer_email: string
  captain_id: string
  captain_name: string
  event_id: string
  event_title: string
  event_date: string
  team_id: string
  team_name: string
}

export interface AdminEvaluationDetails {
  evaluation_id: string
  leadership_rating: number
  team_management_rating: number
  communication_rating: number
  overall_rating: number
  comments?: string
  strengths?: string
  areas_for_improvement?: string
  promotion_ready: boolean
  evaluation_date: string
  captain_id: string
  captain_name: string
  captain_email: string
  admin_id: string
  admin_name: string
  event_id: string
  event_title: string
  event_date: string
  team_id: string
  team_name: string
}

export interface UserStats {
  total_events: number
  completed_events: number
  average_rating: number
  total_evaluations: number
  teams_participated: number
}

// Funções utilitárias
export const getUserRole = (user: User | null): 'volunteer' | 'captain' | 'admin' | null => {
  return user?.role || null
}

export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin'
}

export const isCaptain = (user: User | null): boolean => {
  return user?.role === 'captain'
}

export const isVolunteer = (user: User | null): boolean => {
  return user?.role === 'volunteer'
}

export const canManageEvents = (user: User | null): boolean => {
  return isAdmin(user)
}

export const canManageTeams = (user: User | null): boolean => {
  return isAdmin(user)
}

export const canEvaluateVolunteers = (user: User | null): boolean => {
  return isCaptain(user) || isAdmin(user)
}

export const canEvaluateCaptains = (user: User | null): boolean => {
  return isAdmin(user)
}