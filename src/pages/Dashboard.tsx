import { useAuth } from '../hooks/useAuth'
import { AdminDashboard } from './dashboards/AdminDashboard'
import { ComercialDashboard } from './dashboards/ComercialDashboard'
import AdiestradorDashboard from './dashboards/AdiestradorDashboard'

export function Dashboard() {
    const { profile } = useAuth()

    if (!profile) return <div>Cargando perfil...</div>

    switch (profile.role) {
        case 'admin':
            return <AdminDashboard />
        case 'comercial':
            return <ComercialDashboard />
        case 'adiestrador':
            return <AdiestradorDashboard />
        default:
            // Fallback or unauthorized view
            return (
                <div>
                    <h1>Bienvenido {profile.full_name}</h1>
                    <p>Rol: {profile.role}</p>
                </div>
            )
    }
}
