import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFilters } from '../../context/FilterContext'
import { Phone, ClipboardCheck, CalendarClock, ArrowLeft, Search, MapPin, User, Edit, Calendar, Clock } from 'lucide-react'
import { Modal } from '../../components/Modal'

// ─── Componente Principal ──────────────────────────────────────────
export default function AdiestradorDashboard() {
    const [counts, setCounts] = useState({ llamadas: 0, resultado: 0, sesiones: 0 })
    const [activeView, setActiveView] = useState<'home' | 'llamadas' | 'resultado' | 'sesiones' | 'modificar'>('home')
    const { profile } = useAuth()
    const { cityId } = useFilters()

    useEffect(() => {
        if (profile) fetchCounts()
    }, [profile, cityId])

    async function fetchCounts() {
        if (!profile) return

        // Para las llamadas, contamos los clientes 'evaluado' que NO tienen evaluación pendiente
        let llamadasQ = supabase.from('clients').select('id, evaluations(id)').eq('status', 'evaluado')
        
        if (profile.role === 'admin' && cityId !== 'all') {
            llamadasQ = llamadasQ.eq('city_id', cityId)
        } else if (profile.role !== 'admin' && profile.assigned_city_id) {
            llamadasQ = llamadasQ.eq('city_id', profile.assigned_city_id)
        }

        const { data: llamadasData } = await llamadasQ
        const llamadas = (llamadasData || []).filter(c => !c.evaluations || (c.evaluations as any).length === 0).length

        let resultadoQ = supabase.from('evaluations').select('*', { count: 'exact', head: true }).is('result', null)
        let sesionesQ = supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'activo')

        if (profile.role === 'admin' && cityId !== 'all') {
            resultadoQ = resultadoQ.eq('city_id', cityId)
            sesionesQ = sesionesQ.eq('city_id', cityId)
        } else if (profile.role !== 'admin') {
            resultadoQ = resultadoQ.eq('adiestrador_id', profile.id)
            if (profile.assigned_city_id) {
                sesionesQ = sesionesQ.eq('city_id', profile.assigned_city_id)
            }
        }

        const { count: resultado } = await resultadoQ
        const { count: sesiones } = await sesionesQ

        setCounts({
            llamadas,
            resultado: resultado || 0,
            sesiones: sesiones || 0
        })
    }

    const syncGoogleCalendar = async (type: 'session' | 'evaluation', id: string, action: 'create' | 'update' | 'delete' = 'create') => {
        try {
            await supabase.functions.invoke('sync-google-calendar', {
                body: { type, id, action }
            })
        } catch (err) {
            console.error('Error syncing with Google Calendar:', err)
        }
    }

    if (activeView === 'llamadas') return <LlamadasPendientes onBack={() => { setActiveView('home'); fetchCounts() }} syncGoogleCalendar={syncGoogleCalendar} />
    if (activeView === 'resultado') return <ResultadoEvaluacion onBack={() => { setActiveView('home'); fetchCounts() }} syncGoogleCalendar={syncGoogleCalendar} />
    if (activeView === 'sesiones') return <AgendarSesion onBack={() => { setActiveView('home'); fetchCounts() }} syncGoogleCalendar={syncGoogleCalendar} />
    if (activeView === 'modificar') return <ModificarSesion onBack={() => { setActiveView('home'); fetchCounts() }} syncGoogleCalendar={syncGoogleCalendar} />

    return (
        <div style={{ padding: window.innerWidth < 640 ? '1rem' : '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: window.innerWidth < 640 ? '1.5rem' : '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>
                ¡Hola {profile?.full_name?.split(' ')[0] || 'Adiestrador'}! 👋
            </h1>

            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <DashboardButton
                    icon={Phone}
                    title="Llamadas Pendientes"
                    count={counts.llamadas}
                    onClick={() => setActiveView('llamadas')}
                    color="#3b82f6"
                />
                <DashboardButton
                    icon={ClipboardCheck}
                    title="Resultado Evaluación"
                    count={counts.resultado}
                    onClick={() => setActiveView('resultado')}
                    color="#10b981"
                />
                <DashboardButton
                    icon={CalendarClock}
                    title="Agendar Sesiones"
                    onClick={() => setActiveView('sesiones')}
                    color="#8b5cf6"
                />
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={() => setActiveView('modificar')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
                        backgroundColor: '#fff', border: '1px solid #e5e7eb',
                        color: '#4b5563', fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    <Edit size={20} /> Modificar Fecha de Sesión
                </button>
            </div>
        </div>
    )
}

const InfoRow = ({ icon: Icon, label, value }: any) => (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem' }}>
            <Icon size={18} color="#6b7280" />
        </div>
        <div>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</p>
            <p style={{ fontWeight: 500, color: '#111827' }}>{value || 'No indicado'}</p>
        </div>
    </div>
)

function DashboardButton({ icon: Icon, title, count, onClick, color }: any) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                padding: window.innerWidth < 640 ? '1.5rem' : '2.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb',
                backgroundColor: 'white', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'
                e.currentTarget.style.borderColor = color
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                e.currentTarget.style.borderColor = '#e5e7eb'
            }}
        >
            <div style={{ padding: '1rem', borderRadius: '1rem', backgroundColor: `${color}10` }}>
                <Icon size={32} color={color} />
            </div>
            <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>{title}</h2>
                {count !== undefined && (
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: color, marginTop: '0.25rem' }}>{count}</p>
                )}
            </div>
        </button>
    )
}

