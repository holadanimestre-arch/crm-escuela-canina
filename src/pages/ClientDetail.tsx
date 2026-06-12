import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { finalizeClientIfSessionsComplete } from '../lib/sessions'
import { Database } from '../types/database.types'
import { generateInvoicePDF } from '../utils/invoiceGenerator'
import { ArrowLeft, Mail, Phone, MapPin, Dog, ClipboardCheck, CalendarClock, CheckCircle2, Clock, Circle, FileText, Pencil, Calendar as CalendarIcon, Paperclip, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../context/DialogContext'
import { Modal } from '../components/Modal'
import { clientStatusLabel } from '../utils/clientStatus'

const toLocalDateInput = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const toLocalTimeInput = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Client = Database['public']['Tables']['clients']['Row'] & {
    cities: { name: string } | null
}
type Evaluation = Database['public']['Tables']['evaluations']['Row']
type Session = Database['public']['Tables']['sessions']['Row']

export function ClientDetail() {
    const { showAlert, showConfirm, showPrompt } = useDialog()
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { profile, assignedCityIds } = useAuth()
    const [client, setClient] = useState<Client | null>(null)
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [payments, setPayments] = useState<any[]>([])
    const [completedTasks, setCompletedTasks] = useState<any[]>([])
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [newPayment, setNewPayment] = useState({ amount: '', method: 'transferencia', notes: '' })
    const [loading, setLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState(false)
    const [settings, setSettings] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<'info' | 'evaluations' | 'sessions' | 'payments'>('info')
    const [isEditingObs, setIsEditingObs] = useState(false)
    const [obsDraft, setObsDraft] = useState('')
    const [savingObs, setSavingObs] = useState(false)
    const canEditObs = profile?.role === 'admin' || profile?.role === 'adiestrador'

    const [isEditingTotal, setIsEditingTotal] = useState(false)
    const [totalDraft, setTotalDraft] = useState('')
    const [savingTotal, setSavingTotal] = useState(false)

    const [isEditingDogName, setIsEditingDogName] = useState(false)
    const [dogNameDraft, setDogNameDraft] = useState('')
    const [savingDogName, setSavingDogName] = useState(false)

    const [isEditingSat, setIsEditingSat] = useState(false)
    const [satDraft, setSatDraft] = useState('')
    const [savingSat, setSavingSat] = useState(false)

    const saveSatisfaction = async () => {
        if (!client) return
        setSavingSat(true)
        try {
            const newVal = satDraft.trim() || null
            const { error } = await supabase
                .from('clients')
                .update({ satisfaction_notes: newVal } as any)
                .eq('id', client.id)
            if (error) throw error
            setClient({ ...(client as any), satisfaction_notes: newVal } as Client)
            setIsEditingSat(false)
        } catch (err: any) {
            showAlert('Error al guardar la satisfacción del cliente: ' + (err.message || 'Error desconocido'))
        } finally {
            setSavingSat(false)
        }
    }

    const saveDogName = async () => {
        if (!client) return
        setSavingDogName(true)
        try {
            const newName = dogNameDraft.trim() || null
            const { error } = await supabase
                .from('clients')
                .update({ dog_name: newName } as any)
                .eq('id', client.id)
            if (error) throw error
            setClient({ ...(client as any), dog_name: newName } as Client)
            setIsEditingDogName(false)
        } catch (err: any) {
            showAlert('Error al guardar el nombre del perro: ' + (err.message || 'Error desconocido'))
        } finally {
            setSavingDogName(false)
        }
    }

    const [editingSession, setEditingSession] = useState<Session | null>(null)
    const [editSessionDate, setEditSessionDate] = useState('')
    const [editSessionTime, setEditSessionTime] = useState('')
    const [savingSession, setSavingSession] = useState(false)
    const [savingStatus, setSavingStatus] = useState(false)
    const canEditSessions = profile?.role === 'admin' || profile?.role === 'adiestrador'

    const finalizarCliente = async () => {
        if (!client) return
        const completedCount = sessions.filter(s => s.completed).length
        const total = evaluation?.total_sessions || 0
        const aviso = total > 0 && completedCount < total
            ? `Atención: este cliente tiene ${completedCount} de ${total} sesiones completadas.\n\n`
            : ''
        if (!await showConfirm(`${aviso}¿Marcar a ${client.name} como CLIENTE FINALIZADO?`)) return
        setSavingStatus(true)
        try {
            const { error } = await supabase
                .from('clients')
                .update({ status: 'finalizado' } as any)
                .eq('id', client.id)
            if (error) throw error
            setClient({ ...(client as any), status: 'finalizado' } as Client)
        } catch (err: any) {
            showAlert('Error al finalizar el cliente: ' + (err.message || 'Error desconocido'))
        } finally {
            setSavingStatus(false)
        }
    }

    const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(null)
    const canManageReceipts = profile?.role !== 'adiestrador'

    const uploadReceipt = async (payment: any, file: File) => {
        if (!client) return
        if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
            showAlert('Solo se permiten imágenes o archivos PDF.')
            return
        }
        setUploadingReceiptId(payment.id)
        try {
            const ext = (file.name.split('.').pop() || 'dat').toLowerCase()
            const path = `${client.id}/pago-${payment.id}.${ext}`
            const { error: upErr } = await supabase.storage
                .from('justificantes')
                .upload(path, file, { upsert: true, contentType: file.type })
            if (upErr) throw upErr
            const { error: dbErr } = await supabase
                .from('payments')
                .update({ receipt_path: path } as any)
                .eq('id', payment.id)
            if (dbErr) throw dbErr
            setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, receipt_path: path } : p))
        } catch (err: any) {
            showAlert('Error al subir el justificante: ' + (err.message || 'Error desconocido'))
        } finally {
            setUploadingReceiptId(null)
        }
    }

    const viewReceipt = async (payment: any) => {
        if (!payment.receipt_path) return
        try {
            const { data, error } = await supabase.storage
                .from('justificantes')
                .createSignedUrl(payment.receipt_path, 60)
            if (error) throw error
            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
        } catch (err: any) {
            showAlert('No se pudo abrir el justificante: ' + (err.message || 'Error desconocido'))
        }
    }

    const removeReceipt = async (payment: any) => {
        if (!payment.receipt_path) return
        if (!await showConfirm('¿Eliminar el justificante de este pago?')) return
        setUploadingReceiptId(payment.id)
        try {
            await supabase.storage.from('justificantes').remove([payment.receipt_path])
            const { error } = await supabase
                .from('payments')
                .update({ receipt_path: null } as any)
                .eq('id', payment.id)
            if (error) throw error
            setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, receipt_path: null } : p))
        } catch (err: any) {
            showAlert('Error al eliminar el justificante: ' + (err.message || 'Error desconocido'))
        } finally {
            setUploadingReceiptId(null)
        }
    }

    const reactivarCliente = async () => {
        if (!client) return
        if (!await showConfirm(`¿Reactivar a ${client.name}? Volverá a aparecer como cliente activo.`)) return
        setSavingStatus(true)
        try {
            const { error } = await supabase
                .from('clients')
                .update({ status: 'activo' } as any)
                .eq('id', client.id)
            if (error) throw error
            setClient({ ...(client as any), status: 'activo' } as Client)
        } catch (err: any) {
            showAlert('Error al reactivar el cliente: ' + (err.message || 'Error desconocido'))
        } finally {
            setSavingStatus(false)
        }
    }

    const openEditSession = (session: Session) => {
        setEditingSession(session)
        setEditSessionDate(toLocalDateInput(session.date))
        setEditSessionTime(toLocalTimeInput(session.date))
    }

    const markSessionCompleted = async (session: Session) => {
        const num = (session as any).displayNumber ?? session.session_number
        if (!await showConfirm(`¿Marcar Sesión ${num} como completada?`)) return
        try {
            const { error } = await supabase
                .from('sessions')
                .update({ completed: true })
                .eq('id', session.id)
            if (error) throw error
            setSessions(prev => prev.map(s => s.id === session.id ? { ...s, completed: true } : s))

            // Si con esta sesión completa todas las contratadas, finalizar el cliente
            const finalized = await finalizeClientIfSessionsComplete(client?.id)
            if (finalized) {
                setClient(prev => prev ? ({ ...(prev as any), status: 'finalizado' }) as Client : prev)
                showAlert('¡Todas las sesiones completadas! El cliente se ha marcado como finalizado.')
            }
        } catch (err: any) {
            showAlert('Error al marcar la sesión: ' + (err.message || 'Error desconocido'))
        }
    }

    const openEditTotal = () => {
        setTotalDraft(String(evaluation?.total_sessions ?? sessions.length ?? ''))
        setIsEditingTotal(true)
    }

    const submitTotalSessions = async () => {
        if (!evaluation) return
        const value = parseInt(totalDraft, 10)
        if (!Number.isFinite(value) || value < 1) {
            showAlert('Introduce un número de sesiones válido.')
            return
        }
        if (value > 50) {
            showAlert('El máximo permitido es 50 sesiones.')
            return
        }
        // No se puede bajar por debajo de las sesiones ya creadas
        const realCount = sessions.length
        if (value < realCount) {
            showAlert(`No puedes fijar ${value} sesiones: este cliente ya tiene ${realCount} sesión(es) agendada(s). Si necesitas reducirlo, elimina antes las sesiones sobrantes.`)
            return
        }
        setSavingTotal(true)
        try {
            const { error } = await supabase
                .from('evaluations')
                .update({ total_sessions: value })
                .eq('id', evaluation.id)
            if (error) throw error
            setEvaluation(prev => prev ? { ...prev, total_sessions: value } : prev)
            // Si el cliente estaba finalizado y se amplían sesiones, se reactiva
            if (client?.status === 'finalizado' && value > sessions.filter(s => s.completed).length) {
                await supabase.from('clients').update({ status: 'activo' }).eq('id', client.id)
                setClient(prev => prev ? { ...prev, status: 'activo' } : prev)
            }
            setIsEditingTotal(false)
        } catch (err: any) {
            showAlert('Error al actualizar el número de sesiones: ' + (err.message || 'Error desconocido'))
        } finally {
            setSavingTotal(false)
        }
    }

    const submitEditSession = async () => {
        if (!editingSession || !editSessionDate || !editSessionTime) return
        setSavingSession(true)
        try {
            const newIso = new Date(`${editSessionDate}T${editSessionTime}:00`).toISOString()
            const { error } = await supabase
                .from('sessions')
                .update({ date: newIso })
                .eq('id', editingSession.id)
            if (error) throw error

            try {
                await supabase.functions.invoke('sync-google-calendar', {
                    body: { type: 'session', id: editingSession.id, action: 'update' }
                })
            } catch (gcalErr) {
                console.error('Error syncing with Google Calendar:', gcalErr)
            }

            setSessions(prev => prev.map(s => s.id === editingSession.id ? { ...s, date: newIso } : s))
            setEditingSession(null)
        } catch (err: any) {
            showAlert('Error al actualizar la sesión: ' + (err.message || 'Error desconocido'))
        } finally {
            setSavingSession(false)
        }
    }

    useEffect(() => {
        if (id) {
            fetchClient(id)
            fetchEvaluation(id)
            fetchSessions(id)
            fetchPayments(id)
            fetchCompletedTasks(id)
            fetchSettings()
        }
    }, [id])

    async function fetchSettings() {
        const { data } = await supabase.from('crm_settings').select('*').single()
        if (data) setSettings(data)
    }

    async function fetchCompletedTasks(clientId: string) {
        const { data } = await supabase
            .from('tasks')
            .select('id, title, type, completed_at')
            .eq('client_id', clientId)
            .eq('status', 'completada')
            .order('completed_at', { ascending: false })
        if (data) setCompletedTasks(data)
    }

    async function fetchClient(clientId: string) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*, cities(name)')
                .eq('id', clientId)
                .single()

            if (error) throw error

            if (profile?.role === 'adiestrador' && !assignedCityIds.includes(data.city_id)) {
                showAlert('No tienes permiso para ver este cliente.')
                navigate('/')
                return
            }

            setClient(data as unknown as Client)
        } catch (error) {
            console.error('Error fetching client:', error)
            // Redirect to home if fetch fails or trying to access invalid UUID
            navigate('/')
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
                .neq('is_evaluation', true)
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
            <div style={{ backgroundColor: 'white', padding: window.innerWidth < 640 ? '1.25rem' : '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                        <h1 style={{ fontSize: window.innerWidth < 640 ? '1.5rem' : '1.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>{client.name}</h1>
                        <div style={{ display: 'flex', gap: '0.75rem 1rem', color: '#6b7280', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Mail size={16} />
                                <span style={{ wordBreak: 'break-all' }}>{client.email}</span>
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
                    <div style={{ textAlign: window.innerWidth < 640 ? 'left' : 'right' }}>
                        <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            backgroundColor: client.status === 'activo' ? '#dcfce7' : client.status === 'finalizado' ? '#e0e7ff' : '#fef9c3',
                            color: client.status === 'activo' ? '#166534' : client.status === 'finalizado' ? '#3730a3' : '#854d0e',
                        }}>
                            {clientStatusLabel(client.status)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', gap: '1.5rem', minWidth: 'max-content' }}>
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
                                textTransform: 'capitalize',
                                fontSize: '0.9rem',
                                whiteSpace: 'nowrap'
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
            <div style={{ backgroundColor: 'white', padding: window.innerWidth < 640 ? '1.25rem' : '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                {activeTab === 'info' && (
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Dog size={20} />
                            Información del Perro
                        </h3>
                        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Nombre del Perro</label>
                                    {canEditObs && !isEditingDogName && (
                                        <button
                                            onClick={() => { setDogNameDraft((client as any).dog_name || ''); setIsEditingDogName(true) }}
                                            title="Editar nombre del perro"
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                </div>
                                {isEditingDogName ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                            value={dogNameDraft}
                                            onChange={e => setDogNameDraft(e.target.value)}
                                            placeholder="Nombre del perro"
                                            autoFocus
                                            style={{ flex: 1, minWidth: 0, padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.95rem' }}
                                        />
                                        <button
                                            onClick={saveDogName}
                                            disabled={savingDogName}
                                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', fontSize: '0.8rem', cursor: savingDogName ? 'wait' : 'pointer' }}
                                        >
                                            {savingDogName ? '...' : 'Guardar'}
                                        </button>
                                        <button
                                            onClick={() => { setIsEditingDogName(false); setDogNameDraft('') }}
                                            disabled={savingDogName}
                                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', fontSize: '0.8rem', cursor: 'pointer' }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <p>{(client as any).dog_name || '-'}</p>
                                )}
                            </div>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Observaciones</label>
                                    {canEditObs && !isEditingObs && (
                                        <button
                                            onClick={() => {
                                                setObsDraft((client as any).observations || '')
                                                setIsEditingObs(true)
                                            }}
                                            title="Editar observaciones"
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                </div>
                                {isEditingObs ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <textarea
                                            value={obsDraft}
                                            onChange={e => setObsDraft(e.target.value)}
                                            placeholder="Añade las observaciones que consideres oportunas..."
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem' }}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => { setIsEditingObs(false); setObsDraft('') }}
                                                disabled={savingObs}
                                                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!client) return
                                                    setSavingObs(true)
                                                    try {
                                                        const newObs = obsDraft.trim() || null
                                                        const { error } = await supabase
                                                            .from('clients')
                                                            .update({ observations: newObs } as any)
                                                            .eq('id', client.id)
                                                        if (error) throw error
                                                        setClient({ ...(client as any), observations: newObs } as Client)
                                                        setIsEditingObs(false)
                                                    } catch (err: any) {
                                                        showAlert('Error al guardar las observaciones: ' + (err.message || 'Error desconocido'))
                                                    } finally {
                                                        setSavingObs(false)
                                                    }
                                                }}
                                                disabled={savingObs}
                                                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: savingObs ? 'wait' : 'pointer' }}
                                            >
                                                {savingObs ? 'Guardando...' : 'Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{(client as any).observations || '-'}</p>
                                )}
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Satisfacción del Cliente</label>
                                    {canEditObs && !isEditingSat && (
                                        <button
                                            onClick={() => { setSatDraft((client as any).satisfaction_notes || ''); setIsEditingSat(true) }}
                                            title="Editar satisfacción del cliente"
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                </div>
                                {isEditingSat ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <textarea
                                            value={satDraft}
                                            onChange={e => setSatDraft(e.target.value)}
                                            placeholder="Anota aquí el feedback de la llamada de calidad al finalizar el adiestramiento..."
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem' }}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => { setIsEditingSat(false); setSatDraft('') }}
                                                disabled={savingSat}
                                                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={saveSatisfaction}
                                                disabled={savingSat}
                                                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: savingSat ? 'wait' : 'pointer' }}
                                            >
                                                {savingSat ? 'Guardando...' : 'Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{(client as any).satisfaction_notes || '-'}</p>
                                )}
                            </div>
                        </div>
                        {completedTasks.length > 0 && (
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.75rem' }}>Tareas realizadas</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {completedTasks.map(t => (
                                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', color: '#374151' }}>
                                            <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                                            <span style={{ flex: 1 }}>{t.title}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                                                {t.completed_at ? new Date(t.completed_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
                            <button
                                disabled={isDeleting}
                                onClick={async () => {
                                    if (!await showConfirm('⚠️ ¿Estás seguro de que quieres eliminar este cliente?\n\nSe eliminarán sus sesiones, evaluaciones y pagos. Las facturas se conservarán. Esta acción no se puede deshacer.')) return

                                    const typedName = await showPrompt(`Para confirmar, escribe el nombre del cliente: "${client.name}"`)
                                    if (typedName === null) return // User cancelled
                                    if (typedName.trim().toLowerCase() !== client.name.trim().toLowerCase()) {
                                        showAlert('El nombre introducido no coincide. La eliminación ha sido cancelada.')
                                        return
                                    }

                                    setIsDeleting(true)
                                    try {
                                        // Delete related data first (Manual Cascade)
                                        await supabase.from('sessions').delete().eq('client_id', client.id)
                                        await supabase.from('evaluations').delete().eq('client_id', client.id)
                                        await supabase.from('payments').delete().eq('client_id', client.id)

                                        if (client.lead_id) {
                                            await supabase.from('leads').delete().eq('id', client.lead_id)
                                        }
                                        const { error } = await supabase.from('clients').delete().eq('id', client.id)
                                        if (error) throw error
                                        navigate('/clientes')
                                    } catch (err: any) {
                                        showAlert('Error al eliminar: ' + err.message)
                                        setIsDeleting(false)
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
                                    cursor: isDeleting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isDeleting ? 'Eliminando...' : 'Eliminar Cliente'}
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
                            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Resultado</label>
                                    {(() => {
                                        const result = evaluation.result
                                        let bg = '#fef9c3', color = '#854d0e', text = '⏳ Pendiente'
                                        if (result === 'aprobada') { bg = '#dcfce7'; color = '#166534'; text = '✅ Aceptada' }
                                        else if (result === 'rechazada') { bg = '#fee2e2'; color = '#991b1b'; text = '❌ Rechazada' }
                                        return (
                                            <span style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                backgroundColor: bg,
                                                color,
                                            }}>{text}</span>
                                        )
                                    })()}
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
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Creada el</label>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                            {completedSessions} de {totalSessions || '?'} sesiones completadas
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                {totalSessions > 0 ? `${Math.round(progress)}%` : ''}
                                            </span>
                                            {canEditSessions && evaluation && !isEditingTotal && (
                                                <button
                                                    onClick={openEditTotal}
                                                    title="Corregir o ampliar el nº de sesiones contratadas"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    <Pencil size={12} /> Editar nº de sesiones
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {canEditSessions && evaluation && isEditingTotal && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                            <label style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>Nº de sesiones contratadas:</label>
                                            <input
                                                type="number"
                                                min={Math.max(1, sessions.length)}
                                                max={50}
                                                value={totalDraft}
                                                onChange={e => setTotalDraft(e.target.value)}
                                                style={{ width: '5rem', padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                                            />
                                            <button
                                                onClick={submitTotalSessions}
                                                disabled={savingTotal}
                                                style={{ padding: '0.35rem 0.9rem', borderRadius: '0.375rem', border: 'none', background: '#4f46e5', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: savingTotal ? 'wait' : 'pointer' }}
                                            >
                                                {savingTotal ? 'Guardando...' : 'Guardar'}
                                            </button>
                                            <button
                                                onClick={() => setIsEditingTotal(false)}
                                                disabled={savingTotal}
                                                style={{ padding: '0.35rem 0.9rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                                            >
                                                Cancelar
                                            </button>
                                            {sessions.length > 0 && (
                                                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Mínimo {sessions.length} (sesiones ya agendadas)</span>
                                            )}
                                        </div>
                                    )}
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
                            const plannedTotal = evaluation?.total_sessions || 0
                            // Renumeramos las sesiones reales de forma contigua (1, 2, 3...) para mostrar,
                            // independientemente del session_number guardado en BD.
                            const realSessions = [...sessions].sort((a, b) => a.session_number - b.session_number)
                            const slotCount = Math.max(plannedTotal, realSessions.length)
                            const allSlots = Array.from({ length: slotCount }, (_, i) => {
                                const existing = realSessions[i]
                                return existing
                                    ? { ...existing, displayNumber: i + 1 }
                                    : { session_number: null, displayNumber: i + 1, date: undefined, completed: false, comments: null } as any
                            })

                            // Estado de la evaluación inicial para la tarjeta de cabecera
                            const evalCompleted = evaluation?.result === 'aprobada' || evaluation?.result === 'rechazada'
                            const evalScheduled = !evalCompleted && !!evaluation?.scheduled_date

                            const evalCard = evaluation ? (() => {
                                let icon, text, bg, color, border, dotBg, dotColor
                                if (evalCompleted) {
                                    icon = <CheckCircle2 size={18} color="#15803d" />; text = 'Completada'
                                    bg = '#16a34a'; color = '#ffffff'; border = '#86efac'; dotBg = '#dcfce7'; dotColor = '#166534'
                                } else if (evalScheduled) {
                                    icon = <Clock size={18} color="#2563eb" />; text = 'Agendada'
                                    bg = '#dbeafe'; color = '#1e40af'; border = '#bfdbfe'; dotBg = '#dbeafe'; dotColor = '#1e40af'
                                } else {
                                    icon = <Circle size={18} color="#9ca3af" />; text = 'Pendiente'
                                    bg = '#f3f4f6'; color = '#6b7280'; border = '#e5e7eb'; dotBg = '#f3f4f6'; dotColor = '#6b7280'
                                }
                                const evalDate = evaluation.scheduled_date || evaluation.created_at
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: `1px solid ${border}`, backgroundColor: evalCompleted ? '#f0fdf4' : '#faf5ff' }}>
                                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', backgroundColor: dotBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <ClipboardCheck size={18} color={dotColor} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sesión Evaluación Inicial</div>
                                            {evalDate && (
                                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                                    {new Date(evalDate).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                            {icon}
                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: bg, color }}>{text}</span>
                                        </div>
                                    </div>
                                )
                            })() : null

                            if (slotCount === 0 && !evalCard) {
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
                                    {evalCard}
                                    {allSlots.map((session) => {
                                        const isCompleted = session.completed
                                        const isScheduled = !isCompleted && session.date

                                        let statusIcon, statusText, statusBg, statusColor, borderColor
                                        if (isCompleted) {
                                            statusIcon = <CheckCircle2 size={18} color="#15803d" />
                                            statusText = 'Completada'
                                            statusBg = '#16a34a'
                                            statusColor = '#ffffff'
                                            borderColor = '#86efac'
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
                                                key={session.displayNumber}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem',
                                                    padding: '1rem 1.25rem',
                                                    borderRadius: '0.5rem',
                                                    border: `1px solid ${borderColor}`,
                                                    backgroundColor: isCompleted ? '#f0fdf4' : 'white'
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
                                                    {session.displayNumber}
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                        Sesión {session.displayNumber}
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                                                    </div>
                                                    {canEditSessions && isScheduled && session.id && (
                                                        <button
                                                            onClick={() => openEditSession(session as Session)}
                                                            title="Editar fecha de la sesión"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: '0.375rem',
                                                                border: '1px solid #e5e7eb',
                                                                background: 'white',
                                                                color: '#374151',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Pencil size={12} /> Editar fecha
                                                        </button>
                                                    )}
                                                    {canEditSessions && isScheduled && session.id && (
                                                        <button
                                                            onClick={() => markSessionCompleted(session as Session)}
                                                            title="Marcar como completada"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: '0.375rem',
                                                                border: '1px solid #bbf7d0',
                                                                background: '#f0fdf4',
                                                                color: '#166534',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <CheckCircle2 size={12} /> Marcar como completada
                                                        </button>
                                                    )}
                                                    {(session as any).paid_to_trainer && (
                                                        <span style={{
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '9999px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            backgroundColor: '#eff6ff',
                                                            color: '#1e40af',
                                                            border: '1px solid #bfdbfe',
                                                            whiteSpace: 'nowrap'
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

                        {/* Finalizar / Reactivar Cliente */}
                        {canEditSessions && (
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
                                {client.status === 'finalizado' ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3730a3', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <CheckCircle2 size={18} /> Este cliente está finalizado.
                                        </span>
                                        {profile?.role === 'admin' && (
                                            <button
                                                onClick={reactivarCliente}
                                                disabled={savingStatus}
                                                style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: savingStatus ? 'wait' : 'pointer' }}
                                            >
                                                {savingStatus ? 'Guardando...' : 'Reactivar cliente'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                        <button
                                            onClick={finalizarCliente}
                                            disabled={savingStatus}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: '#4f46e5', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: savingStatus ? 'wait' : 'pointer' }}
                                        >
                                            <CheckCircle2 size={18} /> {savingStatus ? 'Guardando...' : 'Cliente Finalizado'}
                                        </button>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right' }}>
                                            Márcalo al terminar las sesiones o si el cliente abandona antes de tiempo.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
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
                            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Cobrado</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534' }}>{totalPaid.toFixed(2)}€</div>
                                </div>
                                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fefce8', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#854d0e', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Pendiente</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#854d0e' }}>{totalPending.toFixed(2)}€</div>
                                </div>
                                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Nº Pagos</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{payments.length}</div>
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
                                        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                                                        showAlert('Introduce un importe válido')
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
                                                            const pdfBlob = await generateInvoicePDF({
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
                                                        showAlert('Error al registrar pago: ' + (err.message || 'Error desconocido'))
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
                                                padding: '1rem',
                                                borderRadius: '0.5rem',
                                                border: `1px solid ${payment.received ? '#bbf7d0' : '#fde68a'}`,
                                                backgroundColor: payment.received ? '#fafff9' : '#fffef5',
                                                flexWrap: 'wrap'
                                            }}
                                        >
                                            {/* Left Part: Number + Amount */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
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

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '1rem', display: 'center', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                                                                Factura #{(payment.invoices as any).invoice_number}
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
                                            </div>

                                            {/* Right Part: Badges */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    backgroundColor: payment.method === 'transferencia' ? '#dbeafe' : '#f3e8ff',
                                                    color: payment.method === 'transferencia' ? '#1e40af' : '#6b21a8'
                                                }}>
                                                    {payment.method === 'transferencia' ? '🏦 Transf.' : '💵 Efec.'}
                                                </span>

                                                <span style={{
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    backgroundColor: payment.received ? '#dcfce7' : '#fef9c3',
                                                    color: payment.received ? '#166534' : '#854d0e'
                                                }}>
                                                    {payment.received ? '✅ Cobrado' : '⏳ Pend.'}
                                                </span>

                                                {/* Justificante bancario */}
                                                {payment.receipt_path ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <button
                                                            onClick={() => viewReceipt(payment)}
                                                            title="Ver justificante"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer' }}
                                                        >
                                                            <Paperclip size={12} /> Justificante
                                                        </button>
                                                        {canManageReceipts && (
                                                            <button
                                                                onClick={() => removeReceipt(payment)}
                                                                title="Eliminar justificante"
                                                                disabled={uploadingReceiptId === payment.id}
                                                                style={{ display: 'inline-flex', background: 'none', border: 'none', color: '#9ca3af', cursor: uploadingReceiptId === payment.id ? 'wait' : 'pointer', padding: '0.1rem' }}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </span>
                                                ) : canManageReceipts ? (
                                                    <label
                                                        title="Adjuntar justificante (imagen o PDF)"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', cursor: uploadingReceiptId === payment.id ? 'wait' : 'pointer' }}
                                                    >
                                                        <Paperclip size={12} /> {uploadingReceiptId === payment.id ? 'Subiendo...' : 'Adjuntar'}
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            disabled={uploadingReceiptId === payment.id}
                                                            style={{ display: 'none' }}
                                                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(payment, f); e.currentTarget.value = '' }}
                                                        />
                                                    </label>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })()}
            </div>

            <Modal isOpen={!!editingSession} onClose={() => setEditingSession(null)} title="Modificar Fecha/Hora">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {editingSession && (
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                            <strong>Sesión {(editingSession as any).displayNumber ?? editingSession.session_number}</strong>
                        </p>
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            <CalendarIcon size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Nueva Fecha
                        </label>
                        <input
                            type="date"
                            value={editSessionDate}
                            onChange={e => setEditSessionDate(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '1rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Nueva Hora
                        </label>
                        <input
                            type="time"
                            value={editSessionTime}
                            onChange={e => setEditSessionTime(e.target.value)}
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
                            onClick={submitEditSession}
                            disabled={savingSession || !editSessionDate || !editSessionTime}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: savingSession ? 'wait' : 'pointer' }}
                        >
                            {savingSession ? 'Guardando...' : 'Actualizar Sesión'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
