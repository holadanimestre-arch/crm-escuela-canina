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
import { startOfMonth, subMonths, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ComercialesPanel } from '../../components/dashboard/ComercialesPanel'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export function AdminDashboard() {
    const { cityId } = useFilters()
    const [activeTab, setActiveTab] = useState<'general' | 'equipo'>('general')
    const [loading, setLoading] = useState(true)
    const [kpiData, setKpiData] = useState({
        revenue: 0,
        activeClients: 0,
        newLeads: 0,
        conversionRate: 0
    })
    const [revenueData, setRevenueData] = useState<any[]>([])
    const [leadStatusData, setLeadStatusData] = useState<any[]>([])
    const [trainerSessionsData, setTrainerSessionsData] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            try {
                // 1. Fetch Key Metrics
                // Revenue (Total)
                const { data: payments } = await supabase.from('payments').select('amount, created_at')
                const totalRevenue = payments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

                // Active Clients
                const { count: activeClientsCount } = await supabase
                    .from('clients')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'activo')

                // New Leads (This Month)
                const startOfCurrentMonth = startOfMonth(new Date()).toISOString()
                const { count: newLeadsCount } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', startOfCurrentMonth)

                // Conversion Rate (Clients / Leads) - Simplified for MVP
                const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true })
                const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true })
                const conversionRate = totalLeads ? Math.round((totalClients! / totalLeads) * 100) : 0

                setKpiData({
                    revenue: totalRevenue,
                    activeClients: activeClientsCount || 0,
                    newLeads: newLeadsCount || 0,
                    conversionRate
                })

                // 2. Revenue Trend (Last 6 Months)
                const last6Months = Array.from({ length: 6 }, (_, i) => {
                    const date = subMonths(new Date(), 5 - i)
                    return {
                        date,
                        name: format(date, 'MMM', { locale: es }),
                        fullDate: format(date, 'yyyy-MM'),
                        value: 0
                    }
                })

                if (payments) {
                    payments.forEach(payment => {
                        const paymentDate = parseISO(payment.created_at)
                        const monthKey = format(paymentDate, 'yyyy-MM')
                        const monthData = last6Months.find(d => d.fullDate === monthKey)
                        if (monthData) {
                            monthData.value += Number(payment.amount)
                        }
                    })
                }
                setRevenueData(last6Months)

                // 3. Lead Status Distribution
                const { data: leads } = await supabase.from('leads').select('status')
                if (leads) {
                    const statusCounts: Record<string, number> = {}
                    leads.forEach(l => {
                        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1
                    })
                    const chartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
                    setLeadStatusData(chartData)
                }

                // 4. Sessions by Trainer (Adiestrador)
                // Need to join sessions -> clients -> profiles (adiestrador is linked to evaluation? No, sessions table has no adiestrador_id directly, it's via client's city or adiestrador assignment?)
                // Actually, our schema for sessions doesn't have adiestrador_id.
                // Let's us evaluations table which HAS adiestrador_id for completed evaluations as a proxy for activity, OR just fetch sessions.
                // Spec says "Sesiones por Adiestrador".
                // In `003_sessions.sql`, sessions has `client_id`.
                // In `clients`, we don't have adiestrador_id explicitly, we have city_id.
                // Evaluations table has `adiestrador_id`. 
                // Let's use Evaluations Count by Adiestrador for now as it's cleaner in current schema.
                // Or we can check profiles with role 'adiestrador' and count their evaluations.

                const { data: evaluations } = await supabase
                    .from('evaluations')
                    .select(`
                        adiestrador_id,
                        profiles:adiestrador_id ( full_name )
                    `)
                    .not('adiestrador_id', 'is', null)

                if (evaluations) {
                    const trainerCounts: Record<string, number> = {}
                    evaluations.forEach((ev: any) => {
                        const name = ev.profiles?.full_name || 'Desconocido'
                        trainerCounts[name] = (trainerCounts[name] || 0) + 1
                    })
                    const trainerChartData = Object.entries(trainerCounts).map(([name, value]) => ({ name, value }))
                    setTrainerSessionsData(trainerChartData)
                }

                setLoading(false)

            } catch (error) {
                console.error('Error fetching dashboard data:', error)
                setLoading(false)
            }
        }

        fetchData()
    }, [cityId])

    if (loading) return <div>Calculando métricas...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Panel de Dirección</h1>

                {/* Dashboard Tabs */}
                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    <button
                        onClick={() => setActiveTab('general')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            background: activeTab === 'general' ? 'white' : 'transparent',
                            borderRadius: '0.375rem',
                            color: activeTab === 'general' ? '#111827' : '#6b7280',
                            fontWeight: activeTab === 'general' ? 600 : 500,
                            boxShadow: activeTab === 'general' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('equipo')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            background: activeTab === 'equipo' ? 'white' : 'transparent',
                            borderRadius: '0.375rem',
                            color: activeTab === 'equipo' ? '#111827' : '#6b7280',
                            fontWeight: activeTab === 'equipo' ? 600 : 500,
                            boxShadow: activeTab === 'equipo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Equipo Comercial
                    </button>
                </div>
            </div>

            {activeTab === 'general' ? (
                <>
                    {/* KPIs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        <KPICard
                            title="Ingresos Totales"
                            value={`€${kpiData.revenue.toLocaleString()}`}
                            trend="Actualizado hoy"
                            trendUp={true}
                            icon={DollarSign}
                            color="#16a34a"
                        />
                        <KPICard
                            title="Clientes Activos"
                            value={kpiData.activeClients}
                            trend="Total acumulado"
                            trendUp={true}
                            icon={UserCheck}
                            color="#2563eb"
                        />
                        <KPICard
                            title="Nuevos Leads (Mes)"
                            value={kpiData.newLeads}
                            trend="Oportunidades"
                            trendUp={true}
                            icon={Users}
                            color="#f59e0b"
                        />
                        <KPICard
                            title="Tasa Conversión"
                            value={`${kpiData.conversionRate}%`}
                            trend="Global"
                            trendUp={kpiData.conversionRate > 20}
                            icon={Activity}
                            color="#8b5cf6"
                        />
                    </div>

                    {/* Charts Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

                        {/* Revenue Trend */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <TrendingUp size={20} /> Tendencia de Ingresos (6 meses)
                            </h3>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={revenueData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="value" stroke="#16a34a" fillOpacity={1} fill="url(#colorRevenue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Lead Status (Pie Chart) */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Estado de Leads</h3>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={leadStatusData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {leadStatusData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Evaluations by Trainer (Bar Chart) */}
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minHeight: '350px' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Evaluaciones por Adiestrador</h3>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={trainerSessionsData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>
                </>
            ) : (
                <ComercialesPanel />
            )}
        </div>
    )
}
