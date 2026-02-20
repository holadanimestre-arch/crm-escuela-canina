import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus, Shield, MapPin, Mail, Save, X, Trash2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export function Usuarios() {
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
    const [assignedCityId, setAssignedCityId] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const { data: profilesData } = await supabase
            .from('profiles')
            .select(`
                *,
                cities:assigned_city_id(name)
            `)
            .order('created_at', { ascending: false })

        const { data: citiesData } = await supabase
            .from('cities')
            .select('*')
            .eq('active', true)
            .order('name')

        if (profilesData) setProfiles(profilesData)
        if (citiesData) setCities(citiesData)
        setLoading(false)
    }

    const resetForm = () => {
        setEmail('')
        setPassword('')
        setFullName('')
        setRole('comercial')
        setAssignedCityId('')
        setEditingUser(null)
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
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
                    data: {
                        full_name: fullName,
                    }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('No se pudo crear el usuario')

            // Update the profile with the selected role and city
            // The trigger handle_new_user defaults to 'comercial', so we update it
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    role,
                    assigned_city_id: role === 'adiestrador' ? assignedCityId : null
                })
                .eq('id', authData.user.id)

            if (profileError) throw profileError

            alert('Usuario creado correctamente. El usuario ya puede iniciar sesión.')
            setIsModalOpen(false)
            resetForm()
            fetchData()
        } catch (error: any) {
            console.error('Error creating user:', error)
            alert('Error al crear usuario: ' + (error.message || 'Error desconocido'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    role,
                    assigned_city_id: role === 'adiestrador' ? assignedCityId : null,
                    full_name: fullName
                })
                .eq('id', editingUser.id)

            if (error) throw error

            alert('Usuario actualizado correctamente.')
            setIsModalOpen(false)
            resetForm()
            fetchData()
        } catch (error: any) {
            console.error('Error updating user:', error)
            alert('Error al actualizar usuario: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!userToDelete) return
        setSubmitting(true)

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userToDelete.id)

            if (error) throw error

            alert('Usuario eliminado correctamente.')
            setUserToDelete(null)
            fetchData()
        } catch (error: any) {
            console.error('Error deleting user:', error)
            alert('Error al eliminar usuario: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const openEditModal = (user: any) => {
        setEditingUser(user)
        setFullName(user.full_name || '')
        setRole(user.role)
        setAssignedCityId(user.assigned_city_id || '')
        setIsModalOpen(true)
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando usuarios...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Gestión de Usuarios</h1>
                    <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>Administra los accesos y roles del equipo.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.625rem 1.25rem', backgroundColor: '#000', color: 'white',
                        borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem'
                    }}
                >
                    <UserPlus size={18} />
                    Nuevo Usuario
                </button>
            </div>

            {/* Users Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Nombre y Email</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Rol</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ciudad Asignada</th>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                                            <MapPin size={16} color="#6b7280" />
                                            {p.cities?.name || 'No asignada'}
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
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
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
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>Ciudad Asignada</label>
                                    <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '0.75rem' }}>El adiestrador solo verá clientes y evaluaciones de esta ciudad.</p>
                                    <select
                                        value={assignedCityId}
                                        onChange={(e) => setAssignedCityId(e.target.value)}
                                        required={role === 'adiestrador'}
                                        style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0', backgroundColor: 'white' }}
                                    >
                                        <option value="">Seleccionar ciudad...</option>
                                        {cities.map(city => (
                                            <option key={city.id} value={city.id}>{city.name}</option>
                                        ))}
                                    </select>
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
