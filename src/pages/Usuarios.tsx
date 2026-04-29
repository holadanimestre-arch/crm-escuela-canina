import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus, Shield, MapPin, Mail, Save, X, Trash2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { CoverageMap } from '../components/CoverageMap'
import { useDialog } from '../context/DialogContext'

export function Usuarios() {
    const { showAlert, showConfirm } = useDialog()
    const [profiles, setProfiles] = useState<any[]>([])
    const [cities, setCities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<any>(null)
    const [userToDelete, setUserToDelete] = useState<any>(null)

    // Form states
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<'admin' | 'comercial' | 'adiestrador'>('comercial')
    const [assignedCityIds, setAssignedCityIds] = useState<string[]>([])
    const [submitting, setSubmitting] = useState(false)
    
    // Coverage Map States
    const [baseAddress, setBaseAddress] = useState('')
    const [baseLat, setBaseLat] = useState<number | null>(null)
    const [baseLng, setBaseLng] = useState<number | null>(null)
    const [polygonGreen, setPolygonGreen] = useState<any[] | null>(null)
    const [polygonYellow, setPolygonYellow] = useState<any[] | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        const { data: citiesData } = await supabase
            .from('cities')
            .select('*')
            .eq('active', true)
            .order('name')

        // Fetch all adiestrador-city assignments
        const { data: adiestradorCities } = await supabase
            .from('adiestrador_cities')
            .select('profile_id, city_id, cities:city_id(name)')

        // Attach city names to each profile
        const enrichedProfiles = (profilesData || []).map(p => {
            const cityAssignments = (adiestradorCities || []).filter(ac => ac.profile_id === p.id)
            return {
                ...p,
                assigned_cities: cityAssignments.map(ac => ({
                    id: ac.city_id,
                    name: (ac.cities as any)?.name || 'Desconocida'
                }))
            }
        })

        setProfiles(enrichedProfiles)
        if (citiesData) setCities(citiesData)
        setLoading(false)
    }

    const resetForm = () => {
        setEmail('')
        setPassword('')
        setFullName('')
        setRole('comercial')
        setAssignedCityIds([])
        setBaseAddress('')
        setBaseLat(null)
        setBaseLng(null)
        setPolygonGreen(null)
        setPolygonYellow(null)
        setEditingUser(null)
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()

        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_REGEX.test(email)) {
            showAlert('Por favor, introduce un correo electrónico válido.');
            return;
        }

        setSubmitting(true)

        try {
            // we use a temporary client to sign up the user without logging out the current admin
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false } }
            )

            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/login`,
                    data: {
                        full_name: fullName,
                    }
                }
            })

            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('Este email ya está registrado en el sistema. Si no aparece en la lista, es posible que el perfil fuera borrado pero el acceso siga activo. Intenta borrarlo completamente antes de volver a crearlo.')
                }
                throw authError
            }
            if (!authData.user) throw new Error('No se pudo crear el usuario')

            // Detect fake success if email already exists (Supabase Email Enumeration Protection)
            if (authData.user?.identities && authData.user.identities.length === 0) {
                if (await showConfirm(`El email ${email} ya está registrado ocultamente.\n\n¿Quieres que intente limpiar este acceso automáticamente para que puedas crearlo de nuevo?`)) {
                    handleRepairUser(email)
                    return // stop creation flow since we initiated repair
                } else {
                    throw new Error('Cancelado. El email ya está registrado.')
                }
            }
            // Update the profile with the selected role and city
            // The trigger handle_new_user defaults to 'comercial', so we update it
            // Ensure the profile exists or is updated (Upsert handles "zombie" cases)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: email,
                    full_name: fullName,
                    role,
                    assigned_city_id: role === 'adiestrador' && assignedCityIds.length > 0 ? assignedCityIds[0] : null,
                    base_address: role === 'adiestrador' ? baseAddress : null,
                    base_lat: role === 'adiestrador' ? baseLat : null,
                    base_lng: role === 'adiestrador' ? baseLng : null,
                    coverage_polygon_green: role === 'adiestrador' ? polygonGreen : null,
                    coverage_polygon_yellow: role === 'adiestrador' ? polygonYellow : null
                }, { onConflict: 'id' })
                .select()

            // Sync junction table for adiestrador cities
            if (role === 'adiestrador' && assignedCityIds.length > 0 && authData.user) {
                await supabase.from('adiestrador_cities').delete().eq('profile_id', authData.user.id)
                await supabase.from('adiestrador_cities').insert(
                    assignedCityIds.map(cId => ({ profile_id: authData.user!.id, city_id: cId }))
                )
            }

            if (profileError) throw profileError
            if (!profileData || profileData.length === 0) {
                throw new Error('El usuario se registró en Auth pero no se pudo crear su perfil en la base de datos.')
            }

            showAlert('Usuario creado correctamente. El usuario ya puede iniciar sesión.')
            setIsModalOpen(false)
            resetForm()
            fetchData()
        } catch (error: any) {
            console.error('Error creating user:', error)
            if (error.message.includes('ya está registrado')) {
                if (await showConfirm(error.message + '\n\n¿Quieres que intente limpiar este email automáticamente para que puedas crearlo de nuevo?')) {
                    handleRepairUser(email)
                }
            } else {
                showAlert('Error al crear usuario: ' + (error.message || 'Error desconocido'))
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password && password.length < 8) {
            showAlert('Si quieres cambiar la contraseña, debe tener al menos 8 caracteres.')
            return
        }

        setSubmitting(true)

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    role,
                    assigned_city_id: role === 'adiestrador' && assignedCityIds.length > 0 ? assignedCityIds[0] : null,
                    full_name: fullName,
                    base_address: role === 'adiestrador' ? baseAddress : null,
                    base_lat: role === 'adiestrador' ? baseLat : null,
                    base_lng: role === 'adiestrador' ? baseLng : null,
                    coverage_polygon_green: role === 'adiestrador' ? polygonGreen : null,
                    coverage_polygon_yellow: role === 'adiestrador' ? polygonYellow : null
                })
                .eq('id', editingUser.id)

            // Sync junction table
            await supabase.from('adiestrador_cities').delete().eq('profile_id', editingUser.id)
            if (role === 'adiestrador' && assignedCityIds.length > 0) {
                await supabase.from('adiestrador_cities').insert(
                    assignedCityIds.map(cId => ({ profile_id: editingUser.id, city_id: cId }))
                )
            }

            if (error) throw error

            // Cambio de contraseña opcional
            if (password) {
                const { error: pwError } = await supabase.rpc('admin_set_user_password', {
                    p_user_id: editingUser.id,
                    p_new_password: password,
                })
                if (pwError) throw pwError
            }

            showAlert(password
                ? 'Usuario actualizado y contraseña cambiada correctamente.'
                : 'Usuario actualizado correctamente.')
            setIsModalOpen(false)
            resetForm()
            fetchData()
        } catch (error: any) {
            console.error('Error updating user:', error)
            showAlert('Error al actualizar usuario: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!userToDelete) return
        setSubmitting(true)

        try {
            // Llamamos a la versión 2 de la función RPC para borrar tanto auth.users como el perfil
            const { error } = await supabase.rpc('delete_user_v2', {
                p_user_id: userToDelete.id
            })

            if (error) throw error

            showAlert('Usuario eliminado por completo del sistema.')
            setUserToDelete(null)
            fetchData()
        } catch (error: any) {
            console.error('Error deleting user:', error)
            showAlert('Error al eliminar usuario: ' + (error.message || 'Error desconocido'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleRepairUser = async (emailToRepair: string) => {
        if (!await showConfirm(`¿Seguro que quieres limpiar el acceso de ${emailToRepair}? Esto permitirá volver a crearlo si antes falló.`)) return
        setSubmitting(true)

        try {
            const { error } = await supabase.rpc('delete_user_v2', {
                p_email: emailToRepair
            })

            if (error) throw error

            showAlert('Email desbloqueado. Ahora puedes intentar crearlo de nuevo.')
            fetchData()
        } catch (error: any) {
            console.error('Error repairing user:', error)
            showAlert('Error al limpiar email: ' + (error.message || 'Error desconocido'))
        } finally {
            setSubmitting(false)
        }
    }

    const openEditModal = (user: any) => {
        setEditingUser(user)
        setFullName(user.full_name || '')
        setRole(user.role)
        setAssignedCityIds((user.assigned_cities || []).map((c: any) => c.id))
        setBaseAddress(user.base_address || '')
        setBaseLat(user.base_lat || null)
        setBaseLng(user.base_lng || null)
        setPolygonGreen(user.coverage_polygon_green || null)
        setPolygonYellow(user.coverage_polygon_yellow || null)
        setPassword('')
        setIsModalOpen(true)
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando usuarios...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 600 }}>Gestión de Usuarios</h1>
                    <p style={{ color: '#6b7280', marginTop: '0.25rem', fontSize: '0.875rem' }}>Administra los accesos y roles del equipo.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.625rem 1.25rem', backgroundColor: '#000', color: 'white',
                        borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem',
                        width: window.innerWidth < 640 ? '100%' : 'auto', justifyContent: 'center'
                    }}
                >
                    <UserPlus size={18} />
                    Nuevo Usuario
                </button>
            </div>

            {/* Users Table */}
            <div className="responsive-table-wrapper" style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Nombre y Email</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Rol</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ciudades Asignadas</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>F. Registro</th>
                            <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {profiles.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: 600, color: '#111827' }}>{p.full_name}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Mail size={14} /> {p.email}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                        padding: '0.25rem 0.625rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600,
                                        backgroundColor: p.role === 'admin' ? '#fef3c7' : p.role === 'comercial' ? '#e1f5fe' : '#f0fdf4',
                                        color: p.role === 'admin' ? '#92400e' : p.role === 'comercial' ? '#01579b' : '#16a34a',
                                        textTransform: 'capitalize'
                                    }}>
                                        <Shield size={12} />
                                        {p.role}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    {p.role === 'adiestrador' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151', flexWrap: 'wrap' }}>
                                            <MapPin size={16} color="#6b7280" />
                                            {p.assigned_cities?.length > 0
                                                ? p.assigned_cities.map((c: any) => c.name).join(', ')
                                                : 'No asignada'}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>N/A (Acceso Total)</span>
                                    )}
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                    {new Date(p.created_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                        <button
                                            onClick={() => openEditModal(p)}
                                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setUserToDelete(p); }}
                                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                            title="Eliminar usuario"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
                    padding: '1rem'
                }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                        </div>

                        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Nombre Completo</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    required
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                                />
                            </div>

                            {!editingUser && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Email de Acceso</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="usuario@ejemplo.com"
                                            required
                                            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Contraseña Provisional</label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            required={!editingUser}
                                            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}

                            {editingUser && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Nueva Contraseña <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Dejar en blanco para no cambiar"
                                        autoComplete="new-password"
                                        style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.375rem' }}>
                                        Mínimo 8 caracteres. Solo se cambia si rellenas el campo.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Rol en el CRM</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as any)}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                                >
                                    <option value="admin">Administrador (Acceso Total)</option>
                                    <option value="comercial">Comercial (Leads y Clientes)</option>
                                    <option value="adiestrador">Adiestrador (Evaluaciones y Sesiones)</option>
                                </select>
                            </div>

                            {role === 'adiestrador' && (
                                <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>Ciudades Asignadas</label>
                                    <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '0.75rem' }}>El adiestrador verá clientes y evaluaciones de las ciudades seleccionadas.</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {cities.map(city => (
                                            <label key={city.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', backgroundColor: assignedCityIds.includes(city.id) ? '#dcfce7' : 'white', border: `1px solid ${assignedCityIds.includes(city.id) ? '#86efac' : '#e5e7eb'}`, transition: 'all 0.15s' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={assignedCityIds.includes(city.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setAssignedCityIds(prev => [...prev, city.id])
                                                        } else {
                                                            setAssignedCityIds(prev => prev.filter(id => id !== city.id))
                                                        }
                                                    }}
                                                    style={{ accentColor: '#16a34a' }}
                                                />
                                                <span style={{ fontSize: '0.875rem', fontWeight: assignedCityIds.includes(city.id) ? 600 : 400, color: assignedCityIds.includes(city.id) ? '#166534' : '#374151' }}>{city.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {assignedCityIds.length === 0 && (
                                        <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.5rem' }}>⚠️ Selecciona al menos una ciudad.</p>
                                    )}

                                    {/* Componente Mapa de Cobertura */}
                                    <CoverageMap
                                        baseAddress={baseAddress}
                                        setBaseAddress={setBaseAddress}
                                        baseLat={baseLat}
                                        setBaseLat={setBaseLat}
                                        baseLng={baseLng}
                                        setBaseLng={setBaseLng}
                                        polygonGreen={polygonGreen}
                                        setPolygonGreen={setPolygonGreen}
                                        polygonYellow={polygonYellow}
                                        setPolygonYellow={setPolygonYellow}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        flex: 2, padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                                        backgroundColor: '#000', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer',
                                        fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                    }}
                                >
                                    {submitting ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                                    {!submitting && <Save size={18} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {userToDelete && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110
                }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '400px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#dc2626', marginBottom: '1rem' }}>
                            <div style={{ backgroundColor: '#fee2e2', padding: '0.5rem', borderRadius: '50%' }}>
                                <Trash2 size={24} />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>¿Eliminar usuario?</h2>
                        </div>
                        <p style={{ color: '#4b5563', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                            ¿Estás seguro de que quieres eliminar a <strong>{userToDelete.full_name}</strong>?
                            Esta acción no se puede deshacer y el usuario perderá el acceso al CRM de inmediato.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setUserToDelete(null)}
                                style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: 500 }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={submitting}
                                style={{
                                    flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none',
                                    backgroundColor: '#dc2626', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                {submitting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
