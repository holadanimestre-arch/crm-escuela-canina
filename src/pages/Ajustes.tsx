import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MapPin, Plus, Trash2, Settings as SettingsIcon, Building2, CreditCard, FileText, Bell, Share2, Save, Image as ImageIcon, Upload } from 'lucide-react'

export function Ajustes() {
    const [activeTab, setActiveTab] = useState<'general' | 'ciudades' | 'notificaciones' | 'integraciones' | 'comerciales' | 'whatsapp'>('general')
    const [comerciales, setComerciales] = useState<any[]>([])
    const [cities, setCities] = useState<any[]>([])
    const [newCityName, setNewCityName] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [cityToDelete, setCityToDelete] = useState<any>(null)

    // CRM Settings State
    const [settings, setSettings] = useState({
        business_name: '',
        business_cif: '',
        business_address: '',
        business_phone: '',
        business_email: '',
        business_iban: '',
        invoice_footer: '',
        invoice_logo_url: '',
        default_evaluation_price: 0,
        default_session_price: 0,
        notification_settings: {},
        integration_settings: {},
        whatsapp_no_contesta_template: ''
    })

    useEffect(() => {
        fetchInitialData()
    }, [activeTab])

    const fetchInitialData = async () => {
        setLoading(true)
        if (activeTab === 'ciudades') {
            const { data } = await supabase
                .from('cities')
                .select('*')
                .eq('active', true)
                .order('name')
            if (data) setCities(data)
        } else if (activeTab === 'comerciales') {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'comercial')
                .order('full_name')
            if (data) setComerciales(data)
        } else {
            const { data } = await supabase
                .from('crm_settings')
                .select('*')
                .single()
            if (data) setSettings(data)
        }
        setLoading(false)
    }

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const { error } = await supabase
                .from('crm_settings')
                .upsert({
                    id: true, // Always true for the single row
                    ...settings,
                    updated_at: new Date().toISOString()
                })

            if (error) throw error
            alert('Configuración guardada correctamente.')
        } catch (error: any) {
            console.error('Error saving settings:', error)
            alert('Error al guardar: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const handleAddCity = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newCityName.trim()) return

        try {
            const { error } = await supabase
                .from('cities')
                .insert([{ name: newCityName.trim(), active: true }])

            if (error) throw error

            setNewCityName('')
            fetchInitialData()
        } catch (error: any) {
            alert('Error al añadir ciudad: ' + error.message)
        }
    }

    const handleDeleteCity = async () => {
        if (!cityToDelete) return

        try {
            // We soft delete by setting active = false, OR hard delete if no clients are attached.
            // For now, let's try a hard delete to keep it simple as requested, 
            // but usually soft delete is safer.
            const { error } = await supabase
                .from('cities')
                .delete()
                .eq('id', cityToDelete.id)

            if (error) {
                // If there's a foreign key constraint, it will fail, which is good.
                throw new Error('No se puede eliminar la ciudad porque tiene datos asociados (clientes o leads).')
            }

            setCityToDelete(null)
            fetchInitialData()
        } catch (error: any) {
            alert(error.message)
            setCityToDelete(null)
        }
    }

    const handleUpdateAvatar = async (userId: string, avatarUrl: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: avatarUrl })
                .eq('id', userId)

            if (error) throw error

            setComerciales(prev => prev.map(c => c.id === userId ? { ...c, avatar_url: avatarUrl } : c))
            alert(avatarUrl ? 'Foto actualizada correctamente' : 'Foto eliminada correctamente')
        } catch (error: any) {
            alert('Error al actualizar foto: ' + error.message)
        }
    }

    const handleImageUpload = async (userId: string, file: File) => {
        setSaving(true)
        try {
            // Validar tipo de archivo
            if (!file.type.startsWith('image/')) {
                throw new Error('El archivo debe ser una imagen')
            }

            // Validar tamaño (máx 2MB)
            if (file.size > 2 * 1024 * 1024) {
                throw new Error('La imagen es demasiado grande (máximo 2MB)')
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${userId}-${Date.now()}.${fileExt}`
            const filePath = fileName

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            const publicUrl = data.publicUrl

            await handleUpdateAvatar(userId, publicUrl)
        } catch (error: any) {
            console.error('Error uploading:', error)
            alert('Error al subir imagen: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Configuración</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                {[
                    { id: 'general', label: 'General' },
                    { id: 'ciudades', label: 'Ciudades' },
                    { id: 'notificaciones', label: 'Notificaciones' },
                    { id: 'integraciones', label: 'Integraciones' },
                    { id: 'comerciales', label: 'Comerciales' },
                    { id: 'whatsapp', label: 'WhatsApp' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '0.75rem 1rem',
                            border: 'none',
                            background: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #000' : 'none',
                            color: activeTab === tab.id ? '#000' : '#6b7280',
                            fontWeight: activeTab === tab.id ? 600 : 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'general' && (
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px' }}>

                    {/* Sección 1: Datos de Facturación */}
                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                            <Building2 size={20} color="#2563eb" />
                            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Datos de Facturación (Cabecera)</h2>
                        </div>
                        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Nombre Comercial / Fiscal</label>
                                <input
                                    type="text"
                                    value={settings.business_name}
                                    onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>CIF / NIF</label>
                                <input
                                    type="text"
                                    value={settings.business_cif}
                                    onChange={(e) => setSettings({ ...settings, business_cif: e.target.value })}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div style={{ gridColumn: window.innerWidth < 640 ? 'span 1' : 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Dirección Fiscal</label>
                                <input
                                    type="text"
                                    value={settings.business_address}
                                    onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Teléfono de Contacto</label>
                                <input
                                    type="text"
                                    value={settings.business_phone}
                                    onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Email de Contacto</label>
                                <input
                                    type="email"
                                    value={settings.business_email}
                                    onChange={(e) => setSettings({ ...settings, business_email: e.target.value })}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: Pagos y Documentos */}
                    <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                                <FileText size={20} color="#166534" />
                                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>PDF de Facturas</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Pie de Página de la Factura</label>
                                    <textarea
                                        value={settings.invoice_footer}
                                        onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
                                        placeholder="Texto legal, política de devoluciones, etc."
                                        style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', height: '100px', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Logo URL</label>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={settings.invoice_logo_url}
                                            onChange={(e) => setSettings({ ...settings, invoice_logo_url: e.target.value })}
                                            placeholder="URL de la imagen (vacia para logo por defecto)"
                                            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                        />
                                        <div style={{ width: '50px', height: '50px', border: '1px dashed #d1d5db', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', overflow: 'hidden' }}>
                                            {settings.invoice_logo_url ? <img src={settings.invoice_logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <SettingsIcon size={18} color="#9ca3af" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                                <CreditCard size={20} color="#92400e" />
                                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Método de Pago</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>IBAN / Cuenta Bancaria</label>
                                    <input
                                        type="text"
                                        value={settings.business_iban}
                                        onChange={(e) => setSettings({ ...settings, business_iban: e.target.value })}
                                        placeholder="ES00 0000 ..."
                                        style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '1rem' }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Tarifas por Defecto</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Evaluación (€)</label>
                                            <input
                                                type="number"
                                                value={settings.default_evaluation_price}
                                                onChange={(e) => setSettings({ ...settings, default_evaluation_price: parseFloat(e.target.value) || 0 })}
                                                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Sesión Individual (€)</label>
                                            <input
                                                type="number"
                                                value={settings.default_session_price}
                                                onChange={(e) => setSettings({ ...settings, default_session_price: parseFloat(e.target.value) || 0 })}
                                                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem', marginTop: '1rem' }}>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.75rem 2rem', backgroundColor: '#000', color: 'white',
                                borderRadius: '0.5rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: 600, fontSize: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                            <Save size={18} />
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'notificaciones' && (
                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', maxWidth: '600px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                        <Bell size={20} color="#2563eb" />
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Configuración de Notificaciones</h2>
                    </div>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        Configura cómo y cuándo quieres recibir avisos del sistema. (Próximamente)
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', backgroundColor: '#f9fafb', cursor: 'not-allowed' }}>
                            <input type="checkbox" disabled checked />
                            <div>
                                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Aviso Email nuevo Lead</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Recibe un email cada vez que entre un nuevo contacto.</div>
                            </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', backgroundColor: '#f9fafb', cursor: 'not-allowed' }}>
                            <input type="checkbox" disabled checked />
                            <div>
                                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Aviso evaluaciones pendientes</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Recordatorio diario de evaluaciones asignadas sin completar.</div>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {activeTab === 'integraciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px' }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                            <Share2 size={24} color="#2563eb" />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Integración con Web (Divi + Make)</h2>
                        </div>

                        <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.75rem' }}>Paso 1: Configuración en Make</h3>
                            <p style={{ fontSize: '0.875rem', color: '#0c4a6e', lineHeight: '1.5' }}>
                                Crea un escenario en Make con los siguientes módulos:
                            </p>
                            <ol style={{ fontSize: '0.875rem', color: '#0c4a6e', marginTop: '0.5rem', paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li><strong>Webhook:</strong> Crea un "Custom Webhook" y copia la URL en tu formulario de Divi.</li>
                                <li><strong>Supabase (Search Row):</strong> Opcional, para buscar el <code>city_id</code> si el formulario envía el nombre de la ciudad.</li>
                                <li><strong>Supabase (Create Row):</strong> Selecciona la tabla <code>leads</code> y mapea los campos.</li>
                            </ol>
                        </div>

                        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: '1rem' }}>Configuración de Supabase</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>API URL</div>
                                        <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{import.meta.env.VITE_SUPABASE_URL}</code>
                                    </div>
                                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Tabla Destino</div>
                                        <code style={{ fontSize: '0.75rem' }}>leads</code>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 500, padding: '0.5rem' }}>
                                        ⚠️ Necesitarás la <strong>Service Role Key</strong> de Supabase para poder insertar datos desde Make. Pídela al administrador de IT.
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: '1rem' }}>Mapeo de Campos</h3>
                                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Campo CRM</th>
                                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Valor Recomendado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.5rem' }}><code>name</code></td>
                                            <td style={{ padding: '0.5rem', color: '#6b7280' }}>Nombre del formulario</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.5rem' }}><code>email</code></td>
                                            <td style={{ padding: '0.5rem', color: '#6b7280' }}>Email del formulario</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.5rem' }}><code>phone</code></td>
                                            <td style={{ padding: '0.5rem', color: '#6b7280' }}>Teléfono del formulario</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.5rem' }}><code>source</code></td>
                                            <td style={{ padding: '0.5rem', color: '#6b7280' }}><code>web</code></td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.5rem' }}><code>status</code></td>
                                            <td style={{ padding: '0.5rem', color: '#6b7280' }}><code>nuevo</code></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '0.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#854d0e' }}>
                                <strong>Nota sobre Ciudades:</strong> Si tu formulario envía el nombre de la ciudad (ej: "Madrid"), Make deberá buscar primero el <code>id</code> de esa ciudad en la tabla <code>cities</code> antes de crear el lead, ya que el campo <code>city_id</code> requiere un identificador único (UUID).
                            </p>
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                            <FileText size={20} color="#6b7280" />
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Otras Integraciones</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ backgroundColor: '#1877F2', padding: '0.5rem', borderRadius: '0.375rem', display: 'flex' }}>
                                        <Share2 size={16} color="white" />
                                    </div>
                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Facebook Lead Ads</div>
                                </div>
                                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontWeight: 500 }}>Conectado</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ backgroundColor: '#25D366', padding: '0.5rem', borderRadius: '0.375rem', display: 'flex' }}>
                                        <Share2 size={16} color="white" />
                                    </div>
                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>WhatsApp Business API</div>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Próximamente</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ciudades' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Add City Form */}
                    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Añadir Nueva Ciudad</h3>
                        <form onSubmit={handleAddCity} style={{ display: 'flex', gap: '1rem' }}>
                            <input
                                type="text"
                                value={newCityName}
                                onChange={(e) => setNewCityName(e.target.value)}
                                placeholder="Nombre de la ciudad..."
                                style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                                required
                            />
                            <button
                                type="submit"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.625rem 1.25rem', backgroundColor: '#000', color: 'white',
                                    borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 500
                                }}
                            >
                                <Plus size={18} />
                                Añadir
                            </button>
                        </form>
                    </div>

                    {/* Cities List */}
                    <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Ciudades Activas</h3>
                        </div>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando ciudades...</div>
                        ) : (
                            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', padding: '1.25rem' }}>
                                {cities.map(city => (
                                    <div
                                        key={city.id}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #f3f4f6'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <MapPin size={16} color="#6b7280" />
                                            <span style={{ fontWeight: 500 }}>{city.name}</span>
                                        </div>
                                        <button
                                            onClick={() => setCityToDelete(city)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                            title="Eliminar ciudad"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'comerciales' && (
                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', maxWidth: '800px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                        <ImageIcon size={20} color="#8b5cf6" />
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Fotos de Comerciales</h2>
                    </div>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        Añade una URL pública de la foto de cada comercial para que aparezca en su tarjeta del Dashboard.
                    </p>

                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando equipo comercial...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {comerciales.map(comercial => (
                                <div key={comercial.id} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e5e7eb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {comercial.avatar_url ? (
                                            <img src={comercial.avatar_url} alt={comercial.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '1.5rem', color: '#9ca3af', fontWeight: 600 }}>
                                                {comercial.full_name ? comercial.full_name.charAt(0).toUpperCase() : '?'}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{comercial.full_name || 'Sin nombre'}</h3>
                                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>{comercial.email}</p>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                id={`upload-${comercial.id}`}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleImageUpload(comercial.id, file)
                                                }}
                                                style={{ display: 'none' }}
                                            />
                                            <button
                                                onClick={() => document.getElementById(`upload-${comercial.id}`)?.click()}
                                                disabled={saving}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.5rem 1rem', backgroundColor: '#000', color: 'white',
                                                    borderRadius: '0.375rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.875rem', fontWeight: 500
                                                }}
                                            >
                                                <Upload size={16} />
                                                {saving ? 'Subiendo...' : 'Subir Foto'}
                                            </button>

                                            {comercial.avatar_url && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('¿Estás seguro de que quieres eliminar la foto?')) {
                                                            handleUpdateAvatar(comercial.id, '')
                                                        }
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                        padding: '0.5rem 0.75rem', backgroundColor: '#fee2e2', color: '#dc2626',
                                                        borderRadius: '0.375rem', border: '1px solid #fecaca', cursor: 'pointer',
                                                        fontSize: '0.875rem', fontWeight: 500
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {comerciales.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #d1d5db' }}>
                                    No hay perfiles con el rol "comercial" en el sistema.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'whatsapp' && (
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                            <Share2 size={24} color="#25D366" />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Configuración de WhatsApp</h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                    Mensaje automático "No contesta"
                                </label>
                                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                                    Este mensaje se enviará automáticamente a través de Wazend cuando marques a un cliente como "No contesta".
                                </p>
                                <textarea
                                    value={settings.whatsapp_no_contesta_template}
                                    onChange={(e) => setSettings({ ...settings, whatsapp_no_contesta_template: e.target.value })}
                                    placeholder="Escribe el mensaje aquí..."
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #d1d5db',
                                        height: '150px',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        fontSize: '1rem'
                                    }}
                                />
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Etiquetas disponibles:</h4>
                                    <ul style={{ fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.25rem' }}>
                                        <li><strong>[NOMBRE]</strong>: Se sustituirá por el nombre del cliente.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.75rem 2rem', backgroundColor: '#000', color: 'white',
                                borderRadius: '0.5rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                                fontWeight: 600, fontSize: '1rem'
                            }}
                        >
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                            <Save size={18} />
                        </button>
                    </div>
                </form>
            )}

            {/* Delete Confirmation Modal */}
            {cityToDelete && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110
                }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>¿Eliminar ciudad?</h2>
                        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
                            ¿Estás seguro de que quieres eliminar <strong>{cityToDelete.name}</strong>?
                            Esta acción solo se completará si no hay clientes o leads asociados a esta ciudad.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setCityToDelete(null)}
                                style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCity}
                                style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
