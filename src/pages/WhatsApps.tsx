import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useDialog } from '../context/DialogContext'
import { MessageCircle, User, UserCheck, Clock, MousePointerClick, Save } from 'lucide-react'

// Catálogo de automatizaciones de WhatsApp del CRM.
// Cada una está ligada a una columna de plantilla en crm_settings.
const AUTOMATIONS = [
    {
        key: 'whatsapp_no_contesta_template' as const,
        title: 'Cliente no contesta',
        recipient: 'Al cliente',
        recipientIcon: User,
        type: 'manual' as const,
        trigger: 'Cuando el adiestrador marca a un cliente como "No contesta" en sus llamadas pendientes.',
        tags: [{ tag: '[NOMBRE]', desc: 'Nombre del cliente' }],
        defaultText: 'Hola [NOMBRE], soy de la Escuela Canina. No hemos podido contactar contigo.'
    },
    {
        key: 'whatsapp_new_client_template' as const,
        title: 'Cliente nuevo asignado',
        recipient: 'Al adiestrador asignado',
        recipientIcon: UserCheck,
        type: 'auto' as const,
        trigger: 'Automático: en el momento en que se le sube un cliente al adiestrador para la evaluación inicial (al convertir un lead o crear un cliente).',
        tags: [{ tag: '[NOMBRE]', desc: 'Nombre del cliente (opcional)' }],
        defaultText: 'Buenas! te he subido un cliente para llamar cuando puedas 😉'
    },
    {
        key: 'whatsapp_eval_reminder_template' as const,
        title: 'Evaluación inicial sin fecha',
        recipient: 'Al adiestrador asignado',
        recipientIcon: UserCheck,
        type: 'auto' as const,
        trigger: 'Automático: 2 días después de asignar el cliente al adiestrador si aún no tiene fecha de evaluación inicial. Se envía una sola vez.',
        tags: [{ tag: '[NOMBRE]', desc: 'Nombre del cliente' }],
        defaultText: 'Buenas! He visto que el cliente "[NOMBRE]" no tiene asignada la fecha de evaluación inicial todavía, ¿qué problema has tenido?'
    }
]

export function WhatsApps() {
    const { showAlert } = useDialog()
    const [settings, setSettings] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        ;(async () => {
            const { data } = await supabase.from('crm_settings').select('*').maybeSingle()
            if (data) setSettings(data)
            setLoading(false)
        })()
    }, [])

    const save = async () => {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('crm_settings')
                .upsert({ id: true, ...settings, updated_at: new Date().toISOString() })
            if (error) throw error
            showAlert('Mensajes guardados correctamente.')
        } catch (err: any) {
            showAlert('Error al guardar: ' + (err.message || 'Error desconocido'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Cargando automatizaciones...</div>

    return (
        <div style={{ maxWidth: '820px' }}>
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageCircle size={22} color="#25D366" />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>WhatsApps</h1>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Estos son los mensajes automáticos de WhatsApp que el sistema envía actualmente y a quién van dirigidos. Puedes editar aquí los textos.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {AUTOMATIONS.map(a => {
                    const RecIcon = a.recipientIcon
                    return (
                        <div key={a.key} style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{a.title}</h2>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: '#eef2ff', color: '#4338ca' }}>
                                        <RecIcon size={13} /> {a.recipient}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: a.type === 'auto' ? '#dcfce7' : '#fef9c3', color: a.type === 'auto' ? '#166534' : '#854d0e' }}>
                                        {a.type === 'auto' ? <Clock size={13} /> : <MousePointerClick size={13} />}
                                        {a.type === 'auto' ? 'Automático' : 'Manual'}
                                    </span>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
                                <strong style={{ color: '#374151' }}>¿Cuándo se envía?</strong> {a.trigger}
                            </p>

                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Mensaje</label>
                            <textarea
                                value={settings[a.key] ?? ''}
                                onChange={e => setSettings({ ...settings, [a.key]: e.target.value })}
                                placeholder={a.defaultText}
                                style={{ width: '100%', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', minHeight: '110px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }}
                            />

                            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Etiquetas:</span>
                                {a.tags.map(t => (
                                    <span key={t.tag} style={{ fontSize: '0.72rem', color: '#4b5563', backgroundColor: '#f3f4f6', borderRadius: '0.375rem', padding: '0.15rem 0.45rem' }}>
                                        <code style={{ fontWeight: 700 }}>{t.tag}</code> · {t.desc}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', backgroundColor: '#000', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
                >
                    {saving ? 'Guardando...' : 'Guardar cambios'} <Save size={18} />
                </button>
            </div>
        </div>
    )
}
