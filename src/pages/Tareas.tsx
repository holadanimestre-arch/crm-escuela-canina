import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../context/DialogContext'
import { Modal } from '../components/Modal'
import { ListTodo, Plus, Check, Trash2, Calendar, User, ExternalLink } from 'lucide-react'

type Task = {
    id: string
    title: string
    due_date: string | null
    status: string
    client_id: string | null
    type: string
    created_at: string
    clients?: { name: string; dog_name: string | null } | null
}

const TYPE_META: Record<string, { label: string; bg: string; color: string }> = {
    manual: { label: 'Manual', bg: '#f3f4f6', color: '#374151' },
    no_contesta: { label: 'No contesta', bg: '#fee2e2', color: '#991b1b' },
    calidad_3: { label: '3ª sesión', bg: '#dbeafe', color: '#1e40af' },
    satisfaccion: { label: 'Satisfacción', bg: '#e0e7ff', color: '#3730a3' },
}

const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Tareas() {
    const navigate = useNavigate()
    const { profile } = useAuth()
    const { showAlert, showConfirm } = useDialog()
    const [tasks, setTasks] = useState<Task[]>([])
    const [clients, setClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Alta de tarea
    const [showAdd, setShowAdd] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newDate, setNewDate] = useState(todayISO())
    const [newClientId, setNewClientId] = useState('')
    const [clientSearch, setClientSearch] = useState('')
    const [saving, setSaving] = useState(false)

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('tasks')
            .select('*, clients(name, dog_name)')
            .eq('status', 'pendiente')
        setTasks((data as Task[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchTasks()
        ;(async () => {
            const { data } = await supabase.from('clients').select('id, name, dog_name').order('name')
            if (data) setClients(data)
        })()
    }, [fetchTasks])

    const sorted = useMemo(() => {
        return [...tasks].sort((a, b) => {
            if (!a.due_date && !b.due_date) return 0
            if (!a.due_date) return 1
            if (!b.due_date) return -1
            return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
        })
    }, [tasks])

    const today = todayISO()

    const completeTask = async (t: Task) => {
        setTasks(prev => prev.filter(x => x.id !== t.id))
        const { error } = await supabase.from('tasks').update({ status: 'completada', completed_at: new Date().toISOString() }).eq('id', t.id)
        if (error) { showAlert('Error al completar la tarea: ' + error.message); fetchTasks() }
    }

    const deleteTask = async (t: Task) => {
        if (!await showConfirm('¿Eliminar esta tarea? (no quedará registro)')) return
        setTasks(prev => prev.filter(x => x.id !== t.id))
        const { error } = await supabase.from('tasks').delete().eq('id', t.id)
        if (error) { showAlert('Error al eliminar la tarea: ' + error.message); fetchTasks() }
    }

    const rescheduleTask = async (t: Task, due: string) => {
        const value = due || null
        setTasks(prev => prev.map(x => x.id === t.id ? { ...x, due_date: value } : x))
        const { error } = await supabase.from('tasks').update({ due_date: value }).eq('id', t.id)
        if (error) { showAlert('Error al cambiar la fecha: ' + error.message); fetchTasks() }
    }

    const resetAdd = () => { setShowAdd(false); setNewTitle(''); setNewDate(todayISO()); setNewClientId(''); setClientSearch('') }

    const addTask = async () => {
        if (!newTitle.trim()) { showAlert('Escribe el título de la tarea.'); return }
        setSaving(true)
        try {
            const { error } = await supabase.from('tasks').insert({
                title: newTitle.trim(),
                due_date: newDate || null,
                status: 'pendiente',
                type: 'manual',
                client_id: newClientId || null,
                created_by: profile?.id ?? null
            })
            if (error) throw error
            resetAdd()
            fetchTasks()
        } catch (err: any) {
            showAlert('Error al crear la tarea: ' + (err.message || 'Error desconocido'))
        } finally {
            setSaving(false)
        }
    }

    const newClient = clients.find(c => c.id === newClientId)
    const clientMatches = useMemo(() => {
        const q = clientSearch.trim().toLowerCase()
        if (!q) return clients.slice(0, 8)
        return clients.filter(c => (c.name || '').toLowerCase().includes(q) || (c.dog_name || '').toLowerCase().includes(q)).slice(0, 8)
    }, [clients, clientSearch])

    return (
        <div style={{ maxWidth: '820px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ListTodo size={22} /> Tareas
                    {tasks.length > 0 && <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>({tasks.length})</span>}
                </h1>
                <button onClick={() => setShowAdd(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#000', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                    <Plus size={16} /> Nueva tarea
                </button>
            </div>

            {loading ? (
                <p style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>Cargando tareas...</p>
            ) : sorted.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
                    No hay tareas pendientes. 🎉
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {sorted.map(t => {
                        const meta = TYPE_META[t.type] || TYPE_META.manual
                        const overdue = t.due_date && t.due_date < today
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: overdue ? '#fff7ed' : 'white' }}>
                                <button
                                    onClick={() => completeTask(t)}
                                    title="Marcar completada"
                                    style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', border: '2px solid #d1d5db', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.background = '#f0fdf4' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = 'white' }}
                                >
                                    <Check size={15} />
                                </button>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, color: '#111827' }}>{t.title}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 600, backgroundColor: meta.bg, color: meta.color }}>{meta.label}</span>
                                        {t.client_id && t.clients && (
                                            <button onClick={() => navigate(`/clientes/${t.client_id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                                                <User size={12} /> {t.clients.name} <ExternalLink size={11} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} title="Fecha de la tarea">
                                        <Calendar size={14} color={overdue ? '#ea580c' : '#9ca3af'} />
                                        <input
                                            type="date"
                                            value={t.due_date || ''}
                                            onChange={e => rescheduleTask(t, e.target.value)}
                                            style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.3rem 0.4rem', fontSize: '0.78rem', color: overdue ? '#c2410c' : '#374151', fontWeight: overdue ? 600 : 400 }}
                                        />
                                    </div>
                                    <button onClick={() => deleteTask(t)} title="Eliminar" style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '0.2rem' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal nueva tarea */}
            <Modal isOpen={showAdd} onClose={resetAdd} title="Nueva tarea">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Tarea</label>
                        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="¿Qué hay que hacer?" autoFocus style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.95rem' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fecha</label>
                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.95rem' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Cliente <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
                        {newClient ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb' }}>
                                <span style={{ fontWeight: 600 }}>{newClient.name}{newClient.dog_name ? ` · 🐕 ${newClient.dog_name}` : ''}</span>
                                <button onClick={() => { setNewClientId(''); setClientSearch('') }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Quitar</button>
                            </div>
                        ) : (
                            <>
                                <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente por nombre o perro..." style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
                                {clientSearch.trim() && (
                                    <div style={{ marginTop: '0.4rem', maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {clientMatches.map(c => (
                                            <button key={c.id} onClick={() => { setNewClientId(c.id); setClientSearch('') }} style={{ textAlign: 'left', padding: '0.45rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #f3f4f6', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                {c.name} {c.dog_name && <span style={{ color: '#6b7280' }}>· 🐕 {c.dog_name}</span>}
                                            </button>
                                        ))}
                                        {clientMatches.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '0.4rem' }}>Sin resultados.</p>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <button onClick={resetAdd} disabled={saving} style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={addTask} disabled={saving} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#000', color: 'white', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
                            {saving ? 'Creando...' : 'Crear tarea'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
