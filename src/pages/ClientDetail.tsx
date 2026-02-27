import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database.types'
import { generateInvoicePDF } from '../utils/invoiceGenerator'
import { ArrowLeft, Mail, Phone, MapPin, Dog, ClipboardCheck, CalendarClock, CheckCircle2, Clock, Circle, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type Client = Database['public']['Tables']['clients']['Row'] & {
    cities: { name: string } | null
}
type Evaluation = Database['public']['Tables']['evaluations']['Row']
type Session = Database['public']['Tables']['sessions']['Row']

export function ClientDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { profile } = useAuth()
    const [client, setClient] = useState<Client | null>(null)
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [payments, setPayments] = useState<any[]>([])
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [newPayment, setNewPayment] = useState({ amount: '', method: 'transferencia', notes: '' })
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<'info' | 'evaluations' | 'sessions' | 'payments'>('info')

    useEffect(() => {
        if (id) {
            fetchClient(id)
            fetchEvaluation(id)
            fetchSessions(id)
            fetchPayments(id)
            fetchSettings()
        }
    }, [id])

    async function fetchSettings() {
        const { data } = await supabase.from('crm_settings').select('*').single()
        if (data) setSettings(data)
    }

    async function fetchClient(clientId: string) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*, cities(name)')
                .eq('id', clientId)
                .single()

            if (error) throw error
            setClient(data as unknown as Client)
        } catch (error) {
            console.error('Error fetching client:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchEvaluation(clientId: string) {
        try {
            const { data, error } = await supabase
                .from('evaluations')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) throw error
            if (data) setEvaluation(data as Evaluation)
        } catch (error) {
            console.error('Error fetching evaluation:', error)
        }
    }

    async function fetchSessions(clientId: string) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('client_id', clientId)
                .order('session_number', { ascending: true })

            if (error) throw error
            if (data) setSessions(data as Session[])
        } catch (error) {
            console.error('Error fetching sessions:', error)
        }
    }

    async function fetchPayments(clientId: string) {
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('*, invoices(pdf_url, invoice_number)')
                .eq('client_id', clientId)
                .order('payment_number', { ascending: true })

            if (error) throw error
            if (data) setPayments(data as any[])
        } catch (error) {
            console.error('Error fetching payments:', error)
        }
    }

    if (loading) return <div>Cargando...</div>
    if (!client) return <div>Cliente no encontrado</div>

    return (
        <div>
            <Link to="/clientes" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', textDecoration: 'none', marginBottom: '1rem' }}>
                <ArrowLeft size={20} />
                Volver a Clientes
            </Link>

            {/* Header */}
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>{client.name}</h1>
                        <div style={{ display: 'flex', gap: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Mail size={16} />
                                {client.email}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Phone size={16} />
                                {client.phone || 'Sin teléfono'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={16} />
                                {client.cities?.name}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            backgroundColor: client.status === 'activo' ? '#dcfce7' : '#f3f4f6',
                            color: client.status === 'activo' ? '#166534' : '#374151',
                            textTransform: 'capitalize'
                        }}>
                            {client.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    {['info', 'evaluations', 'sessions', 'payments'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            style={{
                                padding: '0.75rem 0',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab ? '2px solid #000' : '2px solid transparent',
                                fontWeight: activeTab === tab ? 600 : 400,
                                color: activeTab === tab ? '#000' : '#6b7280',
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                            }}
                        >
                            {tab === 'info' ? 'Información' :
                                tab === 'evaluations' ? 'Evaluación' :
                                    tab === 'sessions' ? 'Sesiones' : 'Pagos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                {activeTab === 'info' && (
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Dog size={20} />
                            Información del Perro
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Raza</label>
                                <p>{client.dog_breed || '-'}</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Edad</label>
                                <p>{client.dog_age || '-'}</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Dirección</label>
                                <p>{client.address || '-'}</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Motivo de la Llamada</label>
                                <p>{(client as any).call_reason || '-'}</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Conversión realizada por</label>
                                <p>{(client as any).converted_by || '-'}</p>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Observaciones</label>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{(client as any).observations || '-'}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
                            <button
                                onClick={async () => {
                                    if (!window.confirm('¿Estás seguro de que quieres eliminar este cliente? Esta acción no se puede deshacer.')) return
                                    try {
                                        // Delete associated lead too
                                        if (client.lead_id) {
                                            await supabase.from('leads').delete().eq('id', client.lead_id)
                                        }
                                        const { error } = await supabase.from('clients').delete().eq('id', client.id)
                                        if (error) throw error
                                        navigate('/clientes')
                                    } catch (err: any) {
                                        alert('Error al eliminar: ' + err.message)
                                    }
                                }}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    backgroundColor: '#fee2e2',
                                    color: '#991b1b',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '0.375rem',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Eliminar Cliente
                            </button>
                        </div>
                    </div>
                )}
                {activeTab === 'evaluations' && (
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ClipboardCheck size={20} />
                            Evaluación
                        </h3>
                        {!evaluation ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                <CalendarClock size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p style={{ fontSize: '1rem', fontWeight: 500 }}>No hay evaluación registrada aún</p>
                                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>El adiestrador creará la evaluación cuando contacte al cliente</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Resultado</label>
                                    <span style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        backgroundColor: evaluation.result === 'aprobada' ? '#dcfce7' : '#fee2e2',
                                        color: evaluation.result === 'aprobada' ? '#166534' : '#991b1b'
                                    }}>
                                        {evaluation.result === 'aprobada' ? '✅ Aceptada' : '❌ Rechazada'}
                                    </span>
                                    {evaluation.paid_to_trainer && (
                                        <span style={{
                                            marginLeft: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            backgroundColor: '#eff6ff',
                                            color: '#1e40af',
                                            border: '1px solid #bfdbfe'
                                        }}>
                                            💰 Liquidado
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fecha Evaluación</label>
                                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>{new Date(evaluation.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fecha Prevista</label>
                                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                                        {evaluation.scheduled_date
                                            ? new Date(evaluation.scheduled_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                                            : <span style={{ color: '#9ca3af' }}>Pendiente de agendar</span>}
                                    </p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sesiones Cerradas</label>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                        {evaluation.total_sessions
                                            ? <span>{evaluation.total_sessions} sesiones</span>
                                            : <span style={{ color: '#9ca3af', fontSize: '1rem', fontWeight: 500 }}>Sin definir</span>}
                                    </p>
                                </div>
                                {evaluation.comments && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Comentarios del Adiestrador</label>
                                        <p style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>{evaluation.comments}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'sessions' && (
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                            Sesiones de Adiestramiento
                        </h3>

                        {/* Progress Summary */}
                        {(() => {
                            const totalSessions = evaluation?.total_sessions || 0
                            const completedSessions = sessions.filter(s => s.completed).length
                            const progress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

                            return (
                                <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                            {completedSessions} de {totalSessions || '?'} sesiones completadas
                                        </span>
                                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                            {totalSessions > 0 ? `${Math.round(progress)}%` : ''}
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${progress}%`,
                                            height: '100%',
                                            backgroundColor: progress === 100 ? '#22c55e' : '#3b82f6',
                                            borderRadius: '9999px',
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Session Cards */}
                        {(() => {
                            const totalSessions = evaluation?.total_sessions || 0
                            const allSlots = Array.from({ length: totalSessions }, (_, i) => {
                                const existing = sessions.find(s => s.session_number === i + 1)
                                return existing || { session_number: i + 1, date: undefined, completed: false, comments: null } as Partial<Session>
                            })

                            if (totalSessions === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                        <Circle size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p style={{ fontWeight: 500 }}>No se han definido sesiones aún</p>
                                        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>El número de sesiones se define en la evaluación</p>
                                    </div>
                                )
                            }

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {allSlots.map((session) => {
                                        const isCompleted = session.completed
                                        const isScheduled = !isCompleted && session.date

                                        let statusIcon, statusText, statusBg, statusColor, borderColor
                                        if (isCompleted) {
                                            statusIcon = <CheckCircle2 size={18} color="#16a34a" />
                                            statusText = 'Completada'
                                            statusBg = '#dcfce7'
                                            statusColor = '#166534'
                                            borderColor = '#bbf7d0'
                                        } else if (isScheduled) {
                                            statusIcon = <Clock size={18} color="#2563eb" />
                                            statusText = 'Agendada'
                                            statusBg = '#dbeafe'
                                            statusColor = '#1e40af'
                                            borderColor = '#bfdbfe'
                                        } else {
                                            statusIcon = <Circle size={18} color="#9ca3af" />
                                            statusText = 'Pendiente'
                                            statusBg = '#f3f4f6'
                                            statusColor = '#6b7280'
                                            borderColor = '#e5e7eb'
                                        }

                                        return (
                                            <div
                                                key={session.session_number}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem',
                                                    padding: '1rem 1.25rem',
                                                    borderRadius: '0.5rem',
                                                    border: `1px solid ${borderColor}`,
                                                    backgroundColor: isCompleted ? '#fafff9' : 'white'
                                                }}
                                            >
                                                {/* Number */}
                                                <div style={{
                                                    width: '2.25rem',
                                                    height: '2.25rem',
                                                    borderRadius: '50%',
                                                    backgroundColor: isCompleted ? '#dcfce7' : isScheduled ? '#dbeafe' : '#f3f4f6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    fontSize: '0.875rem',
                                                    color: isCompleted ? '#166534' : isScheduled ? '#1e40af' : '#6b7280',
                                                    flexShrink: 0
                                                }}>
                                                    {session.session_number}
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                        Sesión {session.session_number}
                                                    </div>
                                                    {session.date && (
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                                            {new Date(session.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}
                                                        </div>
                                                    )}
                                                    {session.comments && (
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                                            {session.comments}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Status Badge */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                    {statusIcon}
                                                    <span style={{
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        backgroundColor: statusBg,
                                                        color: statusColor
                                                    }}>
                                                        {statusText}
                                                    </span>
                                                    {(session as any).paid_to_trainer && (
                                                        <span style={{
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '9999px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            backgroundColor: '#eff6ff',
                                                            color: '#1e40af',
                                                            border: '1px solid #bfdbfe'
                                                        }}>
                                                            💰 Liquidado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })()}
                    </div>
                )}
                {activeTab === 'payments' && (() => {
                    const totalPaid = payments.filter(p => p.received).reduce((sum, p) => sum + p.amount, 0)
                    const totalPending = payments.filter(p => !p.received).reduce((sum, p) => sum + p.amount, 0)

                    return (
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                                Pagos
                            </h3>

                            {/* Summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#166534', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Cobrado</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#166534' }}>{totalPaid.toFixed(2)}€</div>
                                </div>
                                <div style={{ padding: '1rem', backgroundColor: '#fefce8', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#854d0e', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Pendiente</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#854d0e' }}>{totalPending.toFixed(2)}€</div>
                                </div>
                                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Nº Pagos</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{payments.length}</div>
                                </div>
                            </div>

                            {/* Add Payment Form */}
                            {profile?.role !== 'adiestrador' && (
                                !showPaymentForm ? (
                                    <button
                                        onClick={() => setShowPaymentForm(true)}
                                        style={{
                                            marginBottom: '1.5rem',
                                            padding: '0.5rem 1.25rem',
                                            backgroundColor: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            fontWeight: 600,
                                            fontSize: '0.875rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + Registrar Pago
                                    </button>
                                ) : (
                                    <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                        <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Nuevo Pago</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: '0.25rem' }}>Importe (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={newPayment.amount}
                                                    onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: '0.25rem' }}>Método</label>
                                                <select
                                                    value={newPayment.method}
                                                    onChange={e => setNewPayment({ ...newPayment, method: e.target.value })}
                                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                                                >
                                                    <option value="transferencia">Transferencia</option>
                                                    <option value="efectivo">Efectivo</option>
                                                </select>
                                            </div>
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: '0.25rem' }}>Notas (opcional)</label>
                                                <input
                                                    type="text"
                                                    value={newPayment.notes}
                                                    onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })}
                                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                                                    placeholder="Ej: Pago de sesiones 1-4"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => { setShowPaymentForm(false); setNewPayment({ amount: '', method: 'transferencia', notes: '' }) }}
                                                style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) {
                                                        alert('Introduce un importe válido')
                                                        return
                                                    }
                                                    const btn = e.currentTarget as HTMLButtonElement
                                                    if (btn) btn.disabled = true

                                                    try {
                                                        const nextNumber = payments.length > 0
                                                            ? Math.max(...payments.map(p => p.payment_number)) + 1
                                                            : 1

                                                        // 1. Insert Payment (Trigger will create Invoice record)
                                                        const { data: pData, error } = await supabase.from('payments').insert({
                                                            client_id: client.id,
                                                            amount: parseFloat(newPayment.amount),
                                                            payment_number: nextNumber,
                                                            received: true,
                                                            received_at: new Date().toISOString(),
                                                            method: newPayment.method as 'efectivo' | 'transferencia',
                                                            notes: newPayment.notes || null
                                                        }).select().single()

                                                        if (error) throw error

                                                        // 2. Wait a moment for trigger and fetch invoice
                                                        let invoice = null
                                                        for (let i = 0; i < 5; i++) {
                                                            const { data: invData } = await supabase
                                                                .from('invoices')
                                                                .select('*')
                                                                .eq('payment_id', pData.id)
                                                                .maybeSingle()

                                                            if (invData) {
                                                                invoice = invData
                                                                break
                                                            }
                                                            await new Promise(r => setTimeout(r, 500))
                                                        }

                                                        if (invoice) {
                                                            // 3. Generate PDF
                                                            const pdfBlob = generateInvoicePDF({
                                                                invoiceNumber: invoice.invoice_number,
                                                                date: new Date(),
                                                                clientName: client.name,
                                                                clientAddress: client.address || '',
                                                                clientCity: client.cities?.name || '',
                                                                concept: 'Adiestramiento a Domicilio',
                                                                amount: parseFloat(newPayment.amount),
                                                                paymentMethod: newPayment.method,
                                                                settings: settings
                                                            })

                                                            // 4. Upload PDF
                                                            const fileName = `factura_${invoice.invoice_number}_${client.id}.pdf`
                                                            const { error: uploadError } = await supabase.storage
                                                                .from('invoices')
                                                                .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true })

                                                            if (!uploadError) {
                                                                const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName)
                                                                await supabase.from('invoices').update({ pdf_url: urlData.publicUrl }).eq('id', invoice.id)
                                                            }
                                                        }

                                                        setShowPaymentForm(false)
                                                        setNewPayment({ amount: '', method: 'transferencia', notes: '' })
                                                        fetchPayments(client.id)
                                                    } catch (err: any) {
                                                        console.error('Payment error:', err)
                                                        alert('Error al registrar pago: ' + (err.message || 'Error desconocido'))
                                                    } finally {
                                                        if (btn) btn.disabled = false
                                                    }
                                                }}
                                                style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                                            >
                                                Guardar Pago
                                            </button>
                                        </div>
                                    </div>
                                ))}

                            {/* Payments List */}
                            {payments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                    <p style={{ fontWeight: 500 }}>No hay pagos registrados</p>
                                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Registra el primer pago cuando recibas la transferencia</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {payments.map(payment => (
                                        <div
                                            key={payment.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                padding: '1rem 1.25rem',
                                                borderRadius: '0.5rem',
                                                border: `1px solid ${payment.received ? '#bbf7d0' : '#fde68a'}`,
                                                backgroundColor: payment.received ? '#fafff9' : '#fffef5'
                                            }}
                                        >
                                            {/* Number */}
                                            <div style={{
                                                width: '2.25rem',
                                                height: '2.25rem',
                                                borderRadius: '50%',
                                                backgroundColor: payment.received ? '#dcfce7' : '#fef9c3',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: '0.875rem',
                                                color: payment.received ? '#166534' : '#854d0e',
                                                flexShrink: 0
                                            }}>
                                                {payment.payment_number}
                                            </div>

                                            {/* Info */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    {payment.amount.toFixed(2)}€
                                                    {payment.invoices && (payment.invoices as any).pdf_url && (
                                                        <a
                                                            href={(payment.invoices as any).pdf_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                color: '#2563eb',
                                                                fontSize: '0.75rem',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                textDecoration: 'none',
                                                                fontWeight: 500,
                                                                padding: '0.25rem 0.5rem',
                                                                backgroundColor: '#eff6ff',
                                                                borderRadius: '0.25rem'
                                                            }}
                                                        >
                                                            <FileText size={14} />
                                                            Ver Factura #{(payment.invoices as any).invoice_number}
                                                        </a>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                                    {payment.received_at
                                                        ? new Date(payment.received_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                                                        : 'Sin fecha'}
                                                    {payment.notes && ` · ${payment.notes}`}
                                                </div>
                                            </div>

                                            {/* Method Badge */}
                                            <span style={{
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                backgroundColor: payment.method === 'transferencia' ? '#dbeafe' : '#f3e8ff',
                                                color: payment.method === 'transferencia' ? '#1e40af' : '#6b21a8'
                                            }}>
                                                {payment.method === 'transferencia' ? '🏦 Transferencia' : '💵 Efectivo'}
                                            </span>

                                            {/* Status */}
                                            <span style={{
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                backgroundColor: payment.received ? '#dcfce7' : '#fef9c3',
                                                color: payment.received ? '#166534' : '#854d0e'
                                            }}>
                                                {payment.received ? '✅ Cobrado' : '⏳ Pendiente'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}