// ─── 1. LLAMADAS PENDIENTES ─────────────────────────────────────────
function LlamadasPendientes({ onBack, syncGoogleCalendar }: any) {
    const { profile } = useAuth()
    const { cityId } = useFilters()
    const [clients, setClients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [detailClient, setDetailClient] = useState<any>(null)
    const [schedulingClient, setSchedulingClient] = useState<any>(null)
    const [evalDate, setEvalDate] = useState('')
    const [evalTime, setEvalTime] = useState('')
    const [saving, setSaving] = useState(false)
    const [savingNoContesta, setSavingNoContesta] = useState(false)

    // Función para limpiar y cerrar todo
    const closeModals = () => {
        setDetailClient(null)
        setSchedulingClient(null)
        setEvalDate('')
        setEvalTime('')
    }

    useEffect(() => { if (profile) fetchClients() }, [profile, cityId])

    async function fetchClients() {
        if (!profile) return
        setLoading(true)
        // Obtenemos clientes en estado evaluado y sus evaluaciones para filtrar
        let query = supabase.from('clients').select('*, evaluations(id)').eq('status', 'evaluado')

        if (profile.role === 'admin' && cityId !== 'all') {
            query = query.eq('city_id', cityId)
        } else if (profile.role !== 'admin' && profile.assigned_city_id) {
            query = query.eq('city_id', profile.assigned_city_id)
        }

        const { data } = await query
        // Filtramos: solo clientes que NO tienen records en evaluations (o todos sus records tienen resultado ya puesto, aunque aquí buscamos los que ni tienen cita)
        const finalClients = (data || []).filter(c => !c.evaluations || (c.evaluations as any).length === 0)
        
        setClients(finalClients)
        setLoading(false)
    }

    async function handleScheduleEval() {
        if (!schedulingClient || !evalDate || !evalTime) return
        setSaving(true)
        try {
            const scheduledDate = new Date(`${evalDate}T${evalTime}:00`).toISOString()
            const { data: clientData } = await supabase.from('clients').select('city_id').eq('id', schedulingClient.id).single()

            if (clientData) {
                const { data: insertData, error: insertError } = await supabase.from('evaluations').insert({
                    client_id: schedulingClient.id,
                    city_id: clientData.city_id,
                    scheduled_date: scheduledDate,
                    adiestrador_id: profile?.id,
                    result: null
                }).select()

                if (insertError) throw insertError
                if (insertData?.[0]) syncGoogleCalendar('evaluation', insertData[0].id)
            }
            closeModals()
            fetchClients()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleNoContesta(client: any) {
        setSavingNoContesta(true)
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    status: 'evaluacion_denegada_pablo' // Usamos un estado que sí existe en el enum
                })
                .eq('id', client.id)
            if (error) throw error
            closeModals()
            fetchClients()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSavingNoContesta(false)
        }
    }

    return (
        <div style={{ padding: window.innerWidth < 640 ? '1rem' : '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 700 }}>Llamadas Pendientes</h1>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={20} />
                <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', outline: 'none' }}
                />
            </div>

            {loading ? <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando clientes...</p> : (
                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(client => (
                        <div 
                            key={client.id} 
                            onClick={() => setDetailClient(client)}
                            style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <h3 style={{ fontWeight: 600 }}>{client.name}</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#4b5563' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><strong>Raza:</strong> {client.dog_breed || 'No especificada'}</div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><strong>Observaciones:</strong> {client.observations || '-'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <a
                                    href={`tel:${client.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ flex: 1, minWidth: '80px', padding: '0.625rem', borderRadius: '0.5rem', background: '#22c55e', color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', textDecoration: 'none' }}
                                >
                                    <Phone size={14} /> Llamar
                                </a>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDetailClient(client) }}
                                    style={{ flex: 1, minWidth: '80px', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >Ver ficha</button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); closeModals(); setSchedulingClient(client) }}
                                    style={{ flex: 1, minWidth: '100px', padding: '0.625rem', borderRadius: '0.5rem', background: '#000', color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                >
                                    <CalendarClock size={14} /> Agendar Eval.
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={!!detailClient} onClose={closeModals} title="Ficha del Cliente">
                {detailClient && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <InfoRow icon={User} label="Nombre" value={detailClient.name} />
                            <InfoRow icon={Phone} label="Teléfono" value={detailClient.phone} />
                        </div>
                        <InfoRow icon={MapPin} label="Dirección" value={detailClient.address} />
                        
                        <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Raza</p>
                                    <p style={{ fontWeight: 600 }}>{detailClient.dog_breed || '-'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Edad</p>
                                    <p style={{ fontWeight: 600 }}>{detailClient.dog_age || '-'}</p>
                                </div>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Motivo de la llamada</p>
                                <p style={{ fontWeight: 600 }}>{detailClient.call_reason || '-'}</p>
                            </div>
                        </div>

                        <div>
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>Observaciones del Comercial</p>
                            <div style={{ padding: '0.75rem', backgroundColor: '#fff7ed', borderRadius: '0.5rem', border: '1px solid #ffedd5', color: '#9a3412', fontSize: '0.875rem' }}>
                                {detailClient.observations || 'Sin observaciones'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <a
                                    href={`tel:${detailClient.phone}`}
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', background: '#22c55e', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                >
                                    <Phone size={18} /> LLAMAR
                                </a>
                                <button 
                                    onClick={() => handleNoContesta(detailClient)} 
                                    disabled={savingNoContesta} 
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', background: '#ef4444', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                                >
                                    {savingNoContesta ? '...' : 'NO CONTESTA'}
                                </button>
                            </div>
                            <button
                                onClick={() => { closeModals(); setSchedulingClient(detailClient); }}
                                style={{ width: '100%', padding: '0.875rem', borderRadius: '0.5rem', background: '#000', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                <CalendarClock size={20} /> AGENDAR EVALUACIÓN
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!schedulingClient} onClose={closeModals} title="Agendar Evaluación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>
                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Fecha de la Evaluación
                        </label>
                        <input 
                            type="date" 
                            value={evalDate} 
                            onChange={e => setEvalDate(e.target.value)} 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1rem', color: '#000', outline: 'none' }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Hora
                        </label>
                        <input 
                            type="time" 
                            value={evalTime} 
                            onChange={e => setEvalTime(e.target.value)} 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1rem', color: '#000', outline: 'none' }} 
                        />
                    </div>
                    <button 
                        onClick={handleScheduleEval} 
                        disabled={saving} 
                        style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: '#000', color: 'white', fontWeight: 700, marginTop: '0.5rem', cursor: 'pointer', border: 'none' }}
                    >
                        {saving ? 'Confirmando...' : 'CONFIRMAR CITA'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}

// ─── 2. RESULTADO EVALUACIÓN ────────────────────────────────────────
function ResultadoEvaluacion({ onBack, syncGoogleCalendar }: any) {
    const { profile } = useAuth()
    const { cityId } = useFilters()
    const [evaluations, setEvaluations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeEval, setActiveEval] = useState<any>(null)
    const [rejectingEval, setRejectingEval] = useState<any>(null)
    const [evalNotes, setEvalNotes] = useState('')
    const [firstSessionDate, setFirstSessionDate] = useState('')
    const [firstSessionTime, setFirstSessionTime] = useState('')
    const [saving, setSaving] = useState(false)

    const closeModals = () => {
        setActiveEval(null)
        setRejectingEval(null)
        setEvalNotes('')
        setFirstSessionDate('')
        setFirstSessionTime('')
    }
    
    useEffect(() => { if (profile) fetchEvaluations() }, [profile, cityId])

    async function fetchEvaluations() {
        if (!profile) return
        setLoading(true)
        let query = supabase.from('evaluations').select('*, clients(*)').is('result', null)

        if (profile.role === 'admin' && cityId !== 'all') {
            query = query.eq('city_id', cityId)
        } else if (profile.role !== 'admin') {
            query = query.eq('adiestrador_id', profile.id)
        }

        const { data } = await query
        setEvaluations(data || [])
        setLoading(false)
    }

    async function confirmResult(evalId: string, result: 'aprobada' | 'rechazada') {
        const currentEval = evaluations.find(e => e.id === evalId)
        if (!currentEval) return

        setSaving(true)
        try {
            // 1. Actualizar evaluación
            const { error: evalError } = await supabase
                .from('evaluations')
                .update({ 
                    result, 
                    comments: evalNotes,
                    // Algunos esquemas usan result_at, otros created_at. Mantenemos comments que está en schema.sql
                })
                .eq('id', evalId)
            
            if (evalError) throw evalError

            if (result === 'aprobada') {
                // 2. Marcar cliente como activo
                await supabase.from('clients').update({ status: 'activo' }).eq('id', currentEval.client_id)

                // 3. Agendar sesión si se indicaron datos
                if (firstSessionDate && firstSessionTime) {
                    const sessionDate = new Date(`${firstSessionDate}T${firstSessionTime}:00`).toISOString()
                    const { data: sData } = await supabase.from('sessions').insert({
                        client_id: currentEval.client_id,
                        session_number: 1,
                        date: sessionDate,
                        completed: false,
                        adiestrador_id: profile?.id
                    }).select()

                    syncGoogleCalendar('evaluation', evalId, 'update')
                    if (sData?.[0]) syncGoogleCalendar('session', sData[0].id)
                }
            } else {
                syncGoogleCalendar('evaluation', evalId, 'update')
            }

            setActiveEval(null)
            setRejectingEval(null)
            closeModals()
            fetchEvaluations()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ padding: window.innerWidth < 640 ? '1rem' : '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 700 }}>Resultado de Evaluación</h1>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                    {evaluations.map(ev => (
                        <div key={ev.id} style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{ev.clients.name}</h3>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                                Eval: {new Date(ev.scheduled_date).toLocaleDateString()} {new Date(ev.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => { closeModals(); setRejectingEval(ev); }} 
                                    style={{ flex: 1, padding: '0.75rem', color: '#ef4444', border: '1px solid #fee2e2', background: '#fef2f2', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
                                >
                                    RECHAZADA
                                </button>
                                <button 
                                    onClick={() => { closeModals(); setActiveEval(ev); }} 
                                    style={{ flex: 1, padding: '0.75rem', color: '#10b981', border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
                                >
                                    APROBADA
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={!!activeEval} onClose={closeModals} title="Aprobar Evaluación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 640 ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fecha 1ª Sesión</label>
                            <input type="date" value={firstSessionDate} onChange={e => setFirstSessionDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#000' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hora</label>
                            <input type="time" value={firstSessionTime} onChange={e => setFirstSessionTime(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#000' }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Comentarios de la Evaluación</label>
                        <textarea 
                            value={evalNotes} 
                            onChange={e => setEvalNotes(e.target.value)} 
                            placeholder="Escribe aquí las conclusiones..."
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '100px', outline: 'none', color: '#000' }}
                        />
                    </div>

                    <button onClick={() => confirmResult(activeEval.id, 'aprobada')} disabled={saving} style={{ width: '100%', padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? 'Guardando...' : 'CONFIRMAR Y APROBAR'}
                    </button>
                </div>
            </Modal>

            <Modal isOpen={!!rejectingEval} onClose={closeModals} title="Rechazar Evaluación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Motivo del Rechazo</label>
                        <textarea 
                            value={evalNotes} 
                            onChange={e => setEvalNotes(e.target.value)} 
                            placeholder="¿Por qué no se ha aprobado la evaluación?"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '100px', outline: 'none', color: '#000' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={closeModals} style={{ flex: 1, padding: '0.875rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: 'white' }}>Cancelar</button>
                        <button onClick={() => confirmResult(rejectingEval.id, 'rechazada')} disabled={saving} style={{ flex: 2, padding: '0.875rem', borderRadius: '0.5rem', background: '#ef4444', color: 'white', fontWeight: 700, border: 'none' }}>
                            {saving ? 'Guardando...' : 'CONFIRMAR RECHAZO'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

// ─── 3. AGENDAR SIGUIENTE SESIÓN ────────────────────────────────────
function AgendarSesion({ onBack, syncGoogleCalendar }: any) {
    const { profile } = useAuth()
    const { cityId } = useFilters()
    const [clients, setClients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [schedulingClient, setSchedulingClient] = useState<any>(null)
    const [sessionDate, setSessionDate] = useState('')
    const [sessionTime, setSessionTime] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { if (profile) fetchClients() }, [profile, cityId])

    async function fetchClients() {
        if (!profile) return
        setLoading(true)
        let query = supabase.from('clients').select('*').eq('status', 'activo')

        if (profile.role === 'admin' && cityId !== 'all') {
            query = query.eq('city_id', cityId)
        } else if (profile.role !== 'admin') {
            query = query.eq('adiestrador_id', profile.id)
        }

        const { data } = await query
        setClients(data || [])
        setLoading(false)
    }

    async function handleScheduleNext() {
        if (!schedulingClient || !sessionDate || !sessionTime) return
        setSaving(true)
        try {
            const date = new Date(`${sessionDate}T${sessionTime}:00`).toISOString()
            const { data: sData } = await supabase.from('sessions').insert({
                client_id: schedulingClient.id,
                session_number: (schedulingClient.next_session_number || 1),
                date,
                completed: false,
                adiestrador_id: profile?.id
            }).select()

            if (sData?.[0]) syncGoogleCalendar('session', sData[0].id)
            setSchedulingClient(null)
            fetchClients()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ padding: window.innerWidth < 640 ? '1rem' : '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 700 }}>Agendar Sesión</h1>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={20} />
                <input type="text" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.75rem 3rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
            </div>

            {loading ? <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando clientes...</p> : (
                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(client => (
                        <div key={client.id} style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                            <h3 style={{ fontWeight: 600 }}>{client.name}</h3>
                            <button onClick={() => { setSchedulingClient(client); setSessionDate(''); setSessionTime('') }} style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: '#000', color: 'white', borderRadius: '0.5rem', cursor: 'pointer' }}>
                                Agendar Sesión {client.next_session_number || ''}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={!!schedulingClient} onClose={() => setSchedulingClient(null)} title="Agendar Sesión">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>
                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Fecha de la Sesión
                        </label>
                        <input 
                            type="date" 
                            value={sessionDate} 
                            onChange={e => setSessionDate(e.target.value)} 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1rem', color: '#000', outline: 'none' }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Hora
                        </label>
                        <input 
                            type="time" 
                            value={sessionTime} 
                            onChange={e => setSessionTime(e.target.value)} 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1rem', color: '#000', outline: 'none' }} 
                        />
                    </div>
                    <button 
                        onClick={handleScheduleNext} 
                        disabled={saving} 
                        style={{ width: '100%', padding: '1rem', background: '#000', color: 'white', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none' }}
                    >
                        {saving ? 'Guardando...' : 'CONFIRMAR SESIÓN'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}

// ─── 4. MODIFICAR FECHA SESIÓN ──────────────────────────────────────
function ModificarSesion({ onBack, syncGoogleCalendar }: any) {
    const { profile } = useAuth()
    const { cityId } = useFilters()
    const [clients, setClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [modifyingSession, setModifyingSession] = useState<any>(null)
    const [newDate, setNewDate] = useState('')
    const [newTime, setNewTime] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { if (profile) fetchSessions() }, [profile, cityId])

    async function fetchSessions() {
        if (!profile) return
        setLoading(true)
        let query = supabase.from('sessions').select('*, clients!inner(*)').eq('completed', false).order('date', { ascending: true })

        if (profile.role === 'admin' && cityId !== 'all') {
            query = query.eq('clients.city_id', cityId)
        } else if (profile.role !== 'admin') {
            query = query.eq('adiestrador_id', profile.id)
        }

        const { data, error } = await query
        if (error) console.error("Error fetching sessions:", error)
        setClients(data || [])
        setLoading(false)
    }

    async function handleUpdate() {
        if (!modifyingSession || !newDate || !newTime) return
        setSaving(true)
        try {
            const date = new Date(`${newDate}T${newTime}:00`).toISOString()
            await supabase.from('sessions').update({ date }).eq('id', modifyingSession.id)
            syncGoogleCalendar('session', modifyingSession.id, 'update')
            setModifyingSession(null)
            fetchSessions()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ padding: window.innerWidth < 640 ? '1rem' : '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 700 }}>Modificar Próxima Sesión</h1>
            </div>

            {loading ? <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando sesiones...</p> : (
                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {clients.map(sess => (
                        <div key={sess.id} style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                            <h3 style={{ fontWeight: 600 }}>{/* @ts-ignore */ sess.clients?.name || 'Cliente'}</h3>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0' }}>
                                Actual: {new Date(sess.date).toLocaleDateString()} {new Date(sess.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <button onClick={() => { setModifyingSession(sess); setNewDate(''); setNewTime('') }} style={{ width: '100%', padding: '0.5rem', background: '#fff', border: '1px solid #000', borderRadius: '0.5rem', cursor: 'pointer' }}>
                                Modificar Fecha
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={!!modifyingSession} onClose={() => setModifyingSession(null)} title="Modificar Fecha/Hora">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>
                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Nueva Fecha
                        </label>
                        <input 
                            type="date" 
                            value={newDate} 
                            onChange={e => setNewDate(e.target.value)} 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1rem', color: '#000', outline: 'none' }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Nueva Hora
                        </label>
                        <input 
                            type="time" 
                            value={newTime} 
                            onChange={e => setNewTime(e.target.value)} 
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1rem', color: '#000', outline: 'none' }} 
                        />
                    </div>
                    <button 
                        onClick={handleUpdate} 
                        disabled={saving} 
                        style={{ width: '100%', padding: '1rem', background: '#000', color: 'white', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none' }}
                    >
                        {saving ? 'Guardando...' : 'ACTUALIZAR SESIÓN'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}

