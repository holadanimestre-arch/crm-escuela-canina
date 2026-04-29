import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { KPICard } from '../../components/dashboard/KPICard'
import { useAuth } from '../../context/AuthContext'
import { Users, Phone, CheckCircle, Clock } from 'lucide-react'
import { startOfMonth, endOfMonth } from 'date-fns'

const PENDING_STATUSES = ['nuevo', 'intentando_contactar_lupe', 'intentando_contactar_aroha', 'intentando_contactar_pablo']
const ACTIVE_STATUSES = [
    'nuevo', 'intentando_contactar_lupe', 'intentando_contactar_aroha', 'intentando_contactar_pablo',
    'tiene_que_hablarlo_lupe', 'tiene_que_hablarlo_aroha', 'tiene_que_hablarlo_pablo',
    'evaluacion_aceptada_lupe', 'evaluacion_aceptada_aroha', 'evaluacion_aceptada_pablo'
]

export function ComercialDashboard() {
    const { profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [activeLeads, setActiveLeads] = useState(0)
    const [pendingCalls, setPendingCalls] = useState(0)
    const [monthlyConversions, setMonthlyConversions] = useState(0)
    const [pendingLeadsList, setPendingLeadsList] = useState<any[]>([])

    useEffect(() => {
        if (!profile) return

        async function fetchData() {
            setLoading(true)
            try {
                const now = new Date()
                const monthStart = startOfMonth(now).toISOString()
                const monthEnd = endOfMonth(now).toISOString()

                // All leads assigned to this comercial
                const { data: leads } = await supabase
                    .from('leads')
                    .select('id, name, phone, status, created_at, city_id')
                    .eq('comercial_id', profile!.id)

                if (leads) {
                    const active = leads.filter(l => ACTIVE_STATUSES.includes(l.status))
                    const pending = leads.filter(l => PENDING_STATUSES.includes(l.status))
                    setActiveLeads(active.length)
                    setPendingCalls(pending.length)
                    setPendingLeadsList(pending.slice(0, 10))
                }

                // Conversions this month: clients converted via this comercial's leads
                const myLeadIds = (leads || []).map(l => l.id)
                if (myLeadIds.length > 0) {
                    const { count } = await supabase
                        .from('clients')
                        .select('id', { count: 'exact', head: true })
                        .in('lead_id', myLeadIds)
                        .gte('created_at', monthStart)
                        .lte('created_at', monthEnd)
                    setMonthlyConversions(count ?? 0)
                }
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [profile])

    const statusLabel: Record<string, string> = {
        nuevo: 'Nuevo',
        intentando_contactar_lupe: 'Intentando contactar',
        intentando_contactar_aroha: 'Intentando contactar',
        intentando_contactar_pablo: 'Intentando contactar',
        tiene_que_hablarlo_lupe: 'Tiene que hablarlo',
        tiene_que_hablarlo_aroha: 'Tiene que hablarlo',
        tiene_que_hablarlo_pablo: 'Tiene que hablarlo',
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 600 }}>
                Panel Comercial
            </h1>

            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <KPICard
                    title="Leads Asignados (Activos)"
                    value={activeLeads}
                    icon={Users}
                    color="#2563eb"
                    description="Leads asignados a ti que aún no están perdidos ni denegados."
                />
                <KPICard
                    title="Llamadas Pendientes"
                    value={pendingCalls}
                    icon={Phone}
                    color="#f59e0b"
                    description="Leads en estado 'nuevo' o 'intentando contactar' que requieren llamada."
                />
                <KPICard
                    title="Conversiones (Este Mes)"
                    value={monthlyConversions}
                    icon={CheckCircle}
                    color="#16a34a"
                    description="Clientes captados este mes provenientes de tus leads."
                />
            </div>

            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Llamadas Pendientes</h3>
                {pendingLeadsList.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>No hay llamadas pendientes.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {pendingLeadsList.map(lead => (
                            <div key={lead.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Clock size={16} color="#f59e0b" />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{lead.name}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{lead.phone ?? 'Sin teléfono'}</p>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#92400e', backgroundColor: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                                    {statusLabel[lead.status] ?? lead.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
