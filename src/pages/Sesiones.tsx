import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Calendar, CheckCircle } from 'lucide-react'
import { SessionModal } from './Sesiones/SessionModal'
import { useFilters } from '../context/FilterContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActiveClient {
    id: string
    name: string
    dog_breed: string | null
    sessions: { session_number: number; completed: boolean }[]
}

interface Session {
    id: string
    client_id: string
    session_number: number
    date: string
    completed: boolean
    comments: string | null
    clients: { name: string }
}

export function Sesiones() {
    const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
    const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null)
    const [showModal, setShowModal] = useState(false)

    const { cityId } = useFilters()

    useEffect(() => {
        fetchData()
    }, [cityId])

    async function fetchData() {
        setLoading(true)

        // 1. Fetch active clients (status = 'activo')
        let clientsQuery = supabase
            .from('clients')
            .select('id, name, dog_breed, sessions(session_number, completed)')
            .eq('status', 'activo')

        if (cityId !== 'all') {
            clientsQuery = clientsQuery.eq('city_id', cityId)
        }

        const { data: clients } = await clientsQuery
            .order('name')

        if (clients) {
            // Transform to handle array relations if needed
            const mapped = clients.map((c: any) => ({
                id: c.id,
                name: c.name,
                dog_breed: c.dog_breed,
                sessions: Array.isArray(c.sessions) ? c.sessions : []
            }))
            setActiveClients(mapped)
        }

        // 2. Fetch upcoming sessions (today and future)
        const today = new Date().toISOString().split('T')[0]
        let sessionsQuery = supabase
            .from('sessions')
            .select('id, client_id, session_number, date, completed, comments, clients(name, city_id)')
            .gte('date', today)

        if (cityId !== 'all') {
            sessionsQuery = sessionsQuery.filter('clients.city_id', 'eq', cityId)
        }

        const { data: sessions } = await sessionsQuery
            .order('date', { ascending: true })
            .limit(10)

        if (sessions) {
            const mappedSessions = sessions.map((s: any) => ({
                ...s,
                clients: Array.isArray(s.clients) ? s.clients[0] : s.clients
            }))
            setUpcomingSessions(mappedSessions)
        }

        setLoading(false)
    }

    const handleScheduleClick = (client: { id: string; name: string }) => {
        setSelectedClient(client)
        setShowModal(true)
    }

    const handleSessionCompleted = async (session: Session) => {
        if (!confirm('¿Marcar sesión como completada?')) return

        try {
            await supabase
                .from('sessions')
                .update({ completed: true })
                .eq('id', session.id)

            // Logic to check if it's the 8th session and update client status
            if (session.session_number === 8) {
                await supabase
                    .from('clients')
                    .update({ status: 'finalizado' })
                    .eq('id', session.client_id)
            }

            fetchData()
        } catch (error) {
            console.error('Error updating session:', error)
        }
    }

    if (loading) return <div>Cargando sesiones...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Sesiones de Adiestramiento</h1>
            </div>

            {/* Upcoming Sessions */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={20} /> Próximas Sesiones
                </h2>
                {upcomingSessions.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>No hay sesiones programadas próximamente.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {upcomingSessions.map(session => (
                            <div key={session.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem',
                                backgroundColor: session.completed ? '#f9fafb' : 'white'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{session.clients?.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                        Sesión {session.session_number}/8 • {format(new Date(session.date), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                                    </div>
                                    {session.comments && (
                                        <div style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                            "{session.comments}"
                                        </div>
                                    )}
                                </div>
                                <div>
                                    {!session.completed ? (
                                        <button
                                            onClick={() => handleSessionCompleted(session)}
                                            style={{
                                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb',
                                                backgroundColor: 'white', color: '#000', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'
                                            }}
                                        >
                                            <CheckCircle size={16} /> Marcar Completada
                                        </button>
                                    ) : (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a', fontWeight: 500, fontSize: '0.875rem' }}>
                                            <CheckCircle size={16} /> Completada
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Active Clients */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Clientes Activos</h2>
                {activeClients.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>No hay clientes activos actualmente.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>Cliente</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>Raza</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>Progreso</th>
                                <th style={{ textAlign: 'right', padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeClients.map(client => {
                                const completedCount = client.sessions.filter(s => s.completed).length
                                return (
                                    <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '1rem 0.75rem', fontWeight: 500 }}>{client.name}</td>
                                        <td style={{ padding: '1rem 0.75rem', color: '#6b7280' }}>{client.dog_breed || '-'}</td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '100px', height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${(completedCount / 8) * 100}%`,
                                                        height: '100%', backgroundColor: '#16a34a', borderRadius: '4px'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{completedCount}/8</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleScheduleClick(client)}
                                                style={{
                                                    padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none',
                                                    backgroundColor: '#000', color: 'white', fontWeight: 500, cursor: 'pointer',
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'
                                                }}
                                            >
                                                <Plus size={16} /> Agendar
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <SessionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                client={selectedClient}
                onSessionSaved={fetchData}
            />
        </div>
    )
}
