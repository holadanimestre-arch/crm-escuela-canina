import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { KPICard } from '../../components/dashboard/KPICard'
import {
    Users, UserCheck, DollarSign, Activity, TrendingUp
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts'
import { useFilters } from '../../context/FilterContext'
import { subMonths, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ComercialesPanel } from '../../components/dashboard/ComercialesPanel'
import { AdiestradoresPanel } from '../../components/dashboard/AdiestradoresPanel'

export function AdminDashboard() {
    const { cityId, dateRange } = useFilters()
    const [activeTab, setActiveTab] = useState<'direccion' | 'marketing' | 'equipo' | 'adiestradores'>('direccion')
    const [loading, setLoading] = useState(true)
    const [kpiData, setKpiData] = useState({
        revenue: 0,
        activeClients: 0,
        newLeads: 0,
        conversionRate: 0,
        completedSessions: 0,
        totalSessions: 0,
        pendingEvaluations: 0,
        evalSuccess: 0,
        evalData: [] as any[]
    })
    const [revenueData, setRevenueData] = useState<any[]>([])

    // Marketing Placeholders (To be connected to API later)
    // We'll scale these based on the city filter to simulate reality
    const isFiltered = cityId !== 'all'
    const scaleFactor = isFiltered ? 0.3 : 1
    const marketingStats = {
        adSpend: 12500 * scaleFactor,
        totalLeads: 625 * scaleFactor,
        cpl: 20,
        cac: 147,
        roi: 58,
        funnel: [
            { stage: 'Leads Captados', value: Math.round(625 * scaleFactor), percentage: 100, color: '#3b82f6' },
            { stage: 'Contactados', value: Math.round(500 * scaleFactor), percentage: 80, color: '#06b6d4' },
            { stage: 'Eval. Aceptadas', value: Math.round(350 * scaleFactor), percentage: 70, color: '#10b981' },
            { stage: 'Eval. Realizadas', value: Math.round(300 * scaleFactor), percentage: 86, color: '#f59e0b' },
            { stage: 'Progs. Vendidos', value: Math.round(85 * scaleFactor), percentage: 28, color: '#ef4444' },
        ],
        cities: [
            { name: 'Madrid', leads: 124, cpl: 18, eval: 72, sales: 28, revenue: 11200, margin: 62 },
            { name: 'Barcelona', leads: 110, cpl: 22, eval: 65, sales: 20, revenue: 8400, margin: 55 },
            { name: 'Valencia', leads: 98, cpl: 19, eval: 68, sales: 18, revenue: 7200, margin: 58 },
            { name: 'Sevilla', leads: 85, cpl: 25, eval: 60, sales: 14, revenue: 5600, margin: 51 },
            { name: 'Málaga', leads: 78, cpl: 21, eval: 63, sales: 13, revenue: 4100, margin: 49 },
        ].filter(c => cityId === 'all' || c.name.toLowerCase() === 'madrid') // Example filtering
    }

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const fromStr = dateRange.from.toISOString()
                const toStr = dateRange.to.toISOString()

                // 1. Fetch Key Metrics with Filters

                // Revenue (Total in Period/City)
                let paymentsQuery = supabase
                    .from('payments')
                    .select('amount, created_at, clients!inner(city_id)')
                    .gte('created_at', fromStr)
                    .lte('created_at', toStr)

                if (cityId !== 'all') {
                    paymentsQuery = paymentsQuery.eq('clients.city_id', cityId)
                }
                const { data: payments } = await paymentsQuery
                const totalRevenue = payments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

                // Active Clients (Currently Active in City)
                let clientsQuery = supabase
                    .from('clients')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'activo')

                if (cityId !== 'all') {
                    clientsQuery = clientsQuery.eq('city_id', cityId)
                }
                const { count: activeClientsCount } = await clientsQuery

                // New Leads (In Period/City)
                let leadsQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', fromStr)
                    .lte('created_at', toStr)

                if (cityId !== 'all') {
                    leadsQuery = leadsQuery.eq('city_id', cityId)
                }
                const { count: newLeadsCount } = await leadsQuery

                // Conversion Rate Calculation
                const { count: totalLeads } = await (cityId !== 'all'
                    ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('city_id', cityId).gte('created_at', fromStr).lte('created_at', toStr)
                    : supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', fromStr).lte('created_at', toStr))

                const { count: totalConverted } = await (cityId !== 'all'
                    ? supabase.from('clients').select('*', { count: 'exact', head: true }).eq('city_id', cityId).gte('created_at', fromStr).lte('created_at', toStr)
                    : supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', fromStr).lte('created_at', toStr))

                const conversionRate = totalLeads ? Math.round((totalConverted! / totalLeads) * 100) : 0

                // Sessions Progress
                let sessionsQuery = supabase
                    .from('sessions')
                    .select('completed, clients!inner(city_id)')
                    .gte('date', fromStr)
                    .lte('date', toStr)

                if (cityId !== 'all') {
                    sessionsQuery = sessionsQuery.eq('clients.city_id', cityId)
                }
                const { data: sessions } = await sessionsQuery
                const completedSessions = sessions?.filter(s => s.completed).length || 0
                const totalSessions = sessions?.length || 0

                // (Later: we can group these by source if we want a real funnel)

                // 2. Revenue Trend (Last 6 Months)
                // We keep this global or filter by city for the trend
                const last6Months = Array.from({ length: 6 }, (_, i) => {
                    const date = subMonths(new Date(), 5 - i)
                    return {
                        date,
                        name: format(date, 'MMM', { locale: es }),
                        fullDate: format(date, 'yyyy-MM'),
                        value: 0
                    }
                })

                let trendQuery = supabase.from('payments').select('amount, created_at, clients!inner(city_id)')
                if (cityId !== 'all') {
                    trendQuery = trendQuery.eq('clients.city_id', cityId)
                }
                const { data: trendPayments } = await trendQuery

                if (trendPayments) {
                    trendPayments.forEach(payment => {
                        const paymentDate = parseISO(payment.created_at)
                        const monthKey = format(paymentDate, 'yyyy-MM')
                        const monthData = last6Months.find(d => d.fullDate === monthKey)
                        if (monthData) {
                            monthData.value += Number(payment.amount)
                        }
                    })
                }
                setRevenueData(last6Months)

                // 3. Evaluations stats for the "Éxito en Evaluaciones" chart
                let evalsQuery = supabase
                    .from('evaluations')
                    .select('result, city_id')
                    .gte('created_at', fromStr)
                    .lte('created_at', toStr)

                if (cityId !== 'all') evalsQuery = evalsQuery.eq('city_id', cityId)
                const { data: evaluations } = await evalsQuery

                let evalStats = { approved: 0, rejected: 0, total: 0 }
                if (evaluations) {
                    evalStats.total = evaluations.length
                    evalStats.approved = evaluations.filter(e => e.result === 'aprobada').length
                    evalStats.rejected = evaluations.filter(e => e.result === 'rechazada').length
                }

                setKpiData({
                    revenue: totalRevenue,
                    activeClients: activeClientsCount || 0,
                    newLeads: newLeadsCount || 0,
                    conversionRate,
                    completedSessions,
                    totalSessions,
                    pendingEvaluations: evaluations?.length || 0,
                    evalSuccess: evalStats.total > 0 ? Math.round((evalStats.approved / evalStats.total) * 100) : 0,
                    evalData: [
                        { name: 'Aprobadas', value: evalStats.approved },
                        { name: 'Rechazadas', value: evalStats.rejected }
                    ]
                })

                // 4. Evaluations by Trainer
                let evalsQueryByTrainer = supabase
                    .from('evaluations')
                    .select(`
                        adiestrador_id,
                        profiles:adiestrador_id ( full_name )
                    `)
                    .gte('created_at', fromStr)
                    .lte('created_at', toStr)
                    .not('adiestrador_id', 'is', null)

                if (cityId !== 'all') evalsQueryByTrainer = evalsQueryByTrainer.eq('city_id', cityId)
                const { data: trainerEvals } = await evalsQueryByTrainer

                if (trainerEvals) {
                    const trainerCounts: Record<string, number> = {}
                    trainerEvals.forEach((ev: any) => {
                        const name = ev.profiles?.full_name || 'Desconocido'
                        trainerCounts[name] = (trainerCounts[name] || 0) + 1
                    })
                    // trainerChartData unused for now
                }

                setLoading(false)
            } catch (error) {
                console.error('Error fetching dashboard data:', error)
                setLoading(false)
            }
        }
        fetchData()
    }, [cityId, dateRange])

    if (loading) return <div>Calculando métricas...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Panel de Dirección</h1>

                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    {[
                        { id: 'direccion', label: 'Dirección' },
                        { id: 'marketing', label: 'Marketing' },
                        { id: 'equipo', label: 'Comerciales' },
                        { id: 'adiestradores', label: 'Adiestradores' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                background: activeTab === tab.id ? 'white' : 'transparent',
                                borderRadius: '0.375rem',
                                color: activeTab === tab.id ? '#111827' : '#6b7280',
                                fontWeight: activeTab === tab.id ? 600 : 500,
                                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'direccion' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        <KPICard title="Ingresos Totales" value={`€${kpiData.revenue.toLocaleString()}`} icon={DollarSign} color="#16a34a" trend="Recaudado" trendUp />
                        <KPICard title="Clientes Activos" value={kpiData.activeClients} icon={UserCheck} color="#2563eb" trend="Suscritos" trendUp />
                        <KPICard title="Nuevos Leads" value={kpiData.newLeads} icon={Users} color="#06b6d4" trend="Interesados" trendUp />
                        <KPICard title="Sesiones Mes" value={`${kpiData.completedSessions}/${kpiData.totalSessions}`} icon={Activity} color="#8b5cf6" trend="Progreso" trendUp />
                        <KPICard title="Éxito Eval." value={`${kpiData.evalSuccess}%`} icon={TrendingUp} color="#10b981" trend="Aprobaron" trendUp />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                        {/* Operational Stats */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Estado de Sesiones</h3>
                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Completadas</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{kpiData.totalSessions > 0 ? Math.round((kpiData.completedSessions / kpiData.totalSessions) * 100) : 0}%</span>
                                </div>
                                <div style={{ width: '100%', height: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                                    <div style={{ width: `${kpiData.totalSessions > 0 ? (kpiData.completedSessions / kpiData.totalSessions) * 100 : 0}%`, height: '100%', backgroundColor: '#8b5cf6', borderRadius: '6px' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{kpiData.totalSessions - kpiData.completedSessions}</p>
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Pendientes</p>
                                </div>
                                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>15%</p>
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>No-Shows</p>
                                </div>
                            </div>
                        </div>

                        {/* Evaluations Result */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Éxito en Evaluaciones</h3>
                            <div style={{ height: 200 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={(kpiData as any).evalData}
                                            innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                        >
                                            <Cell fill="#10b981" />
                                            <Cell fill="#ef4444" />
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '-110px', height: '110px' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{(kpiData as any).evalSuccess}%</p>
                                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Ratio Éxito</p>
                            </div>
                        </div>

                        {/* Revenue Trend */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', gridColumn: '1 / -1' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Tendencia de Ingresos</h3>
                            <div style={{ height: 300 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={revenueData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="value" stroke="#16a34a" fill="url(#colorRev)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'marketing' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <KPICard title="Gasto Publicitario" value={`€${marketingStats.adSpend.toLocaleString()}`} icon={TrendingUp} color="#3b82f6" trend="Inversión" trendUp={false} />
                        <KPICard title="Leads Totales" value={kpiData.newLeads} icon={Users} color="#06b6d4" trend="Captados" trendUp />
                        <KPICard title="CPL" value={kpiData.newLeads > 0 ? `€${(marketingStats.adSpend / kpiData.newLeads).toFixed(2)}` : '€0.00'} icon={Activity} color="#f59e0b" trend="Costo/Lead" trendUp={false} />
                        <KPICard title="CAC Real" value={kpiData.activeClients > 0 ? `€${Math.round(marketingStats.adSpend / kpiData.activeClients)}` : '€0'} icon={UserCheck} color="#ec4899" trend="Costo/Adqu." trendUp={false} />
                        <KPICard title="ROI" value={`${marketingStats.roi}%`} icon={TrendingUp} color="#10b981" trend="Retorno" trendUp />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {/* Funnel de Conversión */}
                        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', gridColumn: '1 / -1' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, textAlign: 'center', marginBottom: '2rem' }}>Funnel de Conversión</h3>
                            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {marketingStats.funnel.map((item, i) => (
                                    <div key={item.stage} style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{
                                            width: `${100 - (i * 8)}%`,
                                            height: '54px',
                                            backgroundColor: item.color,
                                            margin: '0 auto',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0 1.5rem',
                                            color: 'white',
                                            borderRadius: '4px',
                                            position: 'relative',
                                            fontSize: '0.9rem',
                                            clipPath: `polygon(2% 0%, 98% 0%, 97% 100%, 3% 100%)`
                                        }}>
                                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.stage}</span>
                                            <span style={{ fontWeight: 700, flexShrink: 0 }}>{item.value} <small style={{ opacity: 0.9 }}>({item.percentage}%)</small></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gasto vs Leads */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Gasto vs Leads</h3>
                            <div style={{ height: 250 }}>
                                <ResponsiveContainer>
                                    <BarChart data={revenueData.map(d => ({ ...d, leads: Math.floor(d.value / 100) }))}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Bar dataKey="value" name="Gasto (€)" fill="#3b82f6" />
                                        <Bar dataKey="leads" name="Leads" fill="#10b981" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Rendimiento por Ciudad */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Rendimiento por Ciudad</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                            <th style={{ padding: '0.75rem' }}>Ciudad</th>
                                            <th style={{ padding: '0.75rem' }}>Leads</th>
                                            <th style={{ padding: '0.75rem' }}>CPL</th>
                                            <th style={{ padding: '0.75rem' }}>Prog. Vendidos</th>
                                            <th style={{ padding: '0.75rem' }}>ROI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {marketingStats.cities.map(city => (
                                            <tr key={city.name} style={{ borderBottom: '1px solid #f9fafb' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 500 }}>{city.name}</td>
                                                <td style={{ padding: '0.75rem' }}>{city.leads}</td>
                                                <td style={{ padding: '0.75rem' }}>€{city.cpl}</td>
                                                <td style={{ padding: '0.75rem' }}>{city.sales}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{ padding: '0.25rem 0.5rem', backgroundColor: city.margin > 55 ? '#dcfce7' : '#fee2e2', color: city.margin > 55 ? '#166534' : '#991b1b', borderRadius: '4px' }}>
                                                        {city.margin}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'equipo' && <ComercialesPanel />}
            {activeTab === 'adiestradores' && <AdiestradoresPanel />}
        </div>
    )
}
