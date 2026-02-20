import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { ClipboardCheck, Clock, Award, Search, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { useFilters } from '../../context/FilterContext'
import { parseISO, differenceInDays } from 'date-fns'

export function AdiestradoresPanel() {
    const { cityId, dateRange } = useFilters()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState<'name' | 'activeClients' | 'revenue' | 'successRatio'>('activeClients')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Data states
    const [adiestradores, setAdiestradores] = useState<any[]>([])
    const [evaluations, setEvaluations] = useState<any[]>([])
    const [sessions, setSessions] = useState<any[]>([])
    const [clients, setClients] = useState<any[]>([])
    const [payments, setPayments] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const [usersRes, evalsRes, sessionsRes, clientsRes, paymentsRes] = await Promise.allSettled([
                    supabase.from('profiles').select('*').eq('role', 'adiestrador'),
                    supabase.from('evaluations').select('*'),
                    supabase.from('sessions').select('*'),
                    supabase.from('clients').select('*'),
                    supabase.from('payments').select('*')
                ])

                if (usersRes.status === 'fulfilled' && usersRes.value.data) setAdiestradores(usersRes.value.data)
                if (evalsRes.status === 'fulfilled' && evalsRes.value.data) setEvaluations(evalsRes.value.data)
                if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data) setSessions(sessionsRes.value.data)
                if (clientsRes.status === 'fulfilled' && clientsRes.value.data) setClients(clientsRes.value.data)
                if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data) setPayments(paymentsRes.value.data)

            } catch (error) {
                console.error("Error fetching trainer data:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const trainerStats = useMemo(() => {
        // Initial Filtering
        let filteredEvals = evaluations
        let filteredSessions = sessions
        let filteredClients = clients
        let filteredPayments = payments

        if (cityId !== 'all') {
            filteredEvals = filteredEvals.filter(e => e.city_id === cityId)
            filteredClients = filteredClients.filter(c => c.city_id === cityId)
            const cityClientIds = new Set(clients.filter(c => c.city_id === cityId).map(c => c.id))
            filteredSessions = filteredSessions.filter(s => cityClientIds.has(s.client_id))
            filteredPayments = filteredPayments.filter(p => cityClientIds.has(p.client_id))
        }

        if (dateRange) {
            const { from, to } = dateRange
            filteredEvals = filteredEvals.filter(e => {
                const date = parseISO(e.created_at)
                return date >= from && date <= to
            })
            filteredSessions = filteredSessions.filter(s => {
                const date = parseISO(s.date)
                return date >= from && date <= to
            })
            filteredPayments = filteredPayments.filter(p => {
                const date = parseISO(p.created_at)
                return date >= from && date <= to
            })
        }

        // Aggregate by Trainer
        let stats = adiestradores.map(trainer => {
            const tEvals = filteredEvals.filter(e => e.adiestrador_id === trainer.id)
            const tClientIds = new Set(evaluations.filter(e => e.adiestrador_id === trainer.id).map(e => e.client_id))

            const totalEvals = tEvals.length
            const approvedEvals = tEvals.filter(e => e.result === 'aprobada').length
            const successRatio = totalEvals > 0 ? (approvedEvals / totalEvals) * 100 : 0

            const tSessions = filteredSessions.filter(s => tClientIds.has(s.client_id))
            const completedSessions = tSessions.filter(s => s.completed).length

            const activeClients = clients.filter(c => c.status === 'activo' && tClientIds.has(c.id)).length

            const tPayments = filteredPayments.filter(p => tClientIds.has(p.client_id))
            const revenue = tPayments.reduce((acc, p) => acc + Number(p.amount), 0)

            let totalDaysToFirstSession = 0
            let clientsWithFirstSession = 0

            clients.filter(c => tClientIds.has(c.id)).forEach(client => {
                const evalDate = client.evaluation_done_at ? parseISO(client.evaluation_done_at) : null
                const firstSession = sessions.find(s => s.client_id === client.id && s.session_number === 1)
                const firstSessionDate = firstSession ? parseISO(firstSession.date) : null

                if (evalDate && firstSessionDate) {
                    const days = differenceInDays(firstSessionDate, evalDate)
                    if (days >= 0) {
                        totalDaysToFirstSession += days
                        clientsWithFirstSession++
                    }
                }
            })

            const avgDaysToFirstSession = clientsWithFirstSession > 0 ? totalDaysToFirstSession / clientsWithFirstSession : 0

            return {
                id: trainer.id,
                name: trainer.full_name || 'Sin nombre',
                avatarUrl: trainer.avatar_url,
                totalEvals,
                approvedEvals,
                successRatio,
                completedSessions,
                activeClients,
                revenue,
                avgDaysToFirstSession
            }
        })

        // Filter by Search
        if (searchTerm) {
            stats = stats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        }

        // Sort
        stats.sort((a, b) => {
            let valA = a[sortBy]
            let valB = b[sortBy]
            if (typeof valA === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA)
            }
            return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
        })

        return stats
    }, [cityId, dateRange, adiestradores, evaluations, sessions, clients, payments, searchTerm, sortBy, sortOrder])

    const handleSort = (field: typeof sortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('desc')
        }
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando analítica individual...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Search and Sort Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Buscar adiestrador por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', fontSize: '0.9rem' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleSort('activeClients')} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', backgroundColor: sortBy === 'activeClients' ? '#f3f4f6' : 'white', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Alumnos {sortBy === 'activeClients' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                    <button onClick={() => handleSort('revenue')} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', backgroundColor: sortBy === 'revenue' ? '#f3f4f6' : 'white', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Ingresos {sortBy === 'revenue' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                    <button onClick={() => handleSort('successRatio')} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', backgroundColor: sortBy === 'successRatio' ? '#f3f4f6' : 'white', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Éxito {sortBy === 'successRatio' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                </div>
            </div>

            {/* Individual Trainer Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
                {trainerStats.map(s => (
                    <div key={s.id} style={{
                        backgroundColor: 'white',
                        borderRadius: '0.8rem',
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'transform 0.2s',
                    }}>
                        {/* Card Header Profile */}
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f3f4f6', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
                                {s.avatarUrl ? (
                                    <img src={s.avatarUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>
                                        {s.name[0]}
                                    </div>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#111827' }}>{s.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem', backgroundColor: '#eef2ff', color: '#4f46e5', fontWeight: 600 }}>
                                        Adiestrador
                                    </span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>€{Math.round(s.revenue).toLocaleString()}</div>
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Ingresos</div>
                            </div>
                        </div>

                        {/* Metrics Content */}
                        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* Success Metric */}
                            <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280' }}>
                                    <Award size={14} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Éxito Técnico</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{s.successRatio.toFixed(0)}%</span>
                                    {s.successRatio > 70 ? <TrendingUp size={14} color="#10b981" /> : <TrendingDown size={14} color="#f59e0b" />}
                                </div>
                            </div>

                            {/* Active Clients Metric */}
                            <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280' }}>
                                    <Users size={14} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Alumnos Activos</span>
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8b5cf6' }}>{s.activeClients}</div>
                            </div>

                            {/* Evaluations Metric */}
                            <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280' }}>
                                    <ClipboardCheck size={14} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Evaluaciones</span>
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{s.totalEvals}</div>
                            </div>

                            {/* Speed Metric */}
                            <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280' }}>
                                    <Clock size={14} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Inicio Prog.</span>
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{s.avgDaysToFirstSession.toFixed(1)}d</div>
                            </div>
                        </div>

                        {/* Progress Footer */}
                        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#fdfdff', borderTop: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem' }}>
                                <span>Sesiones ejecutadas</span>
                                <span style={{ fontWeight: 700, color: '#4f46e5' }}>{s.completedSessions}</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, (s.completedSessions / (s.activeClients * 8 || 1)) * 100)}%`, height: '100%', backgroundColor: '#8b5cf6' }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detailed Table (Collapsed version as reference) */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Tabla Resumen</h3>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{trainerStats.length} adiestradores encontrados</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>Adiestrador</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Eval.</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Éxito %</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Sesiones</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Alumnos</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Ingresos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trainerStats.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.name}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{s.totalEvals}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{s.successRatio.toFixed(0)}%</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{s.completedSessions}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{s.activeClients}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#059669' }}>€{s.revenue.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
