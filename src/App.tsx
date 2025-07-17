import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

// Auth Pages
import { Login } from './pages/Auth/Login'
import { Register } from './pages/Auth/Register'

// Main Pages
import { Dashboard } from './pages/Dashboard/Dashboard'
import { EventsList } from './pages/Events/EventsList'

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
            <Route path="events" element={<EventsList />} />
            <Route path="registrations" element={<div>Minhas Inscrições</div>} />
            <Route path="profile" element={<div>Perfil</div>} />
            <Route path="events/create" element={<div>Criar Evento</div>} />
          </Route>
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App