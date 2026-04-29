import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Calendar, CheckCircle, Clock, Pencil } from 'lucide-react'
import { SessionModal } from './Sesiones/SessionModal'
import { Modal } from '../components/Modal'
import { useFilters } from '../context/FilterContext'
import { useDialog } from '../context/DialogContext'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const toLocalDateInput = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const toLocalTimeInput = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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
    const { showAlert, showConfirm } = useDialog()
    const { profile } = useAuth()
    const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
    const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [editingSession, setEditingSession] = useState<Session | null>(null)
    const [editDate, setEditDate] = useState('')
    const [editTime, setEditTime] = useState('')
    const [editSaving, setEditSaving] = useState(false)

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
        // Validate that all previous sessions are completed
        if (session.session_number > 1) {
            const { data: previousSessions } = await supabase
                .from('sessions')
                .select('session_number, completed')
                .eq('client_id', session.client_id)
                .lt('session_number', session.session_number)
                .order('session_number', { ascending: true })

            if (previousSessions) {
                // Check that sessions 1 through N-1 all exist
                for (let i = 1; i < session.session_number; i++) {
                    const prev = previousSessions.find(s => s.session_number === i)
                    if (!prev) {
                        showAlert(`No se puede completar la sesión ${session.session_number} porque la sesión ${i} no existe. Debes agendar las sesiones anteriores primero.`)
                        return
                    }
                    if (!prev.completed) {
                        showAlert(`No se puede completar la sesión ${session.session_number} porque la sesión ${i} aún no está completada.`)
                        return
                    }
                }
            }
        }

        if (!await showConfirm('¿Marcar sesión como completada?')) return

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
        } catch (error: any) {
            showAlert('Error al actualizar la sesión: ' + (error.message || 'Error desconocido'))
        }
    }

    const handleEditClick = (session: Session) => {
        setEditingSession(session)
        setEditDate(toLocalDateInput(session.date))
        setEditTime(toLocalTimeInput(session.date))
    }

    const handleEditSubmit = async () => {
        if (!editingSession || !editDate || !editTime) return
        setEditSaving(true)
        try {
            const newDateIso = new Date(`${editDate}T${editTime}:00`).toISOString()
            const { error } = await supabase
                .from('sessions')
                .update({ date: newDateIso })
                .eq('id', editingSession.id)
            if (error) throw error

            try {
                await supabase.functions.invoke('sync-google-calendar', {
                    body: { type: 'session', id: editingSession.id, action: 'update' }
                })
            } catch (gcalErr) {
                console.error('Error syncing with Google Calendar:', gcalErr)
            }

            setEditingSession(null)
            fetchData()
        } catch (err: any) {
            showAlert('Error al actualizar la sesión: ' + (err.message || 'Error desconocido'))
        } finally {
            setEditSaving(false)
        }
    }

    if (loading) return <div>Cargando sesiones...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 600 }}>Sesiones de Adiestramiento</h1>
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
                                display: 'flex', justifyContent: 'space-between', alignItems: window.innerWidth < 640 ? 'flex-start' : 'center',
                                padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem',
                                backgroundColor: session.completed ? '#f9fafb' : 'white',
                                flexDirection: window.innerWidth < 640 ? 'column' : 'row',
                                gap: '1rem'
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
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {!session.completed ? (
                                        <>
                                            {profile?.role === 'admin' && (
                                                <button
                                                    onClick={() => handleEditClick(session)}
                                                    style={{
                                                        padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb',
                                                        backgroundColor: 'white', color: '#000', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'
                                                    }}
                                                >
                                                    <Pencil size={16} /> Editar
                                                </button>
                                            )}
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
                                        </>
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
                    <div className="responsive-table-wrapper">
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
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
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
                                                        whiteSpace: 'nowrap'
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
                    </div>
                )}
            </div>

            <SessionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                client={selectedClient}
                onSessionSaved={fetchData}
            />

            <Modal isOpen={!!editingSession} onClose={() => setEditingSession(null)} title="Modificar Fecha/Hora">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {editingSession && (
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                            <strong>{editingSession.clients?.name}</strong> · Sesión {editingSession.session_number}/8
                        </p>
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Nueva Fecha
                        </label>
                        <input
                            type="date"
                            value={editDate}
                            onChange={e => setEditDate(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '1rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Nueva Hora
                        </label>
                        <input
                            type="time"
                            value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '1rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setEditingSession(null)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleEditSubmit}
                            disabled={editSaving || !editDate || !editTime}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: editSaving ? 'wait' : 'pointer' }}
                        >
                            {editSaving ? 'Guardando...' : 'Actualizar Sesión'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
