import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFilters } from '../../context/FilterContext'
import { Phone, ClipboardCheck, CalendarClock, ArrowLeft, Search, MapPin, User, Edit } from 'lucide-react'
import { Modal } from '../../components/Modal'

// ─── Componente Principal ──────────────────────────────────────────
export default function AdiestradorDashboard() {
    const [counts, setCounts] = useState({ llamadas: 0, resultado: 0, sesiones: 0 })
    const [activeView, setActiveView] = useState<'home' | 'llamadas' | 'resultado' | 'sesiones' | 'modificar'>('home')
    const { profile } = useAuth()

    useEffect(() => {
        fetchCounts()
    }, [])

    async function fetchCounts() {
        if (!profile) return

        const { count: llamadas } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'pendiente_llamada').eq('adiestrador_id', profile.id)
        const { count: resultado } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).is('result', null).eq('adiestrador_id', profile.id)
        const { count: sesiones } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'activo').eq('adiestrador_id', profile.id)

        setCounts({
            llamadas: llamadas || 0,
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
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>Panel de Adiestrador</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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

function DashboardButton({ icon: Icon, title, count, onClick, color }: any) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                padding: '2.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb',
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
    const [clients, setClients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [detailClient, setDetailClient] = useState<any>(null)
    const [schedulingClient, setSchedulingClient] = useState<any>(null)
    const [evalDate, setEvalDate] = useState('')
    const [evalTime, setEvalTime] = useState('')
    const [saving, setSaving] = useState(false)
    const [savingNoContesta, setSavingNoContesta] = useState(false)

    useEffect(() => { fetchClients() }, [])

    async function fetchClients() {
        if (!profile) return
        setLoading(true)
        const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'pendiente_llamada')
            .eq('adiestrador_id', profile.id)
        setClients(data || [])
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
            setSchedulingClient(null)
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
                    status: 'no_contesta',
                    no_contesta_at: new Date().toISOString()
                })
                .eq('id', client.id)
            if (error) throw error
            setDetailClient(null)
            fetchClients()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSavingNoContesta(false)
        }
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Llamadas Pendientes</h1>
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

            {loading ? <p>Cargando...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                    {clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(client => (
                        <div key={client.id} style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <h3 style={{ fontWeight: 600 }}>{client.name}</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#4b5563' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}><strong>Motivo:</strong> {client.obs_comercial || 'No especificado'}</div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}><strong>Observaciones:</strong> {client.comments || '-'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setDetailClient(client)}
                                    style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >Ver ficha</button>
                                <button
                                    onClick={() => { setSchedulingClient(client); setEvalDate(''); setEvalTime('') }}
                                    style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: '#000', color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                >
                                    <CalendarClock size={14} /> Agendar Eval.
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={!!detailClient} onClose={() => setDetailClient(null)} title="Detalle del Lead">
                {detailClient && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <InfoRow icon={User} label="Nombre" value={detailClient.name} />
                        <InfoRow icon={Phone} label="Teléfono" value={detailClient.phone} />
                        <InfoRow icon={MapPin} label="Dirección" value={detailClient.address} />
                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
                        <button onClick={() => handleNoContesta(detailClient)} disabled={savingNoContesta} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: '#ef4444', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                            {savingNoContesta ? 'Guardando...' : 'NO CONTESTA'}
                        </button>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!schedulingClient} onClose={() => setSchedulingClient(null)} title="Agendar Evaluación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <input type="time" value={evalTime} onChange={e => setEvalTime(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <button onClick={handleScheduleEval} disabled={saving} style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#000', color: 'white', fontWeight: 600 }}>
                        {saving ? 'Agendando...' : 'Confirmar Evaluación'}
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
    const [firstSessionDate, setFirstSessionDate] = useState('')
    const [firstSessionTime, setFirstSessionTime] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchEvaluations() }, [cityId])

    async function fetchEvaluations() {
        if (!profile) return
        setLoading(true)
        let query = supabase.from('evaluations').select('*, clients(*)').is('result', null).eq('adiestrador_id', profile.id)
        if (cityId !== 'all') query = query.eq('city_id', cityId)
        const { data } = await query
        setEvaluations(data || [])
        setLoading(false)
    }

    async function confirmResult(evalId: string, result: 'aprobado' | 'rechazado') {
        const activeEval = evaluations.find(e => e.id === evalId)
        if (!activeEval) return

        setSaving(true)
        try {
            await supabase.from('evaluations').update({ result, result_at: new Date().toISOString() }).eq('id', evalId)

            if (result === 'aprobado' && firstSessionDate && firstSessionTime) {
                const sessionDate = new Date(`${firstSessionDate}T${firstSessionTime}:00`).toISOString()
                const { data: sData } = await supabase.from('sessions').insert({
                    client_id: activeEval.client_id,
                    session_number: 1,
                    date: sessionDate,
                    completed: false,
                    adiestrador_id: profile?.id
                }).select()

                syncGoogleCalendar('evaluation', evalId, 'update')
                if (sData?.[0]) syncGoogleCalendar('session', sData[0].id)
            } else {
                syncGoogleCalendar('evaluation', evalId, 'update')
            }
            setActiveEval(null)
            fetchEvaluations()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Resultado de Evaluación</h1>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                    {evaluations.map(ev => (
                        <div key={ev.id} style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{ev.clients.name}</h3>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                                Eval: {new Date(ev.scheduled_date).toLocaleDateString()} {new Date(ev.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => confirmResult(ev.id, 'rechazado')} style={{ flex: 1, padding: '0.5rem', color: '#ef4444', border: '1px solid #fee2e2', background: '#fef2f2', borderRadius: '0.5rem', cursor: 'pointer' }}>Rechazar</button>
                                <button onClick={() => { setActiveEval(ev); setFirstSessionDate(''); setFirstSessionTime('') }} style={{ flex: 1, padding: '0.5rem', color: '#10b981', border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: '0.5rem', cursor: 'pointer' }}>Aprobar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={!!activeEval} onClose={() => setActiveEval(null)} title="Aprobar y Agendar 1ª Sesión">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label>Fecha 1ª Sesión:</label>
                    <input type="date" value={firstSessionDate} onChange={e => setFirstSessionDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <input type="time" value={firstSessionTime} onChange={e => setFirstSessionTime(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <button onClick={() => confirmResult(activeEval.id, 'aprobado')} disabled={saving} style={{ padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700 }}>
                        {saving ? 'Guardando...' : 'CONFIRMAR Y AGENDAR'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}

// ─── 3. AGENDAR SIGUIENTE SESIÓN ────────────────────────────────────
function AgendarSesion({ onBack, syncGoogleCalendar }: any) {
    const { profile } = useAuth()
    const [clients, setClients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [schedulingClient, setSchedulingClient] = useState<any>(null)
    const [sessionDate, setSessionDate] = useState('')
    const [sessionTime, setSessionTime] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchClients() }, [])

    async function fetchClients() {
        if (!profile) return
        setLoading(true)
        const { data } = await supabase.from('clients').select('*').eq('status', 'activo').eq('adiestrador_id', profile.id)
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
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Agendar Sesión</h1>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={20} />
                <input type="text" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '0.75rem 3rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
            </div>

            {loading ? <p>Cargando...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
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

            <Modal isOpen={!!schedulingClient} onClose={() => setSchedulingClient(null)} title="Agendar Nueva Sesión">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <button onClick={handleScheduleNext} disabled={saving} style={{ padding: '0.75rem', background: '#8b5cf6', color: 'white', borderRadius: '0.5rem', fontWeight: 600 }}>
                        {saving ? 'Agendando...' : 'Confirmar Sesión'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}

// ─── 4. MODIFICAR FECHA SESIÓN ──────────────────────────────────────
function ModificarSesion({ onBack, syncGoogleCalendar }: any) {
    const { profile } = useAuth()
    const [clients, setClients] = useState<any[]>([])
    const [, setLoading] = useState(true)
    const [modifyingSession, setModifyingSession] = useState<any>(null)
    const [newDate, setNewDate] = useState('')
    const [newTime, setNewTime] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchSessions() }, [])

    async function fetchSessions() {
        if (!profile) return
        setLoading(true)
        const { data } = await supabase.from('sessions').select('*, clients(name)').eq('completed', false).eq('adiestrador_id', profile.id).order('date', { ascending: true })
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
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <ArrowLeft size={20} /> Volver
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Modificar Próxima Sesión</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {clients.map(sess => (
                    <div key={sess.id} style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                        <h3 style={{ fontWeight: 600 }}>{sess.clients.name}</h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0' }}>
                            Actual: {new Date(sess.date).toLocaleDateString()} {new Date(sess.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <button onClick={() => { setModifyingSession(sess); setNewDate(''); setNewTime('') }} style={{ width: '100%', padding: '0.5rem', background: '#fff', border: '1px solid #000', borderRadius: '0.5rem', cursor: 'pointer' }}>
                            Modificar Fecha
                        </button>
                    </div>
                ))}
            </div>

            <Modal isOpen={!!modifyingSession} onClose={() => setModifyingSession(null)} title="Cambiar Fecha/Hora">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
                    <button onClick={handleUpdate} disabled={saving} style={{ padding: '0.75rem', background: '#000', color: 'white', borderRadius: '0.5rem', fontWeight: 600 }}>
                        {saving ? 'Guardando...' : 'Actualizar Sesión'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}

function InfoRow({ icon: Icon, label, value }: any) {
    return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Icon size={18} color="#9ca3af" />
            <div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111827' }}>{value || '-'}</p>
            </div>
        </div>
    )
}
