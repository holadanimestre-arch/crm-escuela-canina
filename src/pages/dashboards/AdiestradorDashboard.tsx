import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFilters } from '../../context/FilterContext'
import { Phone, ClipboardCheck, CalendarClock, ArrowLeft, Search, CheckCircle, XCircle, MessageCircle, PhoneOff, MapPin, Mail, User, Edit } from 'lucide-react'
import { Modal } from '../../components/Modal'

// ─── Types ──────────────────────────────────────────────────────────

interface PendingClient {
    id: string
    name: string
    phone: string | null
    email: string | null
    dog_breed: string | null
    dog_age: string | null
    address: string | null
    call_reason: string | null
    observations: string | null
    created_at: string
    cities: { name: string } | null
}



interface SessionClient {
    id: string
    name: string
    dog_breed: string | null
    total_sessions: number
    completed_sessions: number
    next_session_number: number
    existing_session_numbers: number[]
    upcoming_session?: {
        id: string
        date: string
        session_number: number
    } | null
}

// ─── Main Component ─────────────────────────────────────────────────

export function AdiestradorDashboard() {
    const [activeView, setActiveView] = useState<'home' | 'llamadas' | 'resultado' | 'sesiones' | 'modificar'>('home')
    const [counts, setCounts] = useState({ llamadas: 0, evaluaciones: 0, sesiones: 0 })
    const { profile } = useAuth()
    const { cityId } = useFilters()

    useEffect(() => {
        fetchCounts()
    }, [cityId])

    async function fetchCounts() {
        if (!profile) return

        // 1. Llamadas pendientes: clients sin evaluation_done_at, sin no_contesta_at, y sin evaluación agendada
        let pendingQuery = supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .is('evaluation_done_at', null)
            .is('no_contesta_at', null)

        if (cityId !== 'all') pendingQuery = pendingQuery.eq('city_id', cityId)
        const { count: pendingCount } = await pendingQuery

        // Pero hay que restar los que ya tienen cita en evaluations
        let finalPendingCount = pendingCount || 0
        if (finalPendingCount > 0) {
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id')
                .is('evaluation_done_at', null)
                .is('no_contesta_at', null)

            if (clientsData && clientsData.length > 0) {
                const clientIds = clientsData.map(c => c.id)
                const { data: evals } = await supabase
                    .from('evaluations')
                    .select('client_id')
                    .in('client_id', clientIds)
                const scheduledIds = new Set((evals || []).map(e => e.client_id))
                finalPendingCount = clientsData.filter(c => !scheduledIds.has(c.id)).length
            }
        }

        // 2. Resultado evaluación: evaluations con result NULL
        let evalQuery = supabase
            .from('evaluations')
            .select('id', { count: 'exact', head: true })
            .is('result', null)
        if (cityId !== 'all') evalQuery = evalQuery.eq('city_id', cityId)
        const { count: evalCount } = await evalQuery

        // 3. Agendar sesiones: clients activos (status='activo')
        let sessionQuery = supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'activo')
        if (cityId !== 'all') sessionQuery = sessionQuery.eq('city_id', cityId)
        const { count: sessionCount } = await sessionQuery

        setCounts({
            llamadas: finalPendingCount,
            evaluaciones: evalCount || 0,
            sesiones: sessionCount || 0
        })
    }

    if (activeView === 'llamadas') return <LlamadasPendientes onBack={() => { setActiveView('home'); fetchCounts() }} />
    if (activeView === 'resultado') return <ResultadoEvaluacion onBack={() => { setActiveView('home'); fetchCounts() }} />
    if (activeView === 'sesiones') return <AgendarSesion onBack={() => { setActiveView('home'); fetchCounts() }} />
    if (activeView === 'modificar') return <ModificarSesion onBack={() => { setActiveView('home'); fetchCounts() }} />

    // ─── HOME: 3 Big Buttons ────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', marginBottom: '0.5rem' }}>
                Hola, {profile?.full_name?.split(' ')[0] || 'Adiestrador'} 👋
            </h1>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginTop: '-0.5rem' }}>
                ¿Qué necesitas hacer?
            </p>

            {/* Card 1: Llamadas Pendientes */}
            <button
                id="btn-llamadas-pendientes"
                onClick={() => setActiveView('llamadas')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '1.25rem',
                    padding: '1.75rem 1.5rem',
                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
            >
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={24} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#000' }}>Llamadas Pendientes</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Contactar nuevos clientes</div>
                </div>
                {counts.llamadas > 0 && (
                    <div style={{
                        minWidth: '28px', height: '28px', borderRadius: '9999px',
                        backgroundColor: '#000', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 700, padding: '0 0.5rem'
                    }}>
                        {counts.llamadas}
                    </div>
                )}
            </button>

            {/* Card 2: Resultado Evaluación */}
            <button
                id="btn-resultado-evaluacion"
                onClick={() => setActiveView('resultado')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '1.25rem',
                    padding: '1.75rem 1.5rem',
                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
            >
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardCheck size={24} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#000' }}>Resultado Evaluación</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Aceptar o rechazar evaluaciones</div>
                </div>
                {counts.evaluaciones > 0 && (
                    <div style={{
                        minWidth: '28px', height: '28px', borderRadius: '9999px',
                        backgroundColor: '#000', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 700, padding: '0 0.5rem'
                    }}>
                        {counts.evaluaciones}
                    </div>
                )}
            </button>

            {/* Card 3: Agendar siguiente Sesión */}
            <button
                id="btn-agendar-sesion"
                onClick={() => setActiveView('sesiones')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '1.25rem',
                    padding: '1.75rem 1.5rem',
                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
            >
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarClock size={24} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#000' }}>Agendar siguiente Sesión</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Gestionar sesiones de adiestramiento</div>
                </div>
                {counts.sesiones > 0 && (
                    <div style={{
                        minWidth: '28px', height: '28px', borderRadius: '9999px',
                        backgroundColor: '#000', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 700, padding: '0 0.5rem'
                    }}>
                        {counts.sesiones}
                    </div>
                )}
            </button>
            {/* Card 4: Modificar Fecha Sesión */}
            <button
                id="btn-modificar-sesion"
                onClick={() => setActiveView('modificar')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '1.25rem',
                    padding: '1.75rem 1.5rem',
                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
            >
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Edit size={24} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#000' }}>Modificar Fecha Sesión</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Cambiar fecha de sesiones agendadas</div>
                </div>
            </button>
        </div>
    )
}

// ─── SEARCH BAR Component ──────────────────────────────────────────

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem',
                    borderRadius: '0.5rem', border: '1px solid #e5e7eb',
                    fontSize: '0.875rem', backgroundColor: 'white',
                    outline: 'none', boxSizing: 'border-box'
                }}
            />
        </div>
    )
}

