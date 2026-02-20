import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database.types'
import { useFilters } from '../context/FilterContext'

type Client = Database['public']['Tables']['clients']['Row']
type Evaluation = Database['public']['Tables']['evaluations']['Row']

type ClientWithExtras = Client & {
    evaluation?: Evaluation | null
    currentSession?: number
}

export function Clients() {
    const navigate = useNavigate()
    const [clients, setClients] = useState<ClientWithExtras[]>([])
    const [loading, setLoading] = useState(true)

    const { cityId } = useFilters()

    useEffect(() => {
        fetchClients()
    }, [cityId])

    async function fetchClients() {
        try {
            let query = supabase
                .from('clients')
                .select('*, cities(name)')

            if (cityId !== 'all') {
                query = query.eq('city_id', cityId)
            }

            const { data: clientsData, error: clientsError } = await query
                .order('created_at', { ascending: false })

            if (clientsError) throw clientsError
            if (!clientsData) return

            // Fetch evaluations for all clients
            const clientIds = clientsData.map(c => c.id)
            const { data: evaluations } = await supabase
                .from('evaluations')
                .select('*')
                .in('client_id', clientIds)

            // Fetch sessions (count completed per client)
            const { data: sessions } = await supabase
                .from('sessions')
                .select('client_id, session_number, completed')
                .in('client_id', clientIds)
                .eq('completed', true)
                .order('session_number', { ascending: false })

            // Map evaluations and sessions to clients
            const enriched: ClientWithExtras[] = clientsData.map(client => {
                const eval_ = evaluations?.find(e => e.client_id === client.id) || null
                const clientSessions = sessions?.filter(s => s.client_id === client.id) || []
                const maxSession = clientSessions.length > 0
                    ? Math.max(...clientSessions.map(s => s.session_number))
                    : 0
                return { ...client, evaluation: eval_, currentSession: maxSession }
            })

            setClients(enriched)
        } catch (error) {
            console.error('Error fetching clients:', error)
        } finally {
            setLoading(false)
        }
    }

    function getEvaluationBadge(client: ClientWithExtras) {
        const ev = client.evaluation
        if (!ev) {
            return { text: 'Sin Agendar', bg: '#fef9c3', color: '#854d0e' }
        }
        if (ev.result === 'aprobada') {
            return { text: 'Aprobada', bg: '#dcfce7', color: '#166534' }
        }
        if (ev.result === 'rechazada') {
            return { text: 'No Aprobada', bg: '#fee2e2', color: '#991b1b' }
        }
        // Has evaluation but no final result yet → show scheduled date
        const dateStr = ev.scheduled_date
            ? new Date(ev.scheduled_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
            : 'Pendiente'
        return { text: dateStr, bg: '#dbeafe', color: '#1e40af' }
    }

    if (loading) return <div>Cargando clientes...</div>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 600 }}>Clientes</h1>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Nombre</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Estado</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Ciudad</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Evaluación</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Sesión</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay clientes registrados</td>
                            </tr>
                        ) : (
                            clients.map((client) => {
                                const badge = getEvaluationBadge(client)
                                return (
                                    <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                                            {client.name}
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>{client.email}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                backgroundColor: client.status === 'activo' ? '#dcfce7' : '#f3f4f6',
                                                color: client.status === 'activo' ? '#166534' : '#374151',
                                                textTransform: 'capitalize'
                                            }}>
                                                {client.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            {/* @ts-ignore */}
                                            {client.cities?.name}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: badge.bg,
                                                color: badge.color
                                            }}>
                                                {badge.text}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>
                                            {client.currentSession ? `${client.currentSession} / ${client.evaluation?.total_sessions || '?'}` : '-'}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <button onClick={() => navigate(`/clientes/${client.id}`)} style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem' }}>Ver Ficha</button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
