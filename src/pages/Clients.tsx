import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database.types'
import { useFilters } from '../context/FilterContext'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../context/DialogContext'
import { Modal } from '../components/Modal'
import { DogBreedModal } from './Leads/DogBreedModal'
import { CallReasonModal } from './Leads/CallReasonModal'
import { AddressCoverageChecker } from '../components/AddressCoverageChecker'

type Client = Database['public']['Tables']['clients']['Row']
type Evaluation = Database['public']['Tables']['evaluations']['Row']

type ClientWithExtras = Client & {
    evaluation?: Evaluation | null
    currentSession?: number
}

type City = Database['public']['Tables']['cities']['Row']
type DogBreed = Database['public']['Tables']['dog_breeds']['Row']
type CallReason = Database['public']['Tables']['call_reasons']['Row']

export function Clients() {
    const { showAlert } = useDialog()
    const navigate = useNavigate()
    const { profile } = useAuth()
    const { cityId } = useFilters()
    const [clients, setClients] = useState<ClientWithExtras[]>([])
    const [loading, setLoading] = useState(true)
    const [cities, setCities] = useState<City[]>([])
    const [dogBreeds, setDogBreeds] = useState<DogBreed[]>([])
    const [callReasons, setCallReasons] = useState<CallReason[]>([])
    const [adiestradores, setAdiestradores] = useState<any[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDogBreedModalOpen, setIsDogBreedModalOpen] = useState(false)
    const [isCallReasonModalOpen, setIsCallReasonModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        city_id: '',
        address: '',
        location_lat: null as number | null,
        location_lng: null as number | null,
        adiestrador_id: '',
        dog_breed: '',
        dog_age: '',
        call_reason: '',
        observations: '',
        converted_by: ''
    })

    useEffect(() => {
        fetchClients()
        fetchCities()
        fetchDogBreeds()
        fetchCallReasons()
    }, [cityId])

    async function fetchCities() {
        const { data } = await supabase.from('cities').select('*').eq('active', true).order('name')
        if (data) setCities(data)
    }

    async function fetchDogBreeds() {
        const { data } = await supabase.from('dog_breeds').select('*').eq('active', true).order('name')
        if (data) setDogBreeds(data)
    }

    async function fetchCallReasons() {
        const { data } = await supabase.from('call_reasons').select('*').eq('active', true).order('name')
        if (data) setCallReasons(data)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (formData.email) {
            const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!EMAIL_REGEX.test(formData.email)) {
                showAlert('Por favor, introduce un correo electrónico válido.');
                return;
            }
        }

        setSubmitting(true)
        try {
            // Find if there is an adiestrador assigned to this city
            let finalAdiestradorId = formData.adiestrador_id || null;
            if (formData.city_id && !finalAdiestradorId) {
                const { data: adiestrador } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('role', 'adiestrador')
                    .eq('assigned_city_id', formData.city_id)
                    .maybeSingle();
                
                if (adiestrador) {
                    finalAdiestradorId = adiestrador.id;
                }
            }

            const { error } = await supabase.from('clients').insert({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                city_id: formData.city_id,
                address: formData.address,
                location_lat: formData.location_lat,
                location_lng: formData.location_lng,
                dog_breed: formData.dog_breed,
                dog_age: formData.dog_age,
                call_reason: formData.call_reason,
                observations: formData.observations,
                converted_by: formData.converted_by,
                status: 'activo',
                adiestrador_id: finalAdiestradorId
            })

            if (error) throw error

            setIsModalOpen(false)
            setFormData({
                name: '', email: '', phone: '', city_id: '', address: '', location_lat: null, location_lng: null, adiestrador_id: '',
                dog_breed: '', dog_age: '', call_reason: '', observations: '', converted_by: ''
            })
            fetchClients()
            showAlert('Cliente creado con éxito')
        } catch (error: any) {
            console.error('Error creating client:', error)
            showAlert('Error al crear el cliente: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    async function fetchClients() {
        try {
            let query = supabase
                .from('clients')
                .select('*, cities(name)')

            if (cityId !== 'all') {
                query = query.eq('city_id', cityId)
            }

            // Si es adiestrador, solo ve sus clientes asignados
            if (profile?.role === 'adiestrador') {
                query = query.eq('adiestrador_id', profile.id)
            }

            const { data: clientsData, error: clientsError } = await query
                .order('created_at', { ascending: false })

            if (clientsError) throw clientsError
            if (!clientsData) return

            // Fetch evaluations for all clients
            const clientIds = clientsData.map(c => c.id)
            const { data: evaluations } = await supabase
                .from('evaluations')
                .select('*')
                .in('client_id', clientIds)

            // Fetch sessions (count completed per client)
            const { data: sessions } = await supabase
                .from('sessions')
                .select('client_id, session_number, completed')
                .in('client_id', clientIds)
                .eq('completed', true)
                .order('session_number', { ascending: false })

            // Map evaluations and sessions to clients
            const enriched: ClientWithExtras[] = clientsData.map(client => {
                const eval_ = evaluations?.find(e => e.client_id === client.id) || null
                const clientSessions = sessions?.filter(s => s.client_id === client.id) || []
                const sessionNumbers = clientSessions
                    .map(s => s.session_number)
                    .filter((n): n is number => n != null)
                const maxSession = sessionNumbers.length > 0
                    ? Math.max(...sessionNumbers)
                    : 0
                return { ...client, evaluation: eval_, currentSession: maxSession }
            })

            setClients(enriched)
        } catch (error) {
            console.error('Error fetching clients:', error)
        } finally {
            setLoading(false)
        }
    }

    function getEvaluationBadge(client: ClientWithExtras) {
        const ev = client.evaluation
        if (!ev) {
            return { text: 'Sin Agendar', bg: '#fef9c3', color: '#854d0e' }
        }
        if (ev.result === 'aprobada') {
            return { text: 'Aprobada', bg: '#dcfce7', color: '#166534' }
        }
        if (ev.result === 'rechazada') {
            return { text: 'No Aprobada', bg: '#fee2e2', color: '#991b1b' }
        }
        // Has evaluation but no final result yet → show scheduled date
        const dateStr = ev.scheduled_date
            ? new Date(ev.scheduled_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
            : 'Pendiente'
        return { text: dateStr, bg: '#dbeafe', color: '#1e40af' }
    }

    if (loading) return <div>Cargando clientes...</div>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 600 }}>Clientes</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        backgroundColor: '#000',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.9rem'
                    }}
                >
                    + Cliente
                </button>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Nombre</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Estado</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Ciudad</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Evaluación</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Sesión</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay clientes registrados</td>
                            </tr>
                        ) : (
                            clients.map((client) => {
                                const badge = getEvaluationBadge(client)
                                return (
                                    <tr 
                                        key={client.id} 
                                        className="clickable-row"
                                        style={{ borderBottom: '1px solid #f3f4f6' }}
                                        onClick={() => navigate(`/clientes/${client.id}`)}
                                    >
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                                            {client.name}
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>{client.email}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                backgroundColor: client.status === 'activo' ? '#dcfce7' : '#f3f4f6',
                                                color: client.status === 'activo' ? '#166534' : '#374151',
                                                textTransform: 'capitalize'
                                            }}>
                                                {client.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            {/* @ts-ignore */}
                                            {client.cities?.name}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: badge.bg,
                                                color: badge.color
                                            }}>
                                                {badge.text}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>
                                            {client.currentSession ? `${client.currentSession} / ${client.evaluation?.total_sessions || '?'}` : '-'}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${client.id}`) }} style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem' }}>Ver Ficha</button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Cliente Manual">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Nombre Completo</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Ciudad / Zona</label>
                            <select
                                required
                                value={formData.city_id}
                                onChange={async (e) => {
                                    const newCityId = e.target.value;
                                    setFormData(prev => ({ ...prev, city_id: newCityId, adiestrador_id: '' }));
                                    if (newCityId) {
                                        const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'adiestrador').eq('assigned_city_id', newCityId);
                                        setAdiestradores(data || []);
                                    } else {
                                        setAdiestradores([]);
                                    }
                                }}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona una ciudad...</option>
                                {cities.map(city => (
                                    <option key={city.id} value={city.id}>{city.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                                placeholder="email@ejemplo.com"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Teléfono</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                                placeholder="600 000 000"
                            />
                        </div>
                    </div>

                    <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                            Dirección de Trabajo
                        </label>
                        {!formData.city_id ? (
                            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Selecciona primero la ciudad destino para analizar la cobertura.</p>
                        ) : (
                            <AddressCoverageChecker
                                cityId={formData.city_id}
                                initialAddress={formData.address}
                                onAddressSelect={(addr, lat, lng, recId) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        address: addr,
                                        location_lat: lat,
                                        location_lng: lng,
                                        adiestrador_id: recId || prev.adiestrador_id
                                    }))
                                }}
                            />
                        )}
                        <hr style={{ margin: '1rem 0', borderColor: '#e5e7eb' }} />
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                            CONFIRMAR ADIESTRADOR DE REFERENCIA
                        </label>
                        <select
                            required
                            value={formData.adiestrador_id || ''}
                            onChange={e => setFormData({ ...formData, adiestrador_id: e.target.value })}
                            disabled={!formData.city_id}
                            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600 }}
                        >
                            <option value="">Selecciona Adiestrador...</option>
                            {adiestradores.map(ad => (
                                <option key={ad.id} value={ad.id}>{ad.full_name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Raza</label>
                                <button type="button" onClick={() => setIsDogBreedModalOpen(true)} style={{ fontSize: '0.7rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>+ Nueva</button>
                            </div>
                            <select
                                value={formData.dog_breed}
                                onChange={e => setFormData({ ...formData, dog_breed: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona raza...</option>
                                {dogBreeds.map(breed => (
                                    <option key={breed.id} value={breed.name}>{breed.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Edad del Perro</label>
                            <select
                                value={formData.dog_age}
                                onChange={e => setFormData({ ...formData, dog_age: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona edad...</option>
                                <option value="Cachorro">Cachorro</option>
                                {Array.from({ length: 15 }, (_, i) => i + 1).map(age => (
                                    <option key={age} value={`${age} año${age > 1 ? 's' : ''}`}>{age} año{age > 1 ? 's' : ''}</option>
                                ))}
                                <option value="+15 años">+15 años</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Motivo Alta</label>
                                <button type="button" onClick={() => setIsCallReasonModalOpen(true)} style={{ fontSize: '0.7rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>+ Nuevo</button>
                            </div>
                            <select
                                value={formData.call_reason}
                                onChange={e => setFormData({ ...formData, call_reason: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona motivo...</option>
                                {callReasons.map(reason => (
                                    <option key={reason.id} value={reason.name}>{reason.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Comercial / Alta por...</label>
                            <select
                                value={formData.converted_by}
                                onChange={e => setFormData({ ...formData, converted_by: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona comercial...</option>
                                <option value="Lupe">Lupe</option>
                                <option value="Aroha">Aroha</option>
                                <option value="Pablo">Pablo</option>
                                <option value="Manual">Manual / Admin</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Observaciones Iniciales</label>
                        <textarea
                            value={formData.observations}
                            onChange={e => setFormData({ ...formData, observations: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', minHeight: '80px' }}
                            placeholder="Notas importantes del caso..."
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#000', color: 'white', cursor: submitting ? 'wait' : 'pointer' }}
                        >
                            {submitting ? 'Guardando...' : 'Crear Cliente'}
                        </button>
                    </div>
                </form>
            </Modal>

            <DogBreedModal
                isOpen={isDogBreedModalOpen}
                onClose={() => setIsDogBreedModalOpen(false)}
                onSuccess={fetchDogBreeds}
            />

            <CallReasonModal
                isOpen={isCallReasonModalOpen}
                onClose={() => setIsCallReasonModalOpen(false)}
                onSuccess={fetchCallReasons}
            />
        </div>
    )
}
