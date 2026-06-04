import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, PhoneOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

type NotificationRow = {
    id: string
    type: string
    title: string
    message: string | null
    client_id: string | null
    read: boolean
    created_at: string
}

const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora mismo'
    if (mins < 60) return `hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours} h`
    const days = Math.floor(hours / 24)
    return `hace ${days} d`
}

export function NotificationBell() {
    const navigate = useNavigate()
    const [items, setItems] = useState<NotificationRow[]>([])
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const fetchNotifications = useCallback(async () => {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)
        if (data) setItems(data as NotificationRow[])
    }, [])

    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const unread = items.filter(n => !n.read).length

    const markRead = async (n: NotificationRow) => {
        if (!n.read) {
            setItems(prev => prev.map(it => it.id === n.id ? { ...it, read: true } : it))
            await supabase.from('notifications').update({ read: true }).eq('id', n.id)
        }
    }

    const markAllRead = async () => {
        const ids = items.filter(n => !n.read).map(n => n.id)
        if (ids.length === 0) return
        setItems(prev => prev.map(it => ({ ...it, read: true })))
        await supabase.from('notifications').update({ read: true }).in('id', ids)
    }

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <button
                onClick={() => { setOpen(o => !o); if (!open) fetchNotifications() }}
                aria-label="Notificaciones"
                style={{
                    position: 'relative', background: 'none', border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem', width: '38px', height: '38px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151'
                }}
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px',
                        padding: '0 4px', borderRadius: '999px', backgroundColor: '#ef4444', color: 'white',
                        fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '340px', maxWidth: '90vw',
                    backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e5e7eb',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', zIndex: 50, overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' }}>
                        <strong style={{ fontSize: '0.9rem' }}>Notificaciones</strong>
                        {unread > 0 && (
                            <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                Marcar todas leídas
                            </button>
                        )}
                    </div>

                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <p style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', margin: 0 }}>
                                No hay notificaciones
                            </p>
                        ) : items.map(n => (
                            <div
                                key={n.id}
                                onClick={() => markRead(n)}
                                style={{
                                    display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer',
                                    borderBottom: '1px solid #f9fafb',
                                    backgroundColor: n.read ? 'white' : '#eff6ff'
                                }}
                            >
                                <div style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '0.5rem', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <PhoneOff size={18} color="#ef4444" />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{n.title}</p>
                                    {n.message && <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#4b5563' }}>{n.message}</p>}
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>{timeAgo(n.created_at)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
                        <button
                            onClick={() => { setOpen(false); navigate('/notificaciones') }}
                            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Ver todas
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
