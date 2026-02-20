import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MapPin, Plus, Trash2, Settings as SettingsIcon, Building2, CreditCard, FileText, Bell, Share2, Save, Image as ImageIcon, Upload } from 'lucide-react'

export function Ajustes() {
    const [activeTab, setActiveTab] = useState<'general' | 'ciudades' | 'notificaciones' | 'integraciones' | 'comerciales'>('general')
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
        integration_settings: {}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Configuración</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'general' ? '2px solid #000' : 'none',
                        color: activeTab === 'general' ? '#000' : '#6b7280',
                        fontWeight: activeTab === 'general' ? 600 : 500,
                        cursor: 'pointer'
                    }}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('ciudades')}
                    style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'ciudades' ? '2px solid #000' : 'none',
                        color: activeTab === 'ciudades' ? '#000' : '#6b7280',
                        fontWeight: activeTab === 'ciudades' ? 600 : 500,
                        cursor: 'pointer'
                    }}
                >
                    Ciudades
                </button>
                <button
                    onClick={() => setActiveTab('notificaciones')}
                    style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'notificaciones' ? '2px solid #000' : 'none',
                        color: activeTab === 'notificaciones' ? '#000' : '#6b7280',
                        fontWeight: activeTab === 'notificaciones' ? 600 : 500,
                        cursor: 'pointer'
                    }}
                >
                    Notificaciones
                </button>
                <button
                    onClick={() => setActiveTab('integraciones')}
                    style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'integraciones' ? '2px solid #000' : 'none',
                        color: activeTab === 'integraciones' ? '#000' : '#6b7280',
                        fontWeight: activeTab === 'integraciones' ? 600 : 500,
                        cursor: 'pointer'
                    }}
                >
                    Integraciones
                </button>
                <button
                    onClick={() => setActiveTab('comerciales')}
                    style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'comerciales' ? '2px solid #000' : 'none',
                        color: activeTab === 'comerciales' ? '#000' : '#6b7280',
                        fontWeight: activeTab === 'comerciales' ? 600 : 500,
                        cursor: 'pointer'
                    }}
                >
                    Comerciales
                </button>
            </div>

            {/* Content */}
            {activeTab === 'general' && (
                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px' }}>

                    {/* Sección 1: Datos de Facturación */}
                    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                            <Building2 size={20} color="#2563eb" />
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Datos de Facturación (Cabecera)</h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                            <div style={{ gridColumn: 'span 2' }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
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
                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', maxWidth: '600px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                        <Share2 size={20} color="#166534" />
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Integraciones de Terceros</h2>
                    </div>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        Conecta el CRM con otras herramientas para automatizar tu flujo de trabajo. (Próximamente)
                    </p>
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
                            <button disabled style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '0.375rem', border: '1px solid #d1d5db', cursor: 'not-allowed' }}>Configurar</button>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1.5rem' }}>
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
