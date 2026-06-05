import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFilters, DateRangePreset } from '../context/FilterContext'
import { format, parseISO } from 'date-fns'
import {
    LayoutDashboard,
    Users,
    UserCheck,
    LogOut,
    MapPin,
    Calendar,
    Settings,
    FileText,
    Receipt,
    Wallet,
    Menu,
    X,
    Bell,
    CreditCard,
    MessageCircle,
    ListTodo
} from 'lucide-react'
import { NotificationBell } from '../components/NotificationBell'

export function AppLayout() {
    const { signOut, profile, assignedCityIds } = useAuth()
    const { cityId, setCityId, datePreset, setDatePreset, dateRange, setDateRange } = useFilters()
    const location = useLocation()
    const [cities, setCities] = useState<any[]>([])
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        fetchCities()
        const handleResize = () => {
            const width = window.innerWidth
            const mobile = width < 768
            
            setIsMobile(prev => {
                if (prev !== mobile) return mobile;
                return prev;
            })
            if (width >= 768) setSidebarOpen(false)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (profile?.role === 'adiestrador' && assignedCityIds.length > 0) {
            // If current cityId is not in their assigned cities, set to first one
            if (!assignedCityIds.includes(cityId as string)) {
                setCityId(assignedCityIds[0])
            }
        }
    }, [profile, assignedCityIds, setCityId])

    // Close sidebar on navigation (mobile)
    useEffect(() => {
        if (isMobile) setSidebarOpen(false)
    }, [location.pathname])

    async function fetchCities() {
        const { data } = await supabase.from('cities').select('*').eq('active', true).order('name')
        if (data) setCities(data)
    }

    // Role-based Navigation
    const getNavigation = () => {
        const role = profile?.role || 'comercial'

        const common = [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        ]

        if (role === 'admin') {
            return [
                ...common,
                { name: 'Agenda', href: '/agenda', icon: Calendar },
                { name: 'Tareas', href: '/tareas', icon: ListTodo },
                { name: 'Leads', href: '/leads', icon: Users },
                { name: 'Clientes', href: '/clientes', icon: UserCheck },
                { name: 'Facturación', href: '/facturacion', icon: FileText },
                { name: 'Pagos Clientes', href: '/pagos-clientes', icon: CreditCard },
                { name: 'Pagos Adiestradores', href: '/pagos-adiestradores', icon: Wallet },
                { name: 'Notificaciones', href: '/notificaciones', icon: Bell },
                { name: 'WhatsApps', href: '/whatsapps', icon: MessageCircle },
                { name: 'Usuarios', href: '/usuarios', icon: Users },
                { name: 'Configuración', href: '/ajustes', icon: Settings },
            ]
        }

        if (role === 'comercial') {
            return [
                ...common,
                { name: 'Leads', href: '/leads', icon: Users },
                { name: 'Clientes', href: '/clientes', icon: UserCheck },
            ]
        }

        if (role === 'adiestrador') {
            return [
                ...common,
                { name: 'Agenda', href: '/agenda', icon: Calendar },
                { name: 'Mis Clientes', href: '/clientes', icon: UserCheck },
                { name: 'Mi Facturación', href: '/mi-facturacion', icon: Receipt },
            ]
        }

        return common
    }

    const navigation = getNavigation()

    return (
        <div style={{ display: 'flex', minHeight: '100dvh', backgroundColor: '#f9fafb', position: 'relative' }}>
            {/* Mobile Overlay */}
            {isMobile && sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 30, transition: 'opacity 0.3s'
                    }}
                />
            )}

            {/* Sidebar */}
            <div style={{
                width: '260px',
                backgroundColor: '#000000',
                borderRight: '1px solid #1f2937',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: '100vh',
                zIndex: 40,
                color: 'white',
                transition: 'transform 0.3s ease',
                transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
            }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '40px', height: 'auto' }} />
                        <div>
                            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', lineHeight: 1.2 }}>Escuela Canina<br />Fran Estévez</h1>
                        </div>
                    </div>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}>
                            <X size={20} />
                        </button>
                    )}
                </div>

                <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.75rem', paddingLeft: '0.75rem', letterSpacing: '0.05em' }}>Menu</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {navigation.map((item) => {
                            const Icon = item.icon
                            const isActive = location.pathname === item.href
                            return (
                                <li key={item.name}>
                                    <Link
                                        to={item.href}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.7rem 1rem',
                                            borderRadius: '0.5rem',
                                            textDecoration: 'none',
                                            color: isActive ? 'white' : '#9ca3af',
                                            backgroundColor: isActive ? '#374151' : 'transparent',
                                            fontWeight: isActive ? 600 : 500,
                                            fontSize: '0.875rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                        {item.name}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid #1f2937' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.full_name || 'U'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                profile?.full_name?.[0] || 'U'
                            )}
                        </div>
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{profile?.full_name || 'Usuario'}</p>
                            <p style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'capitalize' }}>{profile?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={signOut}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            width: '100%', padding: '0.5rem',
                            border: 'none', background: 'transparent',
                            color: '#ef4444', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 500
                        }}
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Main Content Wrapper */}
            <div style={{
                flex: 1,
                marginLeft: isMobile ? 0 : '260px',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: '100dvh'
            }}>
                {/* Top Bar for Filters */}
                <header style={{
                    minHeight: '56px',
                    backgroundColor: 'white',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '0 1rem' : '0 2rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isMobile && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <img src="/logo.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                                <Menu size={22} color="#374151" />
                            </button>
                        )}
                        <h2 style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {navigation.find(n => n.href === location.pathname)?.name || 'Panel'}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 0' }}>
                        {/* City Selector */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <MapPin size={14} style={{ position: 'absolute', left: '0.5rem', color: '#6b7280' }} />
                            <select
                                value={cityId}
                                onChange={(e) => setCityId(e.target.value)}
                                disabled={profile?.role === 'adiestrador' && assignedCityIds.length <= 1}
                                style={{
                                    padding: '0.4rem 0.75rem 0.4rem 1.75rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: (profile?.role === 'adiestrador' && assignedCityIds.length <= 1) ? '#f3f4f6' : 'white',
                                    fontSize: '0.8rem',
                                    minWidth: isMobile ? '120px' : '150px',
                                    cursor: (profile?.role === 'adiestrador' && assignedCityIds.length <= 1) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {profile?.role !== 'adiestrador' && <option value="all">Todas las ciudades</option>}
                                {profile?.role === 'adiestrador'
                                    ? cities.filter((city: any) => assignedCityIds.includes(city.id)).map((city: any) => (
                                        <option key={city.id} value={city.id}>{city.name}</option>
                                    ))
                                    : cities.map((city: any) => (
                                        <option key={city.id} value={city.id}>{city.name}</option>
                                    ))
                                }
                            </select>
                        </div>

                        {/* Date Preset Selector */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Calendar size={14} style={{ position: 'absolute', left: '0.5rem', color: '#6b7280' }} />
                            <select
                                value={datePreset}
                                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                                style={{
                                    padding: '0.4rem 0.75rem 0.4rem 1.75rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: 'white',
                                    fontSize: '0.8rem',
                                    minWidth: isMobile ? '120px' : '150px'
                                }}
                            >
                                <option value="today">Hoy</option>
                                <option value="7days">Últimos 7 días</option>
                                <option value="30days">Últimos 30 días</option>
                                <option value="month">Este Mes</option>
                                <option value="prev_month">Mes Anterior</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>

                        {datePreset === 'custom' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280' }}>Desde:</span>
                                    <input
                                        type="date"
                                        value={format(dateRange.from, 'yyyy-MM-dd')}
                                        onChange={(e) => setDateRange({ ...dateRange, from: parseISO(e.target.value) })}
                                        style={{
                                            padding: '0.35rem 0.4rem',
                                            borderRadius: '0.375rem',
                                            border: '1px solid #e5e7eb',
                                            fontSize: '0.8rem'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280' }}>Hasta:</span>
                                    <input
                                        type="date"
                                        value={format(dateRange.to, 'yyyy-MM-dd')}
                                        onChange={(e) => setDateRange({ ...dateRange, to: parseISO(e.target.value) })}
                                        style={{
                                            padding: '0.35rem 0.4rem',
                                            borderRadius: '0.375rem',
                                            border: '1px solid #e5e7eb',
                                            fontSize: '0.8rem'
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {profile?.role === 'admin' && <NotificationBell />}
                    </div>
                </header>

                <main style={{ padding: isMobile ? '1rem' : '2rem', flex: 1 }}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
