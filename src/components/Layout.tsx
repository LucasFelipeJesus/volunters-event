import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  Home, 
  Calendar, 
  Users, 
  User, 
  LogOut,
  Menu,
  X,
  Table,
  UserCog
} from 'lucide-react'
import { useState } from 'react'
import NotificationsPanel from './NotificationsPanel'
import { displayRole } from '../utils/roleUtils'
import { getRoleEmoji } from '../utils/roleUtils'

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      // Navega imediatamente para dar feedback visual instantâneo
      navigate('/login')
      // Executa logout em background
      await signOut()
    } catch (error) {
      // Log do erro mas não impacta UX
      console.error('Erro ao fazer logout:', error)
    }
  }

  const defaultDashboardHref = user?.role === 'captain' ? '/captain' : user?.role === 'volunteer' ? '/volunteer' : '/'

  const navigation = [
    { name: 'Dashboard', href: defaultDashboardHref, icon: Home },
    ...(user?.role === 'volunteer' ? [{ name: 'Avaliar Capitães', href: '/volunteer/avaliar-capitao', icon: Users }] : []),
    ...(user?.role === 'captain' ? [{ name: 'Avaliar Equipe', href: '/captain/avaliar-equipe', icon: Users }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Eventos', href: '/events', icon: Calendar }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Equipes', href: '/teams', icon: Users }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Gerenciar Usuários', href: '/admin/users', icon: UserCog }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Relatórios', href: '/admin/reports', icon: Table }] : []),
    { name: 'Perfil', href: '/profile', icon: User },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">VolunteerHub</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-3">
                  <NotificationsPanel />
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{getRoleEmoji(user?.role)} {displayRole(user?.role)}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Sair"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-2 px-3 py-2 text-left text-base font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}