// ─── BACK HEADER Component ─────────────────────────────────────────

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
                onClick={onBack}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px', borderRadius: '50%',
                    border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer'
                }}
            >
                <ArrowLeft size={18} color="#000" />
            </button>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h1>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// 1. LLAMADAS PENDIENTES
// ═══════════════════════════════════════════════════════════════════

function LlamadasPendientes({ onBack }: { onBack: () => void }) {
    const [clients, setClients] = useState<PendingClient[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [schedulingClient, setSchedulingClient] = useState<PendingClient | null>(null)
    const [detailClient, setDetailClient] = useState<PendingClient | null>(null)
    const [evalDate, setEvalDate] = useState('')
    const [evalTime, setEvalTime] = useState('10:00')
    const [saving, setSaving] = useState(false)
    const [savingNoContesta, setSavingNoContesta] = useState(false)

    const { cityId } = useFilters()
    const { profile } = useAuth()

    useEffect(() => { fetchClients() }, [cityId])

    async function fetchClients() {
        setLoading(true)
        let query = supabase
            .from('clients')
            .select('id, name, phone, email, dog_breed, dog_age, address, call_reason, observations, created_at, cities(name)')
            .is('evaluation_done_at', null)
            .is('no_contesta_at', null)

        if (cityId !== 'all') query = query.eq('city_id', cityId)

        const { data } = await query.order('created_at', { ascending: false })
        if (data) {
            const clientIds = data.map((c: any) => c.id)
            let evalsWithSchedule: string[] = []
            if (clientIds.length > 0) {
                const { data: evals } = await supabase
                    .from('evaluations')
                    .select('client_id')
                    .in('client_id', clientIds)
                evalsWithSchedule = (evals || []).map((e: any) => e.client_id)
            }

            const filtered = data.filter((c: any) => !evalsWithSchedule.includes(c.id))
            const mapped = filtered.map((c: any) => ({
                ...c,
                cities: Array.isArray(c.cities) ? c.cities[0] : c.cities
            }))
            setClients(mapped)
        }
        setLoading(false)
    }

    async function handleScheduleEval() {
        if (!schedulingClient || !evalDate || !evalTime) return
        setSaving(true)
        try {
            const scheduledDate = `${evalDate}T${evalTime}:00`
            const { data: clientData } = await supabase.from('clients').select('city_id').eq('id', schedulingClient.id).single()

            if (clientData) {
                await supabase.from('evaluations').delete().eq('client_id', schedulingClient.id).is('result', null)
                const { error: insertError } = await supabase.from('evaluations').insert({
                    client_id: schedulingClient.id,
                    city_id: clientData.city_id,
                    scheduled_date: scheduledDate,
                    adiestrador_id: profile?.id,
                    result: null as any
                })
                if (insertError) throw insertError
            }

            setSchedulingClient(null)
            setEvalDate('')
            setEvalTime('10:00')
            fetchClients()
        } catch (err: any) {
            console.error('Error scheduling:', err)
            alert('Error al agendar: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleNoContesta(client: PendingClient) {
        if (!confirm(`¿Marcar a ${client.name} como "No contesta"? Se creará una alerta para Administración.`)) return
        setSavingNoContesta(true)
        try {
            const { error } = await supabase
                .from('clients')
                .update({ no_contesta_at: new Date().toISOString() })
                .eq('id', client.id)
            if (error) throw error
            setDetailClient(null)
            fetchClients()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSavingNoContesta(false)
        }
    }

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return <div>Cargando...</div>

    return (
        <div>
            <BackHeader title="Llamadas Pendientes" onBack={onBack} />
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar cliente por nombre..." />

            {filteredClients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
                    <Phone size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 500 }}>No hay llamadas pendientes</p>
                    <p style={{ fontSize: '0.875rem' }}>Todos los clientes han sido contactados</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredClients.map(client => (
                        <div
                            key={client.id}
                            onClick={() => setDetailClient(client)}
                            style={{
                                backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                                padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                cursor: 'pointer', transition: 'border-color 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#000' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{client.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                        {client.dog_breed || 'Sin raza'} {client.dog_age ? `• ${client.dog_age}` : ''}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    {new Date(client.created_at).toLocaleDateString('es-ES')}
                                </div>
                            </div>

                            {/* Motivo Llamada */}
                            {client.call_reason && (
                                <div style={{ fontSize: '0.8rem', color: '#374151', backgroundColor: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', borderLeft: '3px solid #000' }}>
                                    <span style={{ fontWeight: 600, color: '#000' }}>Motivo:</span> {client.call_reason}
                                </div>
                            )}

                            {/* Observaciones */}
                            {client.observations && (
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                                    📝 {client.observations}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                {/* WhatsApp */}
                                {client.phone && (
                                    <a
                                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${client.name}, soy ${profile?.full_name || 'tu adiestrador'} de la Escuela Canina Fran Estévez. Te llamo para concertar una cita de evaluación.`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                            padding: '0.5rem 0.875rem', borderRadius: '0.375rem',
                                            backgroundColor: '#dcfce7', color: '#166534', border: 'none',
                                            fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        <MessageCircle size={15} /> WhatsApp
                                    </a>
                                )}

                                {/* Teléfono */}
                                {client.phone && (
                                    <a
                                        href={`tel:${client.phone}`}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                            padding: '0.5rem 0.875rem', borderRadius: '0.375rem',
                                            backgroundColor: '#f3f4f6', color: '#000', border: 'none',
                                            fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        <Phone size={15} /> {client.phone}
                                    </a>
                                )}

                                {/* Agendar Evaluación */}
                                <button
                                    onClick={() => { setSchedulingClient(client); setEvalDate(new Date().toISOString().split('T')[0]) }}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                        padding: '0.5rem 0.875rem', borderRadius: '0.375rem',
                                        backgroundColor: '#000', color: 'white', border: 'none',
                                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto'
                                    }}
                                >
                                    <CalendarClock size={15} /> Agendar Evaluación
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ──── CLIENT DETAIL MODAL ──── */}
            <Modal isOpen={!!detailClient} onClose={() => setDetailClient(null)} title="Detalle del Cliente">
                {detailClient && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Name & Breed header */}
                        <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                                <User size={24} color="#374151" />
                            </div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{detailClient.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                {detailClient.dog_breed || 'Sin raza'} {detailClient.dog_age ? `• ${detailClient.dog_age}` : ''}
                            </div>
                        </div>

                        {/* Info rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {detailClient.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                    <Phone size={16} color="#6b7280" />
                                    <a href={`tel:${detailClient.phone}`} style={{ color: '#000', textDecoration: 'none', fontWeight: 500 }}>{detailClient.phone}</a>
                                </div>
                            )}
                            {detailClient.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                    <Mail size={16} color="#6b7280" />
                                    <span style={{ color: '#374151' }}>{detailClient.email}</span>
                                </div>
                            )}
                            {detailClient.address && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                    <MapPin size={16} color="#6b7280" />
                                    <span style={{ color: '#374151' }}>{detailClient.address}</span>
                                </div>
                            )}
                            {detailClient.cities?.name && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                                    <MapPin size={16} color="#6b7280" />
                                    <span style={{ color: '#374151' }}>Ciudad: {detailClient.cities.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Motivo Llamada */}
                        {detailClient.call_reason && (
                            <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderLeft: '3px solid #000' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: '#6b7280', marginBottom: '0.25rem' }}>Motivo de Llamada</div>
                                <div style={{ fontSize: '0.875rem', color: '#000' }}>{detailClient.call_reason}</div>
                            </div>
                        )}

                        {/* Observaciones */}
                        {detailClient.observations && (
                            <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem 1rem', borderRadius: '0.5rem', borderLeft: '3px solid #9ca3af' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: '#6b7280', marginBottom: '0.25rem' }}>Observaciones</div>
                                <div style={{ fontSize: '0.875rem', color: '#374151', fontStyle: 'italic' }}>{detailClient.observations}</div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
                            {detailClient.phone && (
                                <a
                                    href={`https://wa.me/${detailClient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${detailClient.name}, soy ${profile?.full_name || 'tu adiestrador'} de la Escuela Canina Fran Estévez. Te llamo para concertar una cita de evaluación.`)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: '#dcfce7', color: '#166534', border: 'none', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', minWidth: '120px' }}
                                >
                                    <MessageCircle size={15} /> WhatsApp
                                </a>
                            )}
                            {detailClient.phone && (
                                <a
                                    href={`tel:${detailClient.phone}`}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: '#f3f4f6', color: '#000', border: 'none', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', minWidth: '120px' }}
                                >
                                    <Phone size={15} /> Llamar
                                </a>
                            )}
                            <button
                                onClick={() => { setDetailClient(null); setSchedulingClient(detailClient); setEvalDate(new Date().toISOString().split('T')[0]) }}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.625rem', borderRadius: '0.375rem', backgroundColor: '#000', color: 'white', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', minWidth: '120px' }}
                            >
                                <CalendarClock size={15} /> Agendar Evaluación
                            </button>
                        </div>

                        {/* NO CONTESTA button */}
                        <button
                            onClick={() => handleNoContesta(detailClient)}
                            disabled={savingNoContesta}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                padding: '0.75rem', borderRadius: '0.375rem',
                                backgroundColor: '#fef2f2', color: '#dc2626',
                                border: '1px solid #fecaca', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                                width: '100%', opacity: savingNoContesta ? 0.6 : 1
                            }}
                        >
                            <PhoneOff size={16} />
                            {savingNoContesta ? 'Procesando...' : 'No contesta'}
                        </button>
                    </div>
                )}
            </Modal>

            {/* Schedule Modal */}
            <Modal isOpen={!!schedulingClient} onClose={() => setSchedulingClient(null)} title="Agendar Evaluación">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Evaluación para <strong>{schedulingClient?.name}</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Fecha</label>
                            <input
                                type="date"
                                value={evalDate}
                                onChange={e => setEvalDate(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Hora</label>
                            <input
                                type="time"
                                value={evalTime}
                                onChange={e => setEvalTime(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={() => setSchedulingClient(null)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleScheduleEval}
                            disabled={saving || !evalDate}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none',
                                background: '#000', color: 'white', fontWeight: 600, cursor: 'pointer',
                                opacity: (saving || !evalDate) ? 0.6 : 1
                            }}
                        >
                            {saving ? 'Guardando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════════
// 2. RESULTADO EVALUACIÓN
// ═══════════════════════════════════════════════════════════════════

function ResultadoEvaluacion({ onBack }: { onBack: () => void }) {
    const [evaluations, setEvaluations] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [activeEval, setActiveEval] = useState<any | null>(null)
    const [comments, setComments] = useState('')
    const [totalSessions, setTotalSessions] = useState(8)
    const [firstSessionDate, setFirstSessionDate] = useState('')
    const [firstSessionTime, setFirstSessionTime] = useState('10:00')
    const [saving, setSaving] = useState(false)

    const { cityId } = useFilters()

    useEffect(() => { fetchEvaluations() }, [cityId])

    async function fetchEvaluations() {
        setLoading(true)
        // Fetch evaluations without a result yet (pending)
        let query = supabase
            .from('evaluations')
            .select('id, scheduled_date, comments, client_id, city_id, clients(id, name, phone, dog_breed)')
            .is('result', null)

        if (cityId !== 'all') query = query.eq('city_id', cityId)
        const { data } = await query.order('scheduled_date', { ascending: true })

        if (data) {
            const mapped = data.map((e: any) => ({
                ...e,
                clients: Array.isArray(e.clients) ? e.clients[0] : e.clients
            }))
            setEvaluations(mapped)
        }
        setLoading(false)
    }

    async function handleResult(evalItem: any, result: 'aprobada' | 'rechazada') {
        setActiveEval({ ...evalItem, selectedResult: result })
        setComments('')
        setTotalSessions(8)
        setFirstSessionDate('')
        setFirstSessionTime('10:00')
    }

    async function confirmResult() {
        if (!activeEval) return

        if (activeEval.selectedResult === 'aprobada' && !firstSessionDate) {
            alert('Debes indicar la fecha de la primera sesión')
            return
        }

        setSaving(true)
        try {
            // Update evaluation with result
            const { error: evalError } = await supabase
                .from('evaluations')
                .update({
                    result: activeEval.selectedResult,
                    comments: comments || null,
                    total_sessions: activeEval.selectedResult === 'aprobada' ? totalSessions : null
                })
                .eq('id', activeEval.id)
            if (evalError) throw evalError

            // Update client evaluation_done_at
            await supabase
                .from('clients')
                .update({ evaluation_done_at: new Date().toISOString() })
                .eq('id', activeEval.client_id)

            // If accepted, update client status to activo and create 1st session
            if (activeEval.selectedResult === 'aprobada') {
                await supabase
                    .from('clients')
                    .update({ status: 'activo' })
                    .eq('id', activeEval.client_id)

                const sessionDate = new Date(`${firstSessionDate}T${firstSessionTime}:00`).toISOString()
                const { error: sessionError } = await supabase.from('sessions').insert({
                    client_id: activeEval.client_id,
                    session_number: 1,
                    date: sessionDate,
                    completed: false
                })
                if (sessionError) throw sessionError
            }

            setActiveEval(null)
            fetchEvaluations()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const filtered = evaluations.filter(e =>
        e.clients?.name?.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return <div>Cargando...</div>

    return (
        <div>
            <BackHeader title="Resultado Evaluación" onBack={onBack} />
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar cliente por nombre..." />

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
                    <ClipboardCheck size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 500 }}>No hay evaluaciones pendientes de resultado</p>
                    <p style={{ fontSize: '0.875rem' }}>Todas las evaluaciones agendadas tienen resultado</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(evalItem => (
                        <div
                            key={evalItem.id}
                            style={{
                                backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                                padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{evalItem.clients?.name || 'Cliente'}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                        {evalItem.clients?.dog_breed || 'Sin raza'}
                                    </div>
                                </div>
                                {evalItem.scheduled_date && (
                                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                        Evaluación: {new Date(evalItem.scheduled_date).toLocaleDateString('es-ES')}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => handleResult(evalItem, 'aprobada')}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                        padding: '0.625rem', borderRadius: '0.375rem',
                                        backgroundColor: '#f0fdf4', color: '#166534',
                                        border: '1px solid #bbf7d0', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    <CheckCircle size={16} /> Aceptar
                                </button>
                                <button
                                    onClick={() => handleResult(evalItem, 'rechazada')}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                        padding: '0.625rem', borderRadius: '0.375rem',
                                        backgroundColor: '#fef2f2', color: '#991b1b',
                                        border: '1px solid #fecaca', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
                                    }}
                                >
                                    <XCircle size={16} /> Rechazar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirm Result Modal */}
            <Modal isOpen={!!activeEval} onClose={() => setActiveEval(null)} title={activeEval?.selectedResult === 'aprobada' ? '✅ Aceptar Evaluación' : '❌ Rechazar Evaluación'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Cliente: <strong>{activeEval?.clients?.name}</strong>
                    </p>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Comentarios</label>
                        <textarea
                            value={comments}
                            onChange={e => setComments(e.target.value)}
                            placeholder="Notas sobre la evaluación..."
                            rows={3}
                            style={{
                                width: '100%', padding: '0.5rem', borderRadius: '0.375rem',
                                border: '1px solid #e5e7eb', resize: 'vertical', fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {activeEval?.selectedResult === 'aprobada' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Nº de Sesiones Recomendadas</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[8, 10, 12].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setTotalSessions(n)}
                                            style={{
                                                flex: 1, padding: '0.625rem', borderRadius: '0.375rem',
                                                border: totalSessions === n ? '2px solid #000' : '1px solid #e5e7eb',
                                                backgroundColor: totalSessions === n ? '#000' : 'white',
                                                color: totalSessions === n ? 'white' : '#374151',
                                                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                                            }}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <CalendarClock size={16} /> Agendar Primera Sesión
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Fecha</label>
                                        <input
                                            type="date"
                                            value={firstSessionDate}
                                            onChange={e => setFirstSessionDate(e.target.value)}
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Hora</label>
                                        <input
                                            type="time"
                                            value={firstSessionTime}
                                            onChange={e => setFirstSessionTime(e.target.value)}
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={() => setActiveEval(null)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmResult}
                            disabled={saving}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none',
                                background: activeEval?.selectedResult === 'aprobada' ? '#166534' : '#991b1b',
                                color: 'white', fontWeight: 600, cursor: 'pointer',
                                opacity: saving ? 0.6 : 1
                            }}
                        >
                            {saving ? 'Guardando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════════
// 3. AGENDAR SIGUIENTE SESIÓN
// ═══════════════════════════════════════════════════════════════════

function AgendarSesion({ onBack }: { onBack: () => void }) {
    const [clients, setClients] = useState<SessionClient[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [schedulingClient, setSchedulingClient] = useState<SessionClient | null>(null)
    const [sessionDate, setSessionDate] = useState('')
    const [sessionTime, setSessionTime] = useState('10:00')
    const [sessionComments, setSessionComments] = useState('')
    const [saving, setSaving] = useState(false)
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)

    const { cityId } = useFilters()

    useEffect(() => { fetchClients() }, [cityId])

    async function fetchClients() {
        setLoading(true)
        let query = supabase
            .from('clients')
            .select(`
                id, name, dog_breed, status,
                evaluations(total_sessions),
                sessions(id, session_number, completed, date)
            `)
            .eq('status', 'activo')

        if (cityId !== 'all') query = query.eq('city_id', cityId)
        const { data } = await query.order('name')

        if (data) {
            const mapped: SessionClient[] = data.map((c: any) => {
                const evals = Array.isArray(c.evaluations) ? c.evaluations : []
                const sessions = Array.isArray(c.sessions) ? c.sessions : []
                const totalSessions = evals[0]?.total_sessions || 8
                const completedSessions = sessions.filter((s: any) => s.completed)
                const completedCount = completedSessions.length
                const existingNumbers = sessions.map((s: any) => s.session_number)

                // Find the upcoming session (not completed)
                const upcoming = sessions
                    .filter((s: any) => !s.completed)
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]

                // Find the next session number to schedule
                let nextToSchedule = 1
                for (let i = 1; i <= totalSessions; i++) {
                    if (!existingNumbers.includes(i)) {
                        nextToSchedule = i
                        break
                    }
                }

                return {
                    id: c.id,
                    name: c.name,
                    dog_breed: c.dog_breed,
                    total_sessions: totalSessions,
                    completed_sessions: completedCount,
                    next_session_number: upcoming ? upcoming.session_number : nextToSchedule,
                    existing_session_numbers: existingNumbers,
                    upcoming_session: upcoming ? {
                        id: upcoming.id,
                        date: upcoming.date,
                        session_number: upcoming.session_number
                    } : null
                }
            })
            setClients(mapped)
        }
        setLoading(false)
    }

    async function handleFinishSession(client: SessionClient) {
        if (!client.upcoming_session) return

        setSaving(true)
        try {
            // Mark it complete
            const { error: updateError } = await supabase
                .from('sessions')
                .update({ completed: true })
                .eq('id', client.upcoming_session.id)

            if (updateError) throw updateError

            // Check if all sessions closed
            if (client.upcoming_session.session_number >= client.total_sessions) {
                await supabase.from('clients').update({ status: 'finalizado' }).eq('id', client.id)
                fetchClients()
                return
            }

            // Immediately prompt to schedule the next one
            const updatedClient = {
                ...client,
                completed_sessions: client.completed_sessions + 1,
                next_session_number: client.upcoming_session.session_number + 1
            }
            setSchedulingClient(updatedClient)
            setSessionDate(new Date().toISOString().split('T')[0])
            setSessionTime('10:00')
            setSessionComments('')
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleScheduleNext() {
        if (!schedulingClient || !sessionDate) return
        setSaving(true)
        try {
            const fullDate = new Date(`${sessionDate}T${sessionTime}:00`).toISOString()

            if (editingSessionId) {
                const { error } = await supabase.from('sessions')
                    .update({
                        date: fullDate,
                        comments: sessionComments || null,
                    })
                    .eq('id', editingSessionId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('sessions').insert({
                    client_id: schedulingClient.id,
                    session_number: schedulingClient.next_session_number,
                    date: fullDate,
                    comments: sessionComments || null,
                    completed: false
                })
                if (error) throw error
            }

            setSchedulingClient(null)
            setEditingSessionId(null)
            fetchClients()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const filtered = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return <div>Cargando...</div>

    return (
        <div>
            <BackHeader title="Agendar siguiente Sesión" onBack={onBack} />
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar cliente por nombre..." />

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
                    <CalendarClock size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p style={{ fontWeight: 500 }}>No hay clientes activos</p>
                    <p style={{ fontSize: '0.875rem' }}>Los clientes aparecerán aquí cuando su evaluación sea aceptada</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(client => {
                        const progress = (client.completed_sessions / client.total_sessions) * 100

                        return (
                            <div
                                key={client.id}
                                style={{
                                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                                    padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{client.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                            {client.dog_breed || 'Sin raza'}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                                        {client.completed_sessions}/{client.total_sessions}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${progress}%`, height: '100%',
                                            backgroundColor: progress >= 100 ? '#16a34a' : '#000',
                                            borderRadius: '9999px', transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                        Sesión {client.completed_sessions} de {client.total_sessions} completada{client.completed_sessions !== 1 ? 's' : ''}
                                    </div>
                                </div>

                                {/* Next Session Info */}
                                {client.upcoming_session ? (
                                    <div style={{
                                        backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem',
                                        fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div>
                                            <span style={{ color: '#6b7280' }}>Próxima (Sesión {client.upcoming_session.session_number}):</span>
                                            <div style={{ fontWeight: 600, color: '#000' }}>
                                                {new Date(client.upcoming_session.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <CalendarClock size={16} color="#9ca3af" />
                                            <button
                                                onClick={() => {
                                                    setSchedulingClient(client)
                                                    setEditingSessionId(client.upcoming_session!.id)

                                                    const dateObj = new Date(client.upcoming_session!.date)
                                                    setSessionDate(dateObj.toISOString().split('T')[0])
                                                    setSessionTime(dateObj.toTimeString().slice(0, 5))
                                                    setSessionComments('')
                                                }}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: '#2563eb', fontSize: '0.75rem', fontWeight: 600,
                                                    textDecoration: 'none', padding: 0
                                                }}
                                            >
                                                ✏️ Modificar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    client.completed_sessions < client.total_sessions && (
                                        <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 500, backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '0.375rem', textAlign: 'center' }}>
                                            ⚠️ Sesión {client.next_session_number} pendiente de agendar
                                        </div>
                                    )
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {client.upcoming_session ? (
                                        <button
                                            onClick={() => handleFinishSession(client)}
                                            disabled={saving}
                                            style={{
                                                flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                                padding: '0.75rem', borderRadius: '0.375rem',
                                                backgroundColor: '#000', color: 'white',
                                                border: 'none', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                                                opacity: saving ? 0.6 : 1
                                            }}
                                        >
                                            <CheckCircle size={16} /> Finalizar Sesión {client.upcoming_session.session_number} y Agendar Siguiente
                                        </button>
                                    ) : (
                                        client.completed_sessions < client.total_sessions && (
                                            <button
                                                onClick={() => {
                                                    setSchedulingClient(client)
                                                    setSessionDate(new Date().toISOString().split('T')[0])
                                                    setSessionTime('10:00')
                                                    setSessionComments('')
                                                }}
                                                style={{
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                                    padding: '0.75rem', borderRadius: '0.375rem',
                                                    backgroundColor: '#000', color: 'white',
                                                    border: 'none', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
                                                }}
                                            >
                                                <CalendarClock size={16} /> Agendar Sesión {client.next_session_number}
                                            </button>
                                        )
                                    )}
                                </div>

                                {client.completed_sessions >= client.total_sessions && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                        padding: '0.625rem', borderRadius: '0.375rem',
                                        backgroundColor: '#f0fdf4', color: '#166534',
                                        fontSize: '0.8rem', fontWeight: 600
                                    }}>
                                        <CheckCircle size={15} /> Programa completado
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Schedule / Edit Next Session Modal */}
            <Modal isOpen={!!schedulingClient} onClose={() => { setSchedulingClient(null); setEditingSessionId(null); }} title={editingSessionId ? `Modificar Sesión ${schedulingClient?.next_session_number}` : `Agendar Sesión ${schedulingClient?.next_session_number}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {editingSessionId ? 'Modificando' : 'Agendar'} sesión para <strong>{schedulingClient?.name}</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Fecha</label>
                            <input
                                type="date"
                                value={sessionDate}
                                onChange={e => setSessionDate(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Hora</label>
                            <input
                                type="time"
                                value={sessionTime}
                                onChange={e => setSessionTime(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Notas (opcional)</label>
                        <textarea
                            value={sessionComments}
                            onChange={e => setSessionComments(e.target.value)}
                            placeholder="Lugar, objetivos..."
                            rows={2}
                            style={{
                                width: '100%', padding: '0.5rem', borderRadius: '0.375rem',
                                border: '1px solid #e5e7eb', resize: 'vertical', fontSize: '0.875rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={() => { setSchedulingClient(null); setEditingSessionId(null); }}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleScheduleNext}
                            disabled={saving || !sessionDate}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none',
                                background: '#000', color: 'white', fontWeight: 600, cursor: 'pointer',
                                opacity: (saving || !sessionDate) ? 0.6 : 1
                            }}
                        >
                            {saving ? 'Guardando...' : (editingSessionId ? `Guardar Cambios` : `Confirmar Sesión ${schedulingClient?.next_session_number}`)}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════════
// 4. MODIFICAR FECHA SESIÓN
// ═══════════════════════════════════════════════════════════════════

function ModificarSesion({ onBack }: { onBack: () => void }) {
    const [clients, setClients] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedClient, setSelectedClient] = useState<any | null>(null)
    const [editingSession, setEditingSession] = useState<any | null>(null)
    const [newDate, setNewDate] = useState('')
    const [newTime, setNewTime] = useState('10:00')
    const [saving, setSaving] = useState(false)

    const { cityId } = useFilters()

    useEffect(() => { fetchClients() }, [cityId])

    async function fetchClients() {
        setLoading(true)
        // Fetch clients that have at least one session
        let query = supabase
            .from('clients')
            .select(`
            id, name, dog_breed,
            sessions ( id, session_number, date, completed, comments )
            `)

        if (cityId !== 'all') query = query.eq('city_id', cityId)

        const { data } = await query.order('name')

        if (data) {
            // Filter out clients with truly 0 sessions (if any)
            const filtered = data.filter((c: any) => c.sessions && c.sessions.length > 0)
            setClients(filtered)

            // If a client was already selected, update its data
            if (selectedClient) {
                const refreshed = filtered.find(c => c.id === selectedClient.id)
                if (refreshed) setSelectedClient(refreshed)
            }
        }
        setLoading(false)
    }

    async function handleUpdateSession() {
        if (!editingSession || !newDate) return
        setSaving(true)
        try {
            const fullDate = new Date(`${newDate}T${newTime}:00`).toISOString()
            const { error } = await supabase
                .from('sessions')
                .update({ date: fullDate })
                .eq('id', editingSession.id)

            if (error) throw error

            setEditingSession(null)
            fetchClients() // Refresh data
        } catch (err: any) {
            alert('Error al actualizar: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    if (loading && clients.length === 0) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>

    return (
        <div>
            <BackHeader title="Modificar Fecha Sesión" onBack={onBack} />

            {!selectedClient ? (
                <>
                    <SearchBar value={search} onChange={setSearch} placeholder="Buscar cliente..." />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredClients.map(client => (
                            <div
                                key={client.id}
                                onClick={() => setSelectedClient(client)}
                                style={{
                                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                                    padding: '1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#000'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{client.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                        {client.sessions.length} sesión{client.sessions.length !== 1 ? 'es' : ''} registrada{client.sessions.length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '50%' }}>
                                    <CalendarClock size={20} color="#000" />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div>
                    <button
                        onClick={() => setSelectedClient(null)}
                        style={{
                            background: 'none', border: 'none', color: '#6b7280',
                            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                            marginBottom: '1.25rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.4rem'
                        }}
                    >
                        <ArrowLeft size={16} /> Volver a la lista
                    </button>

                    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{selectedClient.name}</h2>
                            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.25rem' }}>{selectedClient.dog_breed || 'Sin raza'}</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                Historial de Sesiones
                            </div>
                            {selectedClient.sessions
                                .sort((a: any, b: any) => b.session_number - a.session_number)
                                .map((session: any) => (
                                    <div
                                        key={session.id}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.6rem',
                                            border: '1px solid #f3f4f6'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                Sesión {session.session_number}
                                                {session.completed && (
                                                    <span style={{ fontSize: '0.7rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700 }}>
                                                        COMPLETADA
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.850rem', color: '#4b5563', marginTop: '0.25rem' }}>
                                                {new Date(session.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                                                ⏰ {new Date(session.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setEditingSession(session)
                                                const d = new Date(session.date)
                                                setNewDate(d.toISOString().split('T')[0])
                                                setNewTime(d.toTimeString().slice(0, 5))
                                            }}
                                            style={{
                                                padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb',
                                                backgroundColor: 'white', color: '#111827', fontSize: '0.8rem',
                                                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db' }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e5e7eb' }}
                                        >
                                            Editar
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={!!editingSession} onClose={() => setEditingSession(null)} title={`Editar Sesión ${editingSession?.session_number}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>Fecha</label>
                            <input
                                type="date"
                                value={newDate}
                                onChange={e => setNewDate(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '1rem' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>Hora</label>
                            <input
                                type="time"
                                value={newTime}
                                onChange={e => setNewTime(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '1rem' }}
                            />
                        </div>
                    </div>

                    {editingSession?.completed && (
                        <div style={{ fontSize: '0.8rem', color: '#92400e', backgroundColor: '#fffbeb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fde68a', display: 'flex', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.25rem' }}>💡</div>
                            <div>
                                <strong>Nota sobre facturación:</strong> Al cambiar la fecha de una sesión ya completada, el sistema la moverá al mes correspondiente en tu panel de facturación.
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={() => setEditingSession(null)}
                            style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpdateSession}
                            disabled={saving || !newDate}
                            style={{
                                padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none',
                                background: '#000', color: 'white', fontWeight: 600, cursor: 'pointer',
                                opacity: (saving || !newDate) ? 0.6 : 1
                            }}
                        >
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

