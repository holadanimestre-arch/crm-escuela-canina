import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Database } from '../../types/database.types'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../context/DialogContext'

type Lead = Database['public']['Tables']['leads']['Row']

interface LeadDetailModalProps {
    lead: Lead | null
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void
}

export function LeadDetailModal({ lead, isOpen, onClose, onUpdate }: LeadDetailModalProps) {
    const { showAlert } = useDialog()
    const [formData, setFormData] = useState<Partial<Lead>>({})
    const [sendWA, setSendWA] = useState(false) // Nueva variable dedicada
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (lead && isOpen) {
            setFormData({
                notes: lead.notes || '',
                source: lead.source || 'Orgánico',
                contact_attempts: lead.contact_attempts || 0,
                first_contact_at: lead.first_contact_at ? new Date(lead.first_contact_at).toISOString().slice(0, 16) : '',
                effective_contact_at: lead.effective_contact_at ? new Date(lead.effective_contact_at).toISOString().slice(0, 16) : ''
            })
            setSendWA(lead.send_whatsapp || false)
        }
    }, [lead])

    if (!lead) return null

    async function handleSave() {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    notes: formData.notes,
                    source: formData.source,
                    contact_attempts: Number(formData.contact_attempts),
                    first_contact_at: formData.first_contact_at || null,
                    effective_contact_at: formData.effective_contact_at || null,
                    send_whatsapp: sendWA // Usamos la nueva variable
                })
                .eq('id', lead!.id)

            if (error) throw error

            if (sendWA) {
                const { data: fnData, error: fnError } = await supabase.functions.invoke('send-whatsapp-wazend', {
                    body: { leadId: lead!.id }
                })

                if (fnError) {
                    showAlert('Error en el servicio de WhatsApp: ' + fnError.message)
                } else if (fnData?.error) {
                    showAlert('Nota de Wazend: ' + fnData.error)
                }
            }

            onUpdate()
            onClose()
        } catch (error: any) {
            console.error('Error updating lead:', error)
            showAlert('Error al guardar los cambios. Por favor, revisa tu conexión.');
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={lead.name} maxWidth="800px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Basic Info (Read Only) */}
                <div style={{ display: 'flex', gap: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>Teléfono</label>
                        <div style={{ fontWeight: 500 }}>{lead.phone || '-'}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>Email</label>
                        <div style={{ fontWeight: 500 }}>{lead.email || '-'}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>Ciudad</label>
                        {/* @ts-ignore - The exact join shape might vary but we just safely cast it to display */}
                        <div style={{ fontWeight: 500 }}>{(lead as any).cities?.name || '-'}</div>
                    </div>
                </div>

                {/* Contact Tracking */}
                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>Fecha 1er Contacto</label>
                        <input
                            type="datetime-local"
                            value={String(formData.first_contact_at || '')}
                            onChange={e => setFormData({ ...formData, first_contact_at: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontFamily: 'inherit' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>Fecha Contacto Efectivo</label>
                        <input
                            type="datetime-local"
                            value={String(formData.effective_contact_at || '')}
                            onChange={e => setFormData({ ...formData, effective_contact_at: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontFamily: 'inherit' }}
                        />
                    </div>
                </div>

                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>Nº Intentos</label>
                        <select
                            value={formData.contact_attempts || 0}
                            onChange={e => setFormData({ ...formData, contact_attempts: Number(e.target.value) })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                        >
                            {[0, 1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>Origen</label>
                        <select
                            value={formData.source || 'Orgánico'}
                            onChange={e => setFormData({ ...formData, source: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                        >
                            <option value="Orgánico">Orgánico</option>
                            <option value="Meta">Meta</option>
                            <option value="Tiktok">Tiktok</option>
                            <option value="Google Ads">Google Ads</option>
                        </select>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>Observaciones</label>
                    <textarea
                        rows={4}
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Anotaciones importantes..."
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                    />
                </div>

                {/* Whatsapp Section */}
                {!lead.last_whatsapp_sent_at ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                        <input
                            type="checkbox"
                            id="whatsapp-check"
                            checked={sendWA}
                            onChange={e => setSendWA(e.target.checked)}
                            style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <label htmlFor="whatsapp-check" style={{ fontWeight: 500, color: '#166534' }}>
                            Enviar Whatsapp (Automático)
                        </label>
                    </div>
                ) : (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>WhatsApp enviado correctamente:</span>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1f2937' }}>
                            {new Date(lead.last_whatsapp_sent_at).toLocaleString('es-ES', {
                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: saving ? 'wait' : 'pointer' }}
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>

            </div>
        </Modal>
    )
}
