import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import AuthProvider from './contexts/AuthProvider'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

// Auth Pages
import { Login } from './pages/Auth/Login'
import { Register } from './pages/Auth/Register'

// Main Pages
import { Dashboard } from './pages/Dashboard/Dashboard'
import { EventsList } from './pages/Events/EventsList'
import { CreateEvent } from './pages/Events/CreateEvent'
import { EventDetails } from './pages/Events/EventDetails'
import { EventTermsManager } from './pages/Events/EventTermsManager'
import { CreateTeam } from './pages/Teams/CreateTeam'
import { EditTeam } from './pages/Teams/EditTeam'
import { TeamsManagement } from './pages/Teams/TeamsManagement'
import { Profile } from './pages/Profile/Profile'
import { VolunteerDashboard } from './pages/Volunteer/VolunteerDashboard'
import { CaptainDashboard } from './pages/Captain/CaptainDashboard'
import AvaliarEquipe from './pages/Captain/AvaliarEquipe'
import AvaliarCapitao from './pages/Volunteer/AvaliarCapitao'
import MinhasAvaliacoesVoluntario from './pages/Volunteer/MinhasAvaliacoes'
import MinhasAvaliacoesCapitao from './pages/Captain/MinhasAvaliacoes'

// Admin Pages
import { AdminUsersManagement } from './pages/Admin/UsersManagement'
import { AdminReports } from './pages/Admin/Reports'

// Diagnostic Components
import { AuthDiagnostic } from './components/AuthDiagnostic'
import { ProfileCreationTest } from './components/ProfileCreationTest'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="volunteer" element={<VolunteerDashboard />} />
            <Route path="volunteer/avaliar-capitao" element={<AvaliarCapitao />} />
            <Route path="volunteer/minhas-avaliacoes" element={<MinhasAvaliacoesVoluntario />} />
            <Route path="captain" element={<CaptainDashboard />} />
            <Route path="captain/avaliar-equipe" element={<AvaliarEquipe />} />
            <Route path="captain/minhas-avaliacoes" element={<MinhasAvaliacoesCapitao />} />
            <Route path="events" element={<EventsList />} />
            <Route path="events/create" element={<CreateEvent />} />
            <Route path="events/:id" element={<EventDetails />} />
            <Route path="events/:eventId/terms" element={<EventTermsManager />} />
            <Route path="teams" element={<TeamsManagement />} />
            <Route path="teams/create" element={<CreateTeam />} />
            <Route path="teams/:id/edit" element={<EditTeam />} />
            <Route path="admin/users" element={<AdminUsersManagement />} />
            <Route path="admin/reports" element={<AdminReports />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          
          {/* Diagnostic Route - Access without authentication for debugging */}
          <Route path="/diagnostic" element={<AuthDiagnostic />} />
          <Route path="/test-profile" element={<ProfileCreationTest />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App