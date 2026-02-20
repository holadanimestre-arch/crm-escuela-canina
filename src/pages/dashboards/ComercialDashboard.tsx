import { KPICard } from '../../components/dashboard/KPICard'
import { Users, Phone, CheckCircle } from 'lucide-react'

export function ComercialDashboard() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Panel Comercial</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <KPICard
                    title="Leads Asignados (Activos)"
                    value="18"
                    icon={Users}
                    color="#2563eb"
                />
                <KPICard
                    title="Llamadas Pendientes"
                    value="5"
                    icon={Phone}
                    color="#f59e0b"
                />
                <KPICard
                    title="Conversiones (Mes)"
                    value="6"
                    trend="2"
                    trendUp={true}
                    icon={CheckCircle}
                    color="#16a34a"
                />
            </div>

            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Próximas Tareas</h3>
                <p style={{ color: '#6b7280' }}>Lista de tareas pendientes para hoy...</p>
            </div>
        </div>
    )
}
