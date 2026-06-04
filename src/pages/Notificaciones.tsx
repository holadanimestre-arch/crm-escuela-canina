import { useState, useEffect, useCallback } from 'react'
import { PhoneOff, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDialog } from '../context/DialogContext'

type NotificationRow = {
    id: string
    type: string
    title: string
    message: string | null
    client_id: string | null
    read: boolean
    created_at: string
}

const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function Notificaciones() {
    const { showAlert } = useDialog()
    const [items, setItems] = useState<NotificationRow[]>([])
    const [loading, setLoading] = useState(true)

    const fetchNotifications = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) showAlert('Error al cargar notificaciones: ' + error.message)
        else setItems((data as NotificationRow[]) || [])
        setLoading(false)
    }, [showAlert])

    useEffect(() => { fetchNotifications() }, [fetchNotifications])

    const unread = items.filter(n => !n.read).length

    const markRead = async (n: NotificationRow) => {
        if (n.read) return
        setItems(prev => prev.map(it => it.id === n.id ? { ...it, read: true } : it))
        await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    }

    const markAllRead = async () => {
        const ids = items.filter(n => !n.read).map(n => n.id)
        if (ids.length === 0) return
        setItems(prev => prev.map(it => ({ ...it, read: true })))
        await supabase.from('notifications').update({ read: true }).in('id', ids)
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h1 style={{ fontWeight: 700, fontSize: '1.5rem' }}>
                    Notificaciones {unread > 0 && <span style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 600 }}>({unread} sin leer)</span>}
                </h1>
                {unread > 0 && (
                    <button
                        onClick={markAllRead}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                        <Check size={16} /> Marcar todas como leídas
                    </button>
                )}
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Cargando notificaciones...</p>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    No hay notificaciones por ahora.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {items.map(n => (
                        <div
                            key={n.id}
                            onClick={() => markRead(n)}
                            style={{
                                display: 'flex', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '0.75rem',
                                border: '1px solid #e5e7eb', cursor: n.read ? 'default' : 'pointer',
                                backgroundColor: n.read ? 'white' : '#eff6ff',
                                borderLeft: n.read ? '1px solid #e5e7eb' : '4px solid #3b82f6'
                            }}
                        >
                            <div style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '0.6rem', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PhoneOff size={22} color="#ef4444" />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>{n.title}</p>
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDate(n.created_at)}</span>
                                </div>
                                {n.message && <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: '#4b5563' }}>{n.message}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
