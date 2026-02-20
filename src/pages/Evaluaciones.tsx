import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ClipboardList, Plus, CheckCircle, XCircle } from 'lucide-react'
import { useFilters } from '../context/FilterContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClientForEvaluation {
    id: string
    name: string
    dog_breed: string | null
    status: string
    evaluation_done_at: string | null
    cities: { name: string } | null
}

interface EvaluationRecord {
    id: string
    result: 'aprobada' | 'rechazada'
    created_at: string
    comments: string | null
    clients: { name: string } | null
}

export function Evaluaciones() {
    const [pendingClients, setPendingClients] = useState<ClientForEvaluation[]>([])
    const [completedEvaluations, setCompletedEvaluations] = useState<EvaluationRecord[]>([])
    const [loading, setLoading] = useState(true)

    const { cityId } = useFilters()

    useEffect(() => {
        fetchData()
    }, [cityId])

    async function fetchData() {
        setLoading(true)

        // Fetch clients pending evaluation (status = 'evaluado' but no evaluation_done_at)
        let clientsQuery = supabase
            .from('clients')
            .select('id, name, dog_breed, status, evaluation_done_at, cities(name)')
            .is('evaluation_done_at', null)

        if (cityId !== 'all') {
            clientsQuery = clientsQuery.eq('city_id', cityId)
        }

        const { data: clients } = await clientsQuery
            .order('created_at', { ascending: false })

        if (clients) {
            const mappedClients = clients.map((c: any) => ({
                ...c,
                cities: Array.isArray(c.cities) ? c.cities[0] : c.cities
            }))
            setPendingClients(mappedClients as ClientForEvaluation[])
        }

        // Fetch completed evaluations
        let evalsQuery = supabase
            .from('evaluations')
            .select('id, result, created_at, comments, clients(name)')

        if (cityId !== 'all') {
            evalsQuery = evalsQuery.eq('city_id', cityId)
        }

        const { data: evals } = await evalsQuery
            .order('created_at', { ascending: false })
            .limit(20)

        if (evals) {
            const mappedEvals = evals.map((e: any) => ({
                ...e,
                clients: Array.isArray(e.clients) ? e.clients[0] : e.clients
            }))
            setCompletedEvaluations(mappedEvals as EvaluationRecord[])
        }

        setLoading(false)
    }

    if (loading) return <div>Cargando evaluaciones...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Evaluaciones</h1>
            </div>

            {/* Pending Evaluations */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ClipboardList size={20} />
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Pendientes de Evaluar ({pendingClients.length})</h2>
                </div>

                {pendingClients.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        No hay clientes pendientes de evaluación.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Cliente</th>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Raza</th>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Ciudad</th>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingClients.map(client => (
                                <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{client.name}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: '#6b7280' }}>{client.dog_breed || '-'}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: '#6b7280' }}>{client.cities?.name || '-'}</td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                        <Link
                                            to={`/evaluaciones/nueva/${client.id}`}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.5rem 1rem',
                                                backgroundColor: '#000',
                                                color: 'white',
                                                borderRadius: '0.375rem',
                                                textDecoration: 'none',
                                                fontSize: '0.875rem',
                                                fontWeight: 500
                                            }}
                                        >
                                            <Plus size={16} /> Evaluar
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Completed Evaluations */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Evaluaciones Completadas</h2>
                </div>

                {completedEvaluations.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        No hay evaluaciones completadas aún.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Cliente</th>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Fecha</th>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Resultado</th>
                                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Comentarios</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedEvaluations.map(ev => (
                                <tr key={ev.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{ev.clients?.name || 'Cliente'}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: '#6b7280' }}>
                                        {format(new Date(ev.created_at), 'dd MMM yyyy', { locale: es })}
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <Link to={`/evaluaciones/${ev.id}`} style={{ textDecoration: 'none' }}>
                                            {ev.result === 'aprobada' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a', fontWeight: 500 }}>
                                                    <CheckCircle size={16} /> Aprobada
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#dc2626', fontWeight: 500 }}>
                                                    <XCircle size={16} /> Rechazada
                                                </span>
                                            )}
                                        </Link>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', color: '#6b7280', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <Link to={`/evaluaciones/${ev.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                            {ev.comments || '-'}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
