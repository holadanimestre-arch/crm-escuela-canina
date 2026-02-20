import { KPICard } from '../../components/dashboard/KPICard'
import { UserCheck, Dog, Calendar, ClipboardList } from 'lucide-react'

export function AdiestradorDashboard() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Panel Adiestrador</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <KPICard
                    title="Clientes Activos"
                    value="12"
                    icon={UserCheck}
                    color="#2563eb"
                />
                <KPICard
                    title="Sesiones Hoy"
                    value="3"
                    icon={Dog}
                    color="#f59e0b"
                />
                <KPICard
                    title="Evaluaciones Pendientes"
                    value="1"
                    icon={ClipboardList}
                    color="#8b5cf6"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={20} /> Agenda de Hoy
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li style={{ padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>09:00 - Bobby (Obediencia)</span>
                            <span style={{ color: '#6b7280' }}>Parque Retiro</span>
                        </li>
                        <li style={{ padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>11:30 - Max (Mod. Conducta)</span>
                            <span style={{ color: '#6b7280' }}>Domicilio</span>
                        </li>
                        <li style={{ padding: '0.75rem 0', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>16:00 - Luna (Evaluación)</span>
                            <span style={{ color: '#6b7280' }}>Centro</span>
                        </li>
                    </ul>
                </div>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Progreso Reciente</h3>
                    <p style={{ color: '#6b7280' }}>Gráfico de evolución de clientes...</p>
                </div>
            </div>
        </div>
    )
}
