import { LucideIcon } from 'lucide-react'

interface KPICardProps {
    title: string
    value: string | number
    description?: string
    trend?: string
    trendUp?: boolean
    icon: LucideIcon
    color?: string
}

export function KPICard({ title, value, description, trend, trendUp, icon: Icon, color = '#2563eb' }: KPICardProps) {
    return (
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ flex: 1 }}>
                <div style={{ position: 'relative', display: 'inline-block', cursor: 'help' }} className="metric-tooltip-trigger">
                    <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {title}
                        {description && <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>ⓘ</span>}
                    </p>
                    {description && (
                        <div className="metric-tooltip">
                            {description}
                        </div>
                    )}
                </div>
                <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</h3>
                {trend && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                        <span style={{ color: trendUp ? '#16a34a' : '#dc2626' }}>
                            {trendUp ? '↑' : '↓'} {trend}
                        </span>
                        <span style={{ color: '#9ca3af' }}>vs ayer</span>
                    </div>
                )}
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: `${color}15`, color: color }}>
                <Icon size={24} />
            </div>
        </div>
    )
}
