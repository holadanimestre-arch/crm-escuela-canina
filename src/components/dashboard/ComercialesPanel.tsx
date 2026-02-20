import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { KPICard } from './KPICard'
import { Users, PhoneCall, CheckCircle, Target, DollarSign, Clock, Award } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts'
import { useFilters } from '../../context/FilterContext'
import { parseISO, differenceInHours } from 'date-fns'

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1']

export function ComercialesPanel() {
    const { cityId, dateRange } = useFilters()
    const [loading, setLoading] = useState(true)

    // Data states
    const [comerciales, setComerciales] = useState<any[]>([])
    const [leads, setLeads] = useState<any[]>([])
    const [clients, setClients] = useState<any[]>([])
    const [evaluations, setEvaluations] = useState<any[]>([])
    const [payments, setPayments] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // Fetch independently so if one table doesn't exist (like evaluations), it doesn't break the rest
                const [usersRes, leadsRes, clientsRes, evalsRes, paymentsRes] = await Promise.allSettled([
                    supabase.from('profiles').select('*').eq('role', 'comercial'),
                    supabase.from('leads').select('*'),
                    supabase.from('clients').select('*'),
                    supabase.from('evaluations').select('*'),
                    supabase.from('payments').select('*')
                ])

                if (usersRes.status === 'fulfilled' && usersRes.value.data) setComerciales(usersRes.value.data)
                if (leadsRes.status === 'fulfilled' && leadsRes.value.data) setLeads(leadsRes.value.data)
                if (clientsRes.status === 'fulfilled' && clientsRes.value.data) setClients(clientsRes.value.data)
                if (evalsRes.status === 'fulfilled' && evalsRes.value.data) setEvaluations(evalsRes.value.data)
                if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data) setPayments(paymentsRes.value.data)

            } catch (error) {
                console.error("Error general fetching data:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Calculate Metrics dynamically based on filters
    const metrics = useMemo(() => {
        // Filter by Date inside JS to make it responsive
        let filteredLeads = leads
        let filteredClients = clients
        let filteredEvals = evaluations
        let filteredPayments = payments

        // City Filter (Global context)
        if (cityId) {
            filteredLeads = filteredLeads.filter(l => l.city_id === cityId)
            filteredClients = filteredClients.filter(c => c.city_id === cityId)
            filteredEvals = filteredEvals.filter(e => e.city_id === cityId)
            // Need to join payment -> client -> city, it's easier to just use client's payments
        }

        // Date Filter (Global context)
        if (dateRange) {
            const { from, to } = dateRange
            filteredLeads = filteredLeads.filter(l => {
                const date = parseISO(l.created_at)
                return date >= from && date <= to
            })
            filteredClients = filteredClients.filter(c => {
                const date = parseISO(c.created_at)
                return date >= from && date <= to
            })
            filteredEvals = filteredEvals.filter(e => {
                const date = parseISO(e.created_at)
                return date >= from && date <= to
            })
            filteredPayments = filteredPayments.filter(p => {
                const date = parseISO(p.created_at)
                return date >= from && date <= to
            })
        }

        // Aggregate by Comercial
        const stats = comerciales.map(comercial => {
            const cLeads = filteredLeads.filter(l => l.comercial_id === comercial.id)
            const contactedLeads = cLeads.filter(l => l.status !== 'nuevo')
            const totalAssigned = cLeads.length
            const totalContacted = contactedLeads.length
            const contactRatio = totalAssigned > 0 ? (totalContacted / totalAssigned) * 100 : 0

            // Average First Contact Time (in hours)
            let totalContactTimeHours = 0
            let leadsWithContactTime = 0
            contactedLeads.forEach(l => {
                if (l.first_contacted_at) {
                    const hours = differenceInHours(parseISO(l.first_contacted_at), parseISO(l.created_at))
                    if (hours >= 0) {
                        totalContactTimeHours += hours
                        leadsWithContactTime++
                    }
                }
            })
            const avgContactTime = leadsWithContactTime > 0 ? totalContactTimeHours / leadsWithContactTime : 0

            // Conversion metrics
            const cClients = filteredClients.filter(c => cLeads.some(l => l.id === c.lead_id))
            const cEvals = filteredEvals.filter(e => cClients.some(c => c.id === e.client_id))
            const cPayments = filteredPayments.filter(p => cClients.some(c => c.id === p.client_id))

            const evaluationsAgended = cEvals.length
            const evaluationsApproved = cEvals.filter(e => e.result === 'aprobada').length

            // Programs sold = Clients with eval approved and probably an active status
            // The prompt says "Evaluaciones Aprobadas / Realizadas (#)" 
            // and Programas Vendidos. In our DB `client_status` is 'evaluado', 'activo', 'finalizado'. 'activo' implies they bought.
            // Or clients with at least 1 payment? Let's use clients with status IN ('activo', 'finalizado') as program buyers.
            const programsSold = cClients.filter(c => c.status === 'activo' || c.status === 'finalizado').length

            const revenue = cPayments.reduce((acc, p) => acc + Number(p.amount), 0)

            const evalApproveRatio = evaluationsAgended > 0 ? (evaluationsApproved / evaluationsAgended) * 100 : 0
            const globalConversion = totalAssigned > 0 ? (programsSold / totalAssigned) * 100 : 0

            return {
                id: comercial.id,
                name: comercial.full_name || 'Sin nombre',
                avatarUrl: comercial.avatar_url,
                totalAssigned,
                totalContacted,
                contactRatio,
                avgContactTime,
                evaluationsAgended,
                evaluationsApproved,
                evalApproveRatio,
                programsSold,
                revenue,
                globalConversion
            }
        })

        // Global KPIs
        let globalTotalAssigned = 0
        let globalTotalContacted = 0
        let globalEvalsAgended = 0
        let globalEvalsApproved = 0
        let globalProgramsSold = 0
        let globalRevenue = 0
        let globalContactTimeSum = 0
        let globalsWithContactTimeCount = 0

        stats.forEach(s => {
            globalTotalAssigned += s.totalAssigned
            globalTotalContacted += s.totalContacted
            globalEvalsAgended += s.evaluationsAgended
            globalEvalsApproved += s.evaluationsApproved
            globalProgramsSold += s.programsSold
            globalRevenue += s.revenue

            // To average contact time globally, we just re-sum from raw filtered leads or take weighted avg
        })

        // Exact recalculation for global avg time
        filteredLeads.filter(l => l.first_contacted_at).forEach(l => {
            const hours = differenceInHours(parseISO(l.first_contacted_at), parseISO(l.created_at))
            if (hours >= 0) {
                globalContactTimeSum += hours
                globalsWithContactTimeCount++
            }
        })

        const globalContactRatio = globalTotalAssigned > 0 ? (globalTotalContacted / globalTotalAssigned) * 100 : 0
        const globalEvalApproveRatio = globalEvalsAgended > 0 ? (globalEvalsApproved / globalEvalsAgended) * 100 : 0
        const globalEvalToProgramRatio = globalEvalsApproved > 0 ? (globalProgramsSold / globalEvalsApproved) * 100 : 0
        const globalConversion = globalTotalAssigned > 0 ? (globalProgramsSold / globalTotalAssigned) * 100 : 0
        const globalAvgContactTime = globalsWithContactTimeCount > 0 ? globalContactTimeSum / globalsWithContactTimeCount : 0

        return {
            stats,
            global: {
                totalAssigned: globalTotalAssigned,
                contactRatio: globalContactRatio,
                evalApproveRatio: globalEvalApproveRatio,
                programsSold: globalProgramsSold,
                revenue: globalRevenue,
                globalConversion,
                avgContactTime: globalAvgContactTime,
                leadToEvalRatio: globalTotalAssigned > 0 ? (globalEvalsAgended / globalTotalAssigned) * 100 : 0,
                evalToProgramRatio: globalEvalToProgramRatio
            }
        }
    }, [dateRange, comerciales, leads, clients, evaluations, payments, cityId])

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando métricas comerciales...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>



            {/* Comerciales Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {metrics.stats.map(s => (
                    <div key={s.id} style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '0.5rem', backgroundColor: '#e5e7eb', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {s.avatarUrl ? (
                                <img src={s.avatarUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <Users size={32} color="#9ca3af" />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1f2937' }}>{s.name}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{s.totalAssigned}</span>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Leads Asignados</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Global KPIs Container */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <KPICard title="Ratio Contacto" value={`${metrics.global.contactRatio.toFixed(0)}%`} icon={PhoneCall} color="#3b82f6" trend="Exitoso" trendUp />
                <KPICard title="% Eval. Aprobadas" value={`${metrics.global.evalApproveRatio.toFixed(0)}%`} icon={CheckCircle} color="#10b981" trend="De agendadas" trendUp />
                <KPICard title="Progs. Vendidos" value={metrics.global.programsSold} icon={Target} color="#8b5cf6" trend="Total" trendUp />
                <KPICard title="Ingresos" value={`€${metrics.global.revenue.toLocaleString()}`} icon={DollarSign} color="#f59e0b" trend="Volumen" trendUp />
                <KPICard title="T. Medio Primer Contacto" value={metrics.global.avgContactTime > 0 ? `${metrics.global.avgContactTime.toFixed(1)}h` : 'N/A'} icon={Clock} color="#64748b" trend="Rapidez" trendUp={metrics.global.avgContactTime < 24} />
                <KPICard title="Conversión Global" value={`${metrics.global.globalConversion.toFixed(1)}%`} icon={Award} color="#ec4899" trend="Lead a Venta" trendUp />
            </div>

            {/* Charts Area */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

                {/* Ratio Contacto Chart */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Ratio de Contacto (%)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Ratio']}
                                />
                                <Bar dataKey="contactRatio" name="Ratio" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Eval Approved Chart */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Evaluaciones Aprobadas (%)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Aprobadas']}
                                />
                                <Bar dataKey="evalApproveRatio" name="Aprobadas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Programs Sold Chart */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Programas Vendidos (#)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="programsSold" name="Vendidos" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue Chart */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Ingresos Generados (€)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    formatter={(value: number) => [`€${value.toLocaleString()}`, 'Ingresos']}
                                />
                                <Bar dataKey="revenue" name="Ingresos" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Avg Contact Time Chart */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Tiempo Medio Primer Contacto (h)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    formatter={(value: number) => [`${value.toFixed(1)}h`, 'Tiempo']}
                                />
                                <Bar dataKey="avgContactTime" name="Tiempo" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Global Conversion Chart */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>Conversión Global (%)</h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conversión']}
                                />
                                <Bar dataKey="globalConversion" name="Conversión" fill="#ec4899" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {metrics.stats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conversion Funnel Donuts */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '2rem', flexWrap: 'wrap' }}>

                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, textAlign: 'center', marginBottom: '1rem' }}>Ratio Lead a Evaluación</h3>
                        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={[{ name: 'Eval Agendada', value: metrics.global.leadToEvalRatio }, { name: 'Perdido', value: 100 - metrics.global.leadToEvalRatio }]}
                                        cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                                        dataKey="value" startAngle={90} endAngle={-270} stroke="none"
                                    >
                                        <Cell fill="#3b82f6" />
                                        <Cell fill="#e5e7eb" />
                                    </Pie>
                                    <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>
                                {metrics.global.leadToEvalRatio.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, textAlign: 'center', marginBottom: '1rem' }}>Evaluación a Adiestramiento</h3>
                        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={[{ name: 'Venta Cerrada', value: metrics.global.evalToProgramRatio }, { name: 'No Compra', value: 100 - metrics.global.evalToProgramRatio }]}
                                        cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                                        dataKey="value" startAngle={90} endAngle={-270} stroke="none"
                                    >
                                        <Cell fill="#8b5cf6" />
                                        <Cell fill="#e5e7eb" />
                                    </Pie>
                                    <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>
                                {metrics.global.evalToProgramRatio.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Ranking Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: '#1f2937' }}>Ranking Comercial</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>Comercial</th>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>Leads</th>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>Contactados</th>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>% Eval. Aprobada</th>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>Eval. (#)</th>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>Ingresos</th>
                                <th style={{ padding: '1rem', fontWeight: 600, borderBottom: '2px solid #c7d2fe' }}>Conversión</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.stats.map((s, idx) => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#fcfcfc' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {s.avatarUrl ? (
                                                <img src={s.avatarUrl} alt={s.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Users size={16} color="#9ca3af" />
                                                </div>
                                            )}
                                            {s.name}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{s.totalAssigned}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>{s.contactRatio.toFixed(0)}%</span>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>({s.totalContacted})</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{s.evalApproveRatio.toFixed(0)}%</td>
                                    <td style={{ padding: '1rem' }}>{s.evaluationsApproved}</td>
                                    <td style={{ padding: '1rem', fontWeight: 500, color: '#059669' }}>€{s.revenue.toLocaleString()}</td>
                                    <td style={{ padding: '1rem' }}>{s.globalConversion.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
