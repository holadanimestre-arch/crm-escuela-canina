import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database.types'
import { Modal } from '../components/Modal'
import { useAuth } from '../hooks/useAuth'
import { LeadDetailModal } from './Leads/LeadDetailModal'
import { CityModal } from './Leads/CityModal'
import { DogBreedModal } from './Leads/DogBreedModal'
import { CallReasonModal } from './Leads/CallReasonModal'
import { useFilters } from '../context/FilterContext'

type Lead = Database['public']['Tables']['leads']['Row']
type City = Database['public']['Tables']['cities']['Row']
type DogBreed = Database['public']['Tables']['dog_breeds']['Row']
type CallReason = Database['public']['Tables']['call_reasons']['Row']

export function Leads() {
    const { profile } = useAuth()
    const [leads, setLeads] = useState<Lead[]>([])
    const [cities, setCities] = useState<City[]>([])
    const [dogBreeds, setDogBreeds] = useState<DogBreed[]>([])
    const [callReasons, setCallReasons] = useState<CallReason[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [isCityModalOpen, setIsCityModalOpen] = useState(false)
    const [isDogBreedModalOpen, setIsDogBreedModalOpen] = useState(false)
    const [isCallReasonModalOpen, setIsCallReasonModalOpen] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        city_id: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [convertData, setConvertData] = useState({
        dog_breed: '',
        dog_age: '',
        address: '',
        call_reason: '',
        observations: '',
        converted_by: ''
    })

    const { cityId } = useFilters()

    useEffect(() => {
        fetchLeads()
        fetchCities()
        fetchDogBreeds()
        fetchCallReasons()
    }, [cityId])

    async function fetchLeads() {
        try {
            let query = supabase
                .from('leads')
                .select('*, cities(name)')
                .neq('status', 'evaluacion_aceptada') // Hide converted leads

            if (cityId !== 'all') {
                query = query.eq('city_id', cityId)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })

            if (error) throw error
            if (data) setLeads(data)
        } catch (error) {
            console.error('Error fetching leads:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchCities() {
        const { data } = await supabase.from('cities').select('*').eq('active', true).order('name')
        if (data) setCities(data)
    }

    async function fetchDogBreeds() {
        const { data, error } = await supabase.from('dog_breeds').select('*').eq('active', true).order('name')
        if (error) {
            console.error('Error fetching dog breeds:', error)
        }
        if (data) {
            setDogBreeds(data)
        }
    }

    async function fetchCallReasons() {
        const { data, error } = await supabase.from('call_reasons').select('*').eq('active', true).order('name')
        if (error) {
            console.error('Error fetching call reasons:', error)
        }
        if (data) {
            setCallReasons(data)
        }
    }

    function openConvertModal(lead: Lead) {
        setSelectedLead(lead)
        setConvertData({ dog_breed: '', dog_age: '', address: '', call_reason: '', observations: '', converted_by: '' })
        setIsConvertModalOpen(true)
    }

    function openDetailModal(lead: Lead) {
        setSelectedLead(lead)
        setIsDetailModalOpen(true)
    }

    async function handleConvert(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedLead) return
        setSubmitting(true)

        try {
            const { error: clientError } = await supabase.from('clients').insert({
                lead_id: selectedLead.id,
                city_id: selectedLead.city_id || cities[0]?.id,
                name: selectedLead.name,
                email: selectedLead.email,
                phone: selectedLead.phone,
                dog_breed: convertData.dog_breed,
                dog_age: convertData.dog_age,
                address: convertData.address,
                call_reason: convertData.call_reason,
                observations: convertData.observations,
                converted_by: convertData.converted_by,
                status: 'activo'
            })
            if (clientError) throw clientError

            const { error: leadError } = await supabase.from('leads').update({ status: 'evaluacion_aceptada' }).eq('id', selectedLead.id)
            if (leadError) throw leadError

            setIsConvertModalOpen(false)
            fetchLeads()
            alert('Lead convertido a cliente con éxito')
        } catch (error: any) {
            console.error('Error converting lead:', error)
            alert('Error al convertir lead: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    async function handleStatusChange(leadId: string, newStatus: Lead['status']) {
        try {
            const { error } = await supabase
                .from('leads')
                .update({ status: newStatus })
                .eq('id', leadId)

            if (error) throw error

            // Optimistic update
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
        } catch (error) {
            console.error('Error updating status:', error)
            alert('Error al actualizar estado')
            fetchLeads() // Revert on error
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        try {
            const { error } = await supabase.from('leads').insert({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                city_id: formData.city_id || null,
                comercial_id: profile?.id, // Auto-assign current user
                source: 'manual'
            })

            if (error) throw error

            setIsModalOpen(false)
            setFormData({ name: '', email: '', phone: '', city_id: '' })
            fetchLeads() // Refresh list
        } catch (error) {
            console.error('Error creating lead:', error)
            alert('Error al crear el lead')
        } finally {
            setSubmitting(false)
        }
    }

    function getStatusStyle(status: string) {
        if (status === 'nuevo') {
            return { backgroundColor: '#f3e8ff', color: '#6b21a8' } // Morado suave
        } else if (status.startsWith('intentando_contactar')) {
            return { backgroundColor: '#dbeafe', color: '#1e40af' } // Azul suave
        } else if (status.startsWith('tiene_que_hablarlo')) {
            return { backgroundColor: '#fef9c3', color: '#854d0e' } // Amarillo suave
        } else if (status.startsWith('evaluacion_denegada')) {
            return { backgroundColor: '#fee2e2', color: '#991b1b' } // Rojo suave
        } else if (status === 'perdido') {
            return { backgroundColor: '#f5f5f4', color: '#57534e' } // Marrón/Gris cálido suave
        }
        return { backgroundColor: '#f3f4f6', color: '#374151' } // Gris default (ej. evaluación aceptada)
    }

    if (loading) return <div>Cargando leads...</div>

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 600 }}>Leads</h1>
                <div>
                    <button
                        onClick={() => setIsCityModalOpen(true)}
                        style={{
                            backgroundColor: '#000',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500,
                            marginRight: '1rem'
                        }}>
                        + Nueva Ciudad
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        style={{
                            backgroundColor: '#000',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}>
                        + Nuevo Lead
                    </button>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Nombre</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Estado</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Ciudad</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Fecha</th>
                            <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay leads registrados</td>
                            </tr>
                        ) : (
                            leads.map((lead) => (
                                <tr key={lead.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                                        {lead.name}
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>{lead.phone || 'Sin teléfono'}</div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <select
                                            value={lead.status}
                                            onChange={(e) => handleStatusChange(lead.id, e.target.value as any)}
                                            style={{
                                                ...getStatusStyle(lead.status),
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                textTransform: 'capitalize',
                                                border: '1px solid transparent',
                                                cursor: 'pointer',
                                                maxWidth: '200px'
                                            }}
                                        >
                                            <option value="nuevo">Nuevo</option>
                                            <option value="intentando_contactar_lupe">Intentando Contactar Lupe</option>
                                            <option value="intentando_contactar_aroha">Intentando Contactar Aroha</option>
                                            <option value="intentando_contactar_pablo">Intentando Contactar Pablo</option>
                                            <option value="tiene_que_hablarlo_lupe">Tiene que hablarlo Lupe</option>
                                            <option value="tiene_que_hablarlo_aroha">Tiene que hablarlo Aroha</option>
                                            <option value="tiene_que_hablarlo_pablo">Tiene que hablarlo Pablo</option>
                                            <option value="tiene_que_hablarlo_pablo">Tiene que hablarlo Pablo</option>
                                            <option value="evaluacion_denegada_lupe">Evaluación Denegada Lupe</option>
                                            <option value="evaluacion_denegada_aroha">Evaluación Denegada Aroha</option>
                                            <option value="evaluacion_denegada_pablo">Evaluación Denegada Pablo</option>
                                            <option value="perdido">Perdido</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        {/* @ts-ignore */}
                                        {lead.cities?.name || '-'}
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', color: '#6b7280' }}>
                                        {new Date(lead.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <button
                                            onClick={() => openDetailModal(lead)}
                                            style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem' }}
                                        >
                                            Ver
                                        </button>
                                        <button
                                            onClick={() => openConvertModal(lead)}
                                            style={{ color: '#059669', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            Convertir
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Lead Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Lead">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Form fields same as before... re-pasting for context or separate if needed but this is a Replace so I need to be careful */}
                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Nombre Completo</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Teléfono</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Ciudad</label>
                        <select
                            value={formData.city_id}
                            onChange={e => setFormData({ ...formData, city_id: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                        >
                            <option value="">Selecciona una ciudad...</option>
                            {cities.map(city => (
                                <option key={city.id} value={city.id}>{city.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                            {submitting ? 'Guardando...' : 'Guardar Lead'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Convert to Client Modal */}
            <Modal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} title="Convertir a Cliente">
                <form onSubmit={handleConvert} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Estás convirtiendo a <strong>{selectedLead?.name}</strong> en cliente.
                        Por favor, añade los datos del perro.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>Raza</label>
                                <button
                                    type="button"
                                    onClick={() => setIsDogBreedModalOpen(true)}
                                    style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    + Nueva Raza
                                </button>
                            </div>
                            <select
                                required
                                value={convertData.dog_breed}
                                onChange={e => setConvertData({ ...convertData, dog_breed: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona una raza...</option>
                                {dogBreeds.map(breed => (
                                    <option key={breed.id} value={breed.name}>{breed.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Edad del Perro</label>
                            <select
                                value={convertData.dog_age}
                                onChange={e => setConvertData({ ...convertData, dog_age: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                            >
                                <option value="">Selecciona edad...</option>
                                <option value="Cachorro">Cachorro</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(age => (
                                    <option key={age} value={`${age} año${age > 1 ? 's' : ''}`}>{age} año{age > 1 ? 's' : ''}</option>
                                ))}
                                <option value="+12 años">+12 años</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Dirección</label>
                        <input
                            type="text"
                            value={convertData.address}
                            onChange={e => setConvertData({ ...convertData, address: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>Motivo Llamada</label>
                            <button
                                type="button"
                                onClick={() => setIsCallReasonModalOpen(true)}
                                style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                + Motivo
                            </button>
                        </div>
                        <select
                            value={convertData.call_reason}
                            onChange={e => setConvertData({ ...convertData, call_reason: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                        >
                            <option value="">Selecciona motivo...</option>
                            {callReasons.map(reason => (
                                <option key={reason.id} value={reason.name}>{reason.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Conversión realizada por...</label>
                        <select
                            required
                            value={convertData.converted_by}
                            onChange={e => setConvertData({ ...convertData, converted_by: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                        >
                            <option value="">Selecciona comercial...</option>
                            <option value="Lupe">Lupe</option>
                            <option value="Aroha">Aroha</option>
                            <option value="Pablo">Pablo</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Observaciones</label>
                        <textarea
                            value={convertData.observations}
                            onChange={e => setConvertData({ ...convertData, observations: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', minHeight: '100px', resize: 'vertical' }}
                            placeholder="Añade cualquier observación relevante para la ficha del cliente..."
                        />
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsConvertModalOpen(false)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#059669', color: 'white', cursor: submitting ? 'wait' : 'pointer' }}
                        >
                            {submitting ? 'Convirtiendo...' : 'Confirmar Conversión'}
                        </button>
                    </div>
                </form>
            </Modal>

            <LeadDetailModal
                lead={selectedLead}
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                onUpdate={fetchLeads}
            />

            <CityModal
                isOpen={isCityModalOpen}
                onClose={() => setIsCityModalOpen(false)}
                onSuccess={fetchCities}
            />

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
        </div >
    )
}
