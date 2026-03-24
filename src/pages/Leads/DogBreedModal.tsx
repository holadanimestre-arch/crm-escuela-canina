import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../context/DialogContext'

interface DogBreedModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function DogBreedModal({ isOpen, onClose, onSuccess }: DogBreedModalProps) {
    const { showAlert } = useDialog()
    const [breedName, setBreedName] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!breedName.trim()) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('dog_breeds')
                .insert({ name: breedName.trim(), active: true })

            if (error) throw error

            setBreedName('')
            onSuccess()
            onClose()
            showAlert('Raza añadida correctamente')
        } catch (error: any) {
            console.error('Error adding breed:', error)
            showAlert('Error al añadir raza: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Añadir Nueva Raza">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Nombre de la Raza</label>
                    <input
                        required
                        type="text"
                        value={breedName}
                        onChange={e => setBreedName(e.target.value)}
                        placeholder="Ej. Pastor Australiano"
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
                        {saving ? 'Guardando...' : 'Añadir Raza'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
