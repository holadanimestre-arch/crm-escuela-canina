import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FilterProvider } from './context/FilterContext'
import { AppLayout } from './layouts/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { Leads } from './pages/Leads'
import { Clients } from './pages/Clients'
import { ClientDetail } from './pages/ClientDetail'
import { Login } from './pages/Login'
import { RoleRoute } from './components/RoleRoute'

// New Pages
import { Facturacion } from './pages/Facturacion'
import { Usuarios } from './pages/Usuarios'
import { Ajustes } from './pages/Ajustes'
import { Evaluaciones } from './pages/Evaluaciones'
import { EvaluationForm } from './pages/Evaluations/EvaluationForm'
import { EvaluationDetail } from './pages/Evaluations/EvaluationDetail'
import { Sesiones } from './pages/Sesiones'

import './index.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { session, loading } = useAuth()

    if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Cargando...</div>

    if (!session) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
                <ProtectedRoute>
                    <AppLayout />
                </ProtectedRoute>
            }>
                {/* Common */}
                <Route index element={<Dashboard />} />

                {/* Admin & Comercial */}
                <Route path="leads" element={
                    <RoleRoute allowedRoles={['admin', 'comercial']}>
                        <Leads />
                    </RoleRoute>
                } />

                {/* All Roles (Filtered by content) */}
                <Route path="clientes" element={<Clients />} />
                <Route path="clientes/:id" element={<ClientDetail />} />

                {/* Adiestrador Specific */}
                <Route path="evaluaciones" element={
                    <RoleRoute allowedRoles={['admin', 'adiestrador']}>
                        <Evaluaciones />
                    </RoleRoute>
                } />
                <Route path="evaluaciones/nueva/:clientId" element={
                    <RoleRoute allowedRoles={['admin', 'adiestrador']}>
                        <EvaluationForm />
                    </RoleRoute>
                } />
                <Route path="evaluaciones/:evaluationId" element={
                    <RoleRoute allowedRoles={['admin', 'adiestrador']}>
                        <EvaluationDetail />
                    </RoleRoute>
                } />
                <Route path="sesiones" element={
                    <RoleRoute allowedRoles={['admin', 'adiestrador']}>
                        <Sesiones />
                    </RoleRoute>
                } />

                {/* Admin Only */}
                <Route path="facturacion" element={
                    <RoleRoute allowedRoles={['admin']}>
                        <Facturacion />
                    </RoleRoute>
                } />
                <Route path="usuarios" element={
                    <RoleRoute allowedRoles={['admin']}>
                        <Usuarios />
                    </RoleRoute>
                } />
                <Route path="ajustes" element={
                    <RoleRoute allowedRoles={['admin']}>
                        <Ajustes />
                    </RoleRoute>
                } />
            </Route>
        </Routes>
    )
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <FilterProvider>
                    <AppRoutes />
                </FilterProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
