import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFilters } from '../context/FilterContext'
import { CheckCircle, MessageCircle, ArrowLeft } from 'lucide-react'
import { Modal } from '../components/Modal'
import { Calendar as BigCalendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = {
    'es': es,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})

export function AgendaView({ onBack }: { onBack?: () => void }) {
    const navigate = useNavigate()
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
    const [view, setView] = useState<View>(window.innerWidth < 768 ? 'agenda' : 'month')
    const [date, setDate] = useState(new Date())
    const [isLinked, setIsLinked] = useState(false)
    const { cityId } = useFilters()
    const { profile } = useAuth()

    const handleBack = () => {
        if (onBack) onBack()
        else navigate('/')
    }

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768 && view !== 'agenda') {
                setView('agenda')
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [view])

    useEffect(() => {
        fetchAgenda()
        checkCalendarLink()
    }, [cityId])

    async function checkCalendarLink() {
        if (!profile) return
        const { data } = await supabase
            .from('adiestrador_calendar_tokens')
            .select('user_id')
            .eq('user_id', profile.id)
            .single()
        setIsLinked(!!data)
    }

    const handleLinkGoogle = () => {
        if (!profile) return
        window.location.href = `https://gufbkrzpalsrizkqusyr.supabase.co/functions/v1/google-calendar-auth?userId=${profile.id}`
    }

    async function fetchAgenda() {
        setLoading(true)
        try {
            // 1. Fetch Sessions
            let sessionsQuery = supabase
                .from('sessions')
                .select('id, date, session_number, completed, comments, client_id, adiestrador_id, clients!inner(id, name, phone, dog_breed, city_id)')
            
            if (cityId !== 'all') {
                sessionsQuery = sessionsQuery.eq('clients.city_id', cityId)
            }
            if (profile?.role === 'adiestrador') {
                sessionsQuery = sessionsQuery.eq('adiestrador_id', profile.id)
            }
            
            const { data: sessionsData } = await sessionsQuery

            // 2. Fetch Evaluations
            let evalsQuery = supabase
                .from('evaluations')
                .select('id, scheduled_date, comments, client_id, city_id, adiestrador_id, clients!inner(id, name, phone, dog_breed, city_id)')
                .is('result', null)

            if (cityId !== 'all') {
                evalsQuery = evalsQuery.eq('city_id', cityId)
            }
            if (profile?.role === 'adiestrador') {
                evalsQuery = evalsQuery.eq('adiestrador_id', profile.id)
            }

            const { data: evalsData } = await evalsQuery

            const mappedEvents: any[] = []

            if (sessionsData) {
                sessionsData.forEach((s: any) => {
                    const start = new Date(s.date)
                    mappedEvents.push({
                        id: s.id,
                        title: `${s.clients?.name || 'Cliente'} (S${s.session_number})`,
                        start: start,
                        end: new Date(start.getTime() + 60 * 60 * 1000), // Default 1h
                        resource: { ...s, client: s.clients },
                        type: 'session',
                        completed: s.completed
                    })
                })
            }

            if (evalsData) {
                evalsData.forEach((e: any) => {
                    if (!e.scheduled_date) return
                    const start = new Date(e.scheduled_date)
                    mappedEvents.push({
                        id: e.id,
                        title: `EVAL: ${e.clients?.name || 'Cliente'}`,
                        start: start,
                        end: new Date(start.getTime() + 60 * 60 * 1000),
                        resource: { ...e, client: e.clients },
                        type: 'evaluation'
                    })
                })
            }

            setEvents(mappedEvents)
        } catch (err) {
            console.error('Error fetching agenda:', err)
        } finally {
            setLoading(false)
        }
    }

    const eventStyleGetter = (event: any) => {
        let backgroundColor = event.type === 'session' ? '#000' : '#f59e0b' // Black for sessions, Orange for evals
        if (event.completed) backgroundColor = '#10b981' // Green if completed

        return {
            style: {
                backgroundColor,
                borderRadius: '6px',
                opacity: 0.9,
                color: 'white',
                border: 'none',
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 5px'
            }
        }
    }

    const handleSelectEvent = (event: any) => {
        setSelectedEvent(event)
    }

    const handleWhatsApp = () => {
        if (!selectedEvent?.resource?.client?.phone) return
        const phone = selectedEvent.resource.client.phone.replace(/\s+/g, '')
        const message = encodeURIComponent(`Hola ${selectedEvent.resource.client.name}, soy tu adiestrador de Escuela Canina. Te escribo por nuestra cita de hoy...`)
        window.open(`https://wa.me/${phone.startsWith('+') ? phone : '+34' + phone}?text=${message}`, '_blank')
    }

    const handleFinishSession = async () => {
        if (!selectedEvent || selectedEvent.type !== 'session') return
        if (selectedEvent.completed) return

        if (!confirm('¿Marcar esta sesión como completada?')) return

        try {
            const { error } = await supabase
                .from('sessions')
                .update({ completed: true })
                .eq('id', selectedEvent.id)

            if (error) throw error

            // Re-fetch to update calendar
            fetchAgenda()
            setSelectedEvent(null)
            alert('Sesión completada correctamente')
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    if (loading && events.length === 0) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando agenda...</div>

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {onBack && (
                        <button
                            onClick={handleBack}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '36px', height: '36px', borderRadius: '50%',
                                border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer'
                            }}
                        >
                            <ArrowLeft size={18} color="#000" />
                        </button>
                    )}
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Agenda</h1>
                </div>

                <div style={{ marginLeft: window.innerWidth < 640 ? '0' : 'auto', width: window.innerWidth < 640 ? '100%' : 'auto' }}>
                    {isLinked ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', backgroundColor: '#dcfce7', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, width: 'fit-content' }}>
                            <CheckCircle size={16} /> <span style={{ whiteSpace: 'nowrap' }}>Google Calendar Vinculado</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleLinkGoogle}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                                backgroundColor: '#fff', border: '1px solid #e5e7eb',
                                color: '#374151', fontSize: '0.8rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.2s', width: window.innerWidth < 640 ? '100%' : 'auto',
                                justifyContent: 'center'
                            }}
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '16px', height: '16px' }} />
                            Vincular Google Calendar
                        </button>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    messages={{
                        next: "Sig.",
                        previous: "Ant.",
                        today: "Hoy",
                        month: "Mes",
                        week: "Semana",
                        day: "Día",
                        agenda: "Agenda",
                        date: "Fecha",
                        time: "Hora",
                        event: "Evento",
                        noEventsInRange: "No hay citas en este rango"
                    }}
                    culture='es'
                    view={view}
                    onView={(v) => setView(v)}
                    date={date}
                    onNavigate={(d) => setDate(d)}
                    eventPropGetter={eventStyleGetter}
                    onSelectEvent={handleSelectEvent}
                    views={['month', 'week', 'day', 'agenda']}
                />
            </div>

            {/* Event Detail Modal */}
            <Modal
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                title={selectedEvent?.type === 'session' ? '📅 Detalle de Sesión' : '🔍 Detalle de Evaluación'}
            >
                {selectedEvent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                                    {selectedEvent.resource.client?.name}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                    {selectedEvent.resource.client?.dog_breed || 'Sin raza especificada'}
                                </div>
                            </div>
                            <div style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '9999px',
                                backgroundColor: selectedEvent.type === 'session' ? '#eff6ff' : '#fff7ed',
                                color: selectedEvent.type === 'session' ? '#1e40af' : '#9a3412',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>
                                {selectedEvent.type === 'session' ? `Sesión ${selectedEvent.resource.session_number}` : 'Evaluación'}
                            </div>
                        </div>

                        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Fecha</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{format(selectedEvent.start, 'EEEE d MMMM', { locale: es })}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Hora</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{format(selectedEvent.start, 'HH:mm')}</div>
                            </div>
                        </div>

                        {selectedEvent.resource.comments && (
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Notas</div>
                                <div style={{ fontSize: '0.9rem', color: '#4b5563', backgroundColor: '#fff', border: '1px solid #e5e7eb', padding: '0.75rem', borderRadius: '0.5rem', fontStyle: 'italic' }}>
                                    "{selectedEvent.resource.comments}"
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button
                                onClick={handleWhatsApp}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    padding: '0.875rem', borderRadius: '0.5rem', backgroundColor: '#25d366', color: 'white',
                                    border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '1rem'
                                }}
                            >
                                <MessageCircle size={20} /> Contactar por WhatsApp
                            </button>

                            {selectedEvent.type === 'session' && !selectedEvent.completed && (
                                <button
                                    onClick={handleFinishSession}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                        padding: '0.875rem', borderRadius: '0.5rem', backgroundColor: '#000', color: 'white',
                                        border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '1rem'
                                    }}
                                >
                                    <CheckCircle size={20} /> Marcar como Finalizada
                                </button>
                            )}

                            {selectedEvent.completed && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#dcfce7', color: '#166534',
                                    fontSize: '0.9rem', fontWeight: 700
                                }}>
                                    <CheckCircle size={18} /> Esta sesión ya está completada
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <style>{`
                .rbc-calendar {
                    font-family: inherit;
                }
                .rbc-event {
                    transition: transform 0.1s ease;
                }
                .rbc-event:hover {
                    transform: scale(1.02);
                    filter: brightness(1.1);
                }
                .rbc-off-range-bg {
                    background-color: #f9fafb;
                }
                .rbc-today {
                    background-color: #fefce8;
                }
                .rbc-active {
                    background-color: #000 !important;
                    color: white !important;
                }
                .rbc-toolbar button:active, .rbc-toolbar button.rbc-active {
                    background-color: #000 !important;
                    color: white !important;
                    box-shadow: none !important;
                }
                .rbc-toolbar button {
                    color: #374151;
                    font-weight: 600;
                    border: 1px solid #e5e7eb;
                }
                .rbc-toolbar button:hover {
                    background-color: #f3f4f6;
                }
                .rbc-toolbar {
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .rbc-toolbar-label {
                    width: 100%;
                    order: -1;
                    margin-bottom: 5px;
                    font-weight: 700;
                    font-size: 1rem;
                }
                @media (max-width: 768px) {
                    .rbc-toolbar button {
                        padding: 4px 8px;
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </div>
    )
}
