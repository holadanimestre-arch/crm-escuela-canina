import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Calendar } from 'lucide-react'

interface SessionModalProps {
    isOpen: boolean
    onClose: () => void
    client: { id: string; name: string } | null
    onSessionSaved: () => void
}

export function SessionModal({ isOpen, onClose, client, onSessionSaved }: SessionModalProps) {
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [sessionNumber, setSessionNumber] = useState<number | null>(null)
    const [comments, setComments] = useState('')
    const [saving, setSaving] = useState(false)
    const [existingSessions, setExistingSessions] = useState<number[]>([])

    useEffect(() => {
        if (isOpen && client) {
            // Reset form
            setDate(new Date().toISOString().split('T')[0])
            setTime('10:00')
            setComments('')
            setSessionNumber(null)

            // Fetch existing sessions to determine next number
            fetchExistingSessions()
        }
    }, [isOpen, client])

    async function fetchExistingSessions() {
        if (!client) return
        const { data } = await supabase
            .from('sessions')
            .select('session_number')
            .eq('client_id', client.id)
            .order('session_number', { ascending: true })

        if (data) {
            const numbers = data.map(s => s.session_number)
            setExistingSessions(numbers)

            // Auto-select next available session number
            for (let i = 1; i <= 8; i++) {
                if (!numbers.includes(i)) {
                    setSessionNumber(i)
                    break
                }
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!client || !sessionNumber || !date || !time) return

        setSaving(true)
        try {
            const sessionDate = new Date(`${date}T${time}:00`).toISOString()

            const { error } = await supabase
                .from('sessions')
                .insert({
                    client_id: client.id,
                    session_number: sessionNumber,
                    date: sessionDate,
                    comments,
                    completed: false
                })

            if (error) throw error

            onSessionSaved()
            onClose()
        } catch (error) {
            console.error('Error saving session:', error)
            alert('Error al guardar la sesión')
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen || !client) return null

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '0.5rem', width: '100%', maxWidth: '500px',
                padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Agendar Sesión</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Cliente</label>
                        <input type="text" value={client.name} disabled style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', backgroundColor: '#f3f4f6' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Hora</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                required
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Número de Sesión</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
                                const exists = existingSessions.includes(num)
                                const isSelected = sessionNumber === num
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => !exists && setSessionNumber(num)}
                                        disabled={exists}
                                        style={{
                                            width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                                            border: isSelected ? '2px solid #000' : '1px solid #e5e7eb',
                                            backgroundColor: exists ? '#dcfce7' : isSelected ? '#000' : 'white',
                                            color: exists ? '#16a34a' : isSelected ? 'white' : '#374151',
                                            fontWeight: 600,
                                            cursor: exists ? 'default' : 'pointer',
                                            opacity: exists ? 0.8 : 1
                                        }}
                                    >
                                        {num}
                                    </button>
                                )
                            })}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            Las sesiones en verde ya están agendadas.
                        </p>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Notas (Opcional)</label>
                        <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            rows={3}
                            placeholder="Objetivos de la sesión, lugar de encuentro..."
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !sessionNumber}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none',
                                background: '#000', color: 'white', fontWeight: 500, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                opacity: (saving || !sessionNumber) ? 0.7 : 1
                            }}
                        >
                            <Calendar size={18} />
                            {saving ? 'Guardando...' : 'Agendar Sesión'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
