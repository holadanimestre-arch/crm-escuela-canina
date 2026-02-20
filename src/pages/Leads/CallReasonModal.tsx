import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { supabase } from '../../lib/supabase'

interface CallReasonModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function CallReasonModal({ isOpen, onClose, onSuccess }: CallReasonModalProps) {
    const [reasonName, setReasonName] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!reasonName.trim()) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('call_reasons')
                .insert({ name: reasonName.trim(), active: true })

            if (error) throw error

            setReasonName('')
            onSuccess()
            onClose()
            alert('Motivo añadido correctamente')
        } catch (error: any) {
            console.error('Error adding reason:', error)
            alert('Error al añadir motivo: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Añadir Nuevo Motivo">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Nombre del Motivo</label>
                    <input
                        required
                        type="text"
                        value={reasonName}
                        onChange={e => setReasonName(e.target.value)}
                        placeholder="Ej. Agresividad"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: saving ? 'wait' : 'pointer' }}
                    >
                        {saving ? 'Guardando...' : 'Añadir Motivo'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
