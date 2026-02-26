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
    FileText
} from 'lucide-react'

export function AppLayout() {
    const { signOut, profile } = useAuth()
    const { cityId, setCityId, datePreset, setDatePreset, dateRange, setDateRange } = useFilters()
    const location = useLocation()
    const [cities, setCities] = useState<any[]>([])

    useEffect(() => {
        fetchCities()
    }, [])

    useEffect(() => {
        if (profile?.role === 'adiestrador' && profile.assigned_city_id) {
            setCityId(profile.assigned_city_id)
        }
    }, [profile, setCityId])

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

        if (role === 'admin' || profile?.email === 'lupe@escuelacaninafranestevez.es') {
            return [
                ...common,
                { name: 'Leads', href: '/leads', icon: Users },
                { name: 'Clientes', href: '/clientes', icon: UserCheck },
                { name: 'Facturación', href: '/facturacion', icon: FileText },
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
                { name: 'Mis Clientes', href: '/clientes', icon: UserCheck },
            ]
        }

        return common
    }

    const navigation = getNavigation()

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Sidebar */}
            <div style={{
                width: '260px',
                backgroundColor: '#000000', // Pure Black
                borderRight: '1px solid #1f2937',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: '100vh',
                zIndex: 20,
                color: 'white'
            }}>
                <div style={{ padding: '2rem', borderBottom: '1px solid #1f2937' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '50px', height: 'auto' }} />
                        <div>
                            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white', lineHeight: 1.2 }}>Escuela Canina<br />Fran Estévez</h1>
                        </div>
                    </div>
                </div>

                <nav style={{ flex: 1, padding: '1.5rem 1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '1rem', paddingLeft: '0.75rem' }}>Menu</p>
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
                                            padding: '0.75rem 1rem',
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

                <div style={{ padding: '1.5rem', borderTop: '1px solid #1f2937' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600, color: 'white', overflow: 'hidden' }}>
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.full_name || 'U'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                profile?.full_name?.[0] || 'U'
                            )}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>{profile?.full_name || 'Usuario'}</p>
                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'capitalize' }}>{profile?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={signOut}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.5rem',
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500
                        }}
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Main Content Wrapper */}
            <div style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Top Bar for Filters */}
                <header style={{
                    height: '64px',
                    backgroundColor: 'white',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 2rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        {navigation.find(n => n.href === location.pathname)?.name || 'Panel'}
                    </h2>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {/* City Selector */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', color: '#6b7280' }} />
                            <select
                                value={cityId}
                                onChange={(e) => setCityId(e.target.value)}
                                disabled={profile?.role === 'adiestrador'}
                                style={{
                                    padding: '0.5rem 1rem 0.5rem 2.25rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: profile?.role === 'adiestrador' ? '#f3f4f6' : 'white',
                                    fontSize: '0.875rem',
                                    minWidth: '150px',
                                    cursor: profile?.role === 'adiestrador' ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {profile?.role !== 'adiestrador' && <option value="all">Todas las ciudades</option>}
                                {cities.map((city: any) => (
                                    <option key={city.id} value={city.id}>{city.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Preset Selector */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', color: '#6b7280' }} />
                            <select
                                value={datePreset}
                                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                                style={{
                                    padding: '0.5rem 1rem 0.5rem 2.25rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: 'white',
                                    fontSize: '0.875rem',
                                    minWidth: '150px'
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Desde:</span>
                                    <input
                                        type="date"
                                        value={format(dateRange.from, 'yyyy-MM-dd')}
                                        onChange={(e) => setDateRange({ ...dateRange, from: parseISO(e.target.value) })}
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '0.375rem',
                                            border: '1px solid #e5e7eb',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Hasta:</span>
                                    <input
                                        type="date"
                                        value={format(dateRange.to, 'yyyy-MM-dd')}
                                        onChange={(e) => setDateRange({ ...dateRange, to: parseISO(e.target.value) })}
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '0.375rem',
                                            border: '1px solid #e5e7eb',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <main style={{ padding: '2rem', flex: 1, overflow: 'auto' }}>
                    <Outlet />
                </main>
            </div>
        </div >
    )
}
