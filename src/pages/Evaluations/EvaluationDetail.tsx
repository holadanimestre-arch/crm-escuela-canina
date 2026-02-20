import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EVALUATION_CATEGORIES, SCORE_LABELS } from './evaluationConfig'
import { ChevronLeft, CheckCircle, XCircle, User, Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface EvaluationData {
    id: string
    result: 'aprobada' | 'rechazada'
    comments: string | null
    created_at: string
    clients: {
        id: string
        name: string
        dog_breed: string | null
        phone: string | null
    } | null
    cities: {
        name: string
    } | null
    profiles: {
        full_name: string | null
    } | null
}

interface EvaluationResultItem {
    id: string
    category: string
    item: string
    score: number | null
    observations: string | null
}

export function EvaluationDetail() {
    const { evaluationId } = useParams<{ evaluationId: string }>()
    const navigate = useNavigate()

    const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
    const [results, setResults] = useState<EvaluationResultItem[]>([])
    const [loading, setLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState(EVALUATION_CATEGORIES[0].id)

    useEffect(() => {
        async function fetchEvaluation() {
            if (!evaluationId) return

            // Fetch evaluation with related data
            const { data: evalData } = await supabase
                .from('evaluations')
                .select(`
                    id, result, comments, created_at,
                    clients(id, name, dog_breed, phone),
                    cities(name),
                    profiles:adiestrador_id(full_name)
                `)
                .eq('id', evaluationId)
                .single()

            if (evalData) {
                // Transform the data to match EvaluationData interface (handling arrays from Supabase relations)
                const transformedData: EvaluationData = {
                    ...evalData,
                    clients: Array.isArray(evalData.clients) ? evalData.clients[0] : evalData.clients,
                    cities: Array.isArray(evalData.cities) ? evalData.cities[0] : evalData.cities,
                    profiles: Array.isArray(evalData.profiles) ? evalData.profiles[0] : evalData.profiles,
                } as unknown as EvaluationData
                setEvaluation(transformedData)
            }

            // Fetch evaluation results
            const { data: resultsData } = await supabase
                .from('evaluation_results')
                .select('id, category, item, score, observations')
                .eq('evaluation_id', evaluationId)

            if (resultsData) setResults(resultsData)

            setLoading(false)
        }

        fetchEvaluation()
    }, [evaluationId])

    if (loading) return <div>Cargando evaluación...</div>
    if (!evaluation) return <div>Evaluación no encontrada</div>

    const currentCategory = EVALUATION_CATEGORIES.find(c => c.id === activeCategory)
    const categoryResults = results.filter(r => r.category === activeCategory)

    // Calculate average score per category
    const getCategoryAverage = (categoryId: string) => {
        const catResults = results.filter(r => r.category === categoryId && r.score !== null)
        if (catResults.length === 0) return null
        const sum = catResults.reduce((acc, r) => acc + (r.score || 0), 0)
        return (sum / catResults.length).toFixed(1)
    }

    return (
        <div style={{ maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', marginBottom: '1rem' }}
                >
                    <ChevronLeft size={20} /> Volver
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            Evaluación de {evaluation.clients?.name}
                        </h1>
                        <div style={{ display: 'flex', gap: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Calendar size={14} />
                                {format(new Date(evaluation.created_at), 'dd MMM yyyy', { locale: es })}
                            </span>
                            {evaluation.cities && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <MapPin size={14} />
                                    {evaluation.cities.name}
                                </span>
                            )}
                            {evaluation.profiles?.full_name && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <User size={14} />
                                    {evaluation.profiles.full_name}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '9999px',
                        backgroundColor: evaluation.result === 'aprobada' ? '#dcfce7' : '#fee2e2',
                        color: evaluation.result === 'aprobada' ? '#16a34a' : '#dc2626',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        {evaluation.result === 'aprobada' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        {evaluation.result === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                    </div>
                </div>
            </div>

            {/* Category Tabs with Averages */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                {EVALUATION_CATEGORIES.map(cat => {
                    const avg = getCategoryAverage(cat.id)
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '0.375rem',
                                border: 'none',
                                background: activeCategory === cat.id ? '#000' : 'transparent',
                                color: activeCategory === cat.id ? '#fff' : '#6b7280',
                                fontWeight: 500,
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {cat.name}
                            {avg && (
                                <span style={{
                                    backgroundColor: activeCategory === cat.id ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem'
                                }}>
                                    {avg}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Results Grid */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>{currentCategory?.name}</h2>

                {currentCategory?.items.map(item => {
                    const result = categoryResults.find(r => r.item === item)
                    return (
                        <div key={item} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ fontWeight: 500 }}>{item}</label>
                                {result?.score ? (
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '9999px',
                                        backgroundColor: result.score >= 4 ? '#dcfce7' : result.score >= 3 ? '#fef9c3' : '#fee2e2',
                                        color: result.score >= 4 ? '#16a34a' : result.score >= 3 ? '#ca8a04' : '#dc2626',
                                        fontWeight: 600,
                                        fontSize: '0.875rem'
                                    }}>
                                        {result.score} - {SCORE_LABELS[result.score]}
                                    </span>
                                ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Sin puntuar</span>
                                )}
                            </div>
                            {result?.observations && (
                                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                    💬 {result.observations}
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* General Comments */}
            {evaluation.comments && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Comentarios Generales</h2>
                    <p style={{ color: '#374151', lineHeight: 1.6 }}>{evaluation.comments}</p>
                </div>
            )}

            {/* Link to Client */}
            {evaluation.clients && (
                <div style={{ textAlign: 'center' }}>
                    <Link
                        to={`/clientes/${evaluation.clients.id}`}
                        style={{
                            color: '#000',
                            textDecoration: 'underline',
                            fontSize: '0.875rem'
                        }}
                    >
                        Ver ficha del cliente →
                    </Link>
                </div>
            )}
        </div>
    )
}
