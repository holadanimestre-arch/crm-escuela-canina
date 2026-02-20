import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface RoleRouteProps {
    children: React.ReactNode
    allowedRoles: string[]
}

export function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
    const { profile, loading } = useAuth()

    if (loading) return <div>Cargando permisos...</div>

    const isLupe = profile?.email === 'lupe@escuelacaninafranestevez.es'

    if (!profile || (!allowedRoles.includes(profile.role) && !isLupe)) {
        // Redirect to dashboard if unauthorized
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}
