import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { EVALUATION_CATEGORIES, SCORE_LABELS } from './evaluationConfig'
import { ChevronLeft, CheckCircle } from 'lucide-react'

interface ScoreData {
    [category: string]: {
        [item: string]: {
            score: number | null
            observations: string
        }
    }
}

export function EvaluationForm() {
    const { clientId } = useParams<{ clientId: string }>()
    const navigate = useNavigate()
    const { profile } = useAuth()

    const [client, setClient] = useState<{ id: string; name: string; dog_breed: string | null; city_id: string } | null>(null)
    const [scores, setScores] = useState<ScoreData>({})
    const [comments, setComments] = useState('')
    const [saving, setSaving] = useState(false)
    const [activeCategory, setActiveCategory] = useState(EVALUATION_CATEGORIES[0].id)

    useEffect(() => {
        // Initialize scores structure
        const initialScores: ScoreData = {}
        EVALUATION_CATEGORIES.forEach(cat => {
            initialScores[cat.id] = {}
            cat.items.forEach(item => {
                initialScores[cat.id][item] = { score: null, observations: '' }
            })
        })
        setScores(initialScores)

        // Fetch client details
        async function fetchClient() {
            if (!clientId) return
            const { data } = await supabase
                .from('clients')
                .select('id, name, dog_breed, city_id')
                .eq('id', clientId)
                .single()
            if (data) setClient(data)
        }
        fetchClient()
    }, [clientId])

    const handleScoreChange = (category: string, item: string, score: number) => {
        setScores(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [item]: { ...prev[category][item], score }
            }
        }))
    }

    const handleObservationChange = (category: string, item: string, observations: string) => {
        setScores(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [item]: { ...prev[category][item], observations }
            }
        }))
    }

    const handleSubmit = async (result: 'aprobada' | 'rechazada') => {
        if (!client || !profile) return
        setSaving(true)

        try {
            // 1. Create the evaluation record
            const { data: evaluation, error: evalError } = await supabase
                .from('evaluations')
                .insert({
                    client_id: client.id,
                    city_id: client.city_id,
                    adiestrador_id: profile.id,
                    result,
                    comments
                })
                .select()
                .single()

            if (evalError) throw evalError

            // 2. Create evaluation_results entries
            const resultsToInsert: { evaluation_id: string; category: string; item: string; score: number | null; observations: string }[] = []

            Object.entries(scores).forEach(([category, items]) => {
                Object.entries(items).forEach(([item, data]) => {
                    resultsToInsert.push({
                        evaluation_id: evaluation.id,
                        category,
                        item,
                        score: data.score,
                        observations: data.observations
                    })
                })
            })

            const { error: resultsError } = await supabase
                .from('evaluation_results')
                .insert(resultsToInsert)

            if (resultsError) throw resultsError

            // 3. Update client status
            const clientUpdate: any = { evaluation_done_at: new Date().toISOString() }
            if (result === 'aprobada') {
                clientUpdate.status = 'activo'
            }

            await supabase
                .from('clients')
                .update(clientUpdate)
                .eq('id', client.id)

            // Navigate back
            navigate('/evaluaciones')
        } catch (error) {
            console.error('Error saving evaluation:', error)
            alert('Error al guardar la evaluación')
        } finally {
            setSaving(false)
        }
    }

    if (!client) return <div>Cargando cliente...</div>

    const currentCategory = EVALUATION_CATEGORIES.find(c => c.id === activeCategory)

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
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Nueva Evaluación</h1>
                <p style={{ color: '#6b7280' }}>
                    Cliente: <strong>{client.name}</strong> {client.dog_breed && `— ${client.dog_breed}`}
                </p>
            </div>

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                {EVALUATION_CATEGORIES.map(cat => (
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
                            fontSize: '0.875rem'
                        }}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Scoring Form */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>{currentCategory?.name}</h2>

                {currentCategory?.items.map(item => (
                    <div key={item} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f3f4f6' }}>
                        <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.75rem' }}>{item}</label>

                        {/* Score Buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {[1, 2, 3, 4, 5].map(score => (
                                <button
                                    key={score}
                                    onClick={() => handleScoreChange(activeCategory, item, score)}
                                    style={{
                                        width: '70px',
                                        padding: '0.5rem',
                                        borderRadius: '0.375rem',
                                        border: scores[activeCategory]?.[item]?.score === score ? '2px solid #000' : '1px solid #e5e7eb',
                                        backgroundColor: scores[activeCategory]?.[item]?.score === score ? '#f3f4f6' : 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: scores[activeCategory]?.[item]?.score === score ? 600 : 400
                                    }}
                                >
                                    {score} - {SCORE_LABELS[score]}
                                </button>
                            ))}
                        </div>

                        {/* Observations */}
                        <input
                            type="text"
                            placeholder="Observaciones..."
                            value={scores[activeCategory]?.[item]?.observations || ''}
                            onChange={(e) => handleObservationChange(activeCategory, item, e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', fontSize: '0.875rem' }}
                        />
                    </div>
                ))}
            </div>

            {/* General Comments */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Comentarios Generales</h2>
                <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Resumen de la evaluación, recomendaciones, etc."
                    rows={4}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb', fontSize: '0.875rem', resize: 'vertical' }}
                />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => handleSubmit('rechazada')}
                    disabled={saving}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #dc2626',
                        backgroundColor: 'white',
                        color: '#dc2626',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    Rechazar Evaluación
                </button>
                <button
                    onClick={() => handleSubmit('aprobada')}
                    disabled={saving}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <CheckCircle size={18} />
                    {saving ? 'Guardando...' : 'Aprobar Evaluación'}
                </button>
            </div>
        </div>
    )
}
