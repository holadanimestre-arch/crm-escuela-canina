import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { KPICard } from './KPICard'
import { ClipboardCheck, PlayCircle, Clock, DollarSign, Award } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Cell
} from 'recharts'
import { useFilters } from '../../context/FilterContext'
import { parseISO, differenceInDays } from 'date-fns'

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1']

export function AdiestradoresPanel() {
    const { cityId, dateRange } = useFilters()
    const [loading, setLoading] = useState(true)

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

    const metrics = useMemo(() => {
        // 1. Initial Filtering
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

        // 2. Aggregate by Trainer
        const stats = adiestradores.map(trainer => {
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

        // 3. Global Stats
        const globalEvals = stats.reduce((acc, s) => acc + s.totalEvals, 0)
        const globalApproved = stats.reduce((acc, s) => acc + s.approvedEvals, 0)
        const globalSessions = stats.reduce((acc, s) => acc + s.completedSessions, 0)
        const globalRevenue = stats.reduce((acc, s) => acc + s.revenue, 0)
        const globalActiveClients = stats.reduce((acc, s) => acc + s.activeClients, 0)

        let sumAvgDays = 0
        let trainersWithAvgDays = 0
        stats.forEach(s => {
            if (s.avgDaysToFirstSession > 0) {
                sumAvgDays += s.avgDaysToFirstSession
                trainersWithAvgDays++
            }
        })

        return {
            stats,
            global: {
                totalEvals: globalEvals,
                successRatio: globalEvals > 0 ? (globalApproved / globalEvals) * 100 : 0,
                completedSessions: globalSessions,
                activeClients: globalActiveClients,
                revenue: globalRevenue,
                avgDaysToFirstSession: trainersWithAvgDays > 0 ? sumAvgDays / trainersWithAvgDays : 0
            }
        }
    }, [cityId, dateRange, adiestradores, evaluations, sessions, clients, payments])

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando métricas de adiestradores...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {metrics.stats.map(s => (
                    <div key={s.id} style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '0.5rem', backgroundColor: '#f3f4f6', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {s.avatarUrl ? (
                                <img src={s.avatarUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <ClipboardCheck size={24} color="#8b5cf6" />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{s.name}</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{s.activeClients} Alumnos</span>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#8b5cf6' }}>{s.successRatio.toFixed(0)}% Éxito</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <KPICard title="Evaluaciones" value={metrics.global.totalEvals} icon={ClipboardCheck} color="#8b5cf6" trend="Realizadas" trendUp />
                <KPICard title="Éxito Eval." value={`${metrics.global.successRatio.toFixed(0)}%`} icon={Award} color="#10b981" trend="Aprobadas" trendUp />
                <KPICard title="Sesiones" value={metrics.global.completedSessions} icon={PlayCircle} color="#3b82f6" trend="Impartidas" trendUp />
                <KPICard title="Ingresos" value={`€${metrics.global.revenue.toLocaleString()}`} icon={DollarSign} color="#f59e0b" trend="Generados" trendUp />
                <KPICard title="T. Medio 1ª Sesión" value={`${metrics.global.avgDaysToFirstSession.toFixed(1)}d`} icon={Clock} color="#64748b" trend="Rapidez" trendUp={metrics.global.avgDaysToFirstSession < 7} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Carga de Alumnos Activos (#)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="activeClients" name="Alumnos" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Sesiones Impartidas (#)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="completedSessions" name="Sesiones" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Ranking de Adiestradores</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                                <th style={{ padding: '1rem' }}>Adiestrador</th>
                                <th style={{ padding: '1rem' }}>Eval. (#)</th>
                                <th style={{ padding: '1rem' }}>Éxito (%)</th>
                                <th style={{ padding: '1rem' }}>Sesiones</th>
                                <th style={{ padding: '1rem' }}>Alumnos</th>
                                <th style={{ padding: '1rem' }}>Ingresos</th>
                                <th style={{ padding: '1rem' }}>T. Medio 1ª Ses.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.stats.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{s.name}</td>
                                    <td style={{ padding: '1rem' }}>{s.totalEvals}</td>
                                    <td style={{ padding: '1rem' }}>{s.successRatio.toFixed(0)}%</td>
                                    <td style={{ padding: '1rem' }}>{s.completedSessions}</td>
                                    <td style={{ padding: '1rem' }}>{s.activeClients}</td>
                                    <td style={{ padding: '1rem', fontWeight: 500, color: '#059669' }}>€{s.revenue.toLocaleString()}</td>
                                    <td style={{ padding: '1rem' }}>{s.avgDaysToFirstSession.toFixed(1)}d</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
