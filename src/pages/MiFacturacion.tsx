import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FileText, Calendar as CalendarIcon, DollarSign, CheckCircle2, Clock } from 'lucide-react'

type BillingConcept = {
    id: string
    clientName: string
    type: 'bloque' | 'evaluacion'
    date: string
    amount: number // The amount that goes to the base (120 for block, 0 to display but actually 20 to deduct for eval)
    deduction?: number // 20 for evaluation
}

export function MiFacturacion() {
    const { profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
    })

    // Data State
    const [concepts, setConcepts] = useState<BillingConcept[]>([])
    const [summary, setSummary] = useState({
        completedBlocks: 0,
        evaluations: 0,
        baseImponible: 0,
        evaluationsDeducted: 0,
        baseReducida: 0,
        iva: 0,
        total: 0,
        pendingSessions: [] as { clientName: string, count: number }[]
    })
    const [settlementStatus, setSettlementStatus] = useState<'pending' | 'pagado' | 'none'>('none')

    // Contantes financieras
    const PRECIO_BLOQUE_ADIESTRADOR_IVA_INC = 120 // 50% de 240
    const PRECIO_EVALUACION_ADIESTRADOR = 20 // 50% de 40

    useEffect(() => {
        if (profile?.id) {
            fetchBillingData()
        }
    }, [selectedMonth, profile?.id])

    async function fetchBillingData() {
        if (!profile?.id) return
        setLoading(true)
        setSettlementStatus('none')

        try {
            // 1. Check for settlement
            const { data: settlementData } = await supabase
                .from('trainer_settlements')
                .select('*')
                .eq('adiestrador_id', profile.id)
                .eq('month', selectedMonth)
                .single()

            if (settlementData) {
                setSettlementStatus(settlementData.status)
            }

            // 2. Fetch Evaluations
            const { data: evalsData } = await supabase
                .from('evaluations')
                .select(`id, created_at, result, clients ( name )`)
                .eq('adiestrador_id', profile.id)

            const monthEvals = (evalsData || []).filter(e => e.created_at.substring(0, 7) === selectedMonth)

            // 3. Fetch Clients and Sessions
            const { data: clientsData, error: clientError } = await supabase
                .from('clients')
                .select(`
                    id, 
                    name,
                    sessions ( id, session_number, date, completed ),
                    evaluations ( adiestrador_id, result )
                `)

            if (clientError) throw clientError

            const myClients = (clientsData || []).filter((c: any) => {
                const evalArr = Array.isArray(c.evaluations) ? c.evaluations : [c.evaluations].filter(Boolean)
                return evalArr.some((e: any) => e.adiestrador_id === profile.id && e.result === 'aprobada')
            })

            const blocks: BillingConcept[] = []
            const pendingSessions: { clientName: string, count: number }[] = []

            myClients.forEach((client: any) => {
                const completed = (client.sessions || [])
                    .filter((s: any) => s.completed)
                    .sort((a: any, b: any) => a.session_number - b.session_number)

                let count = 0
                completed.forEach((session: any) => {
                    count++
                    if (count % 4 === 0) {
                        const blockMonth = session.date.substring(0, 7)
                        if (blockMonth === selectedMonth) {
                            blocks.push({
                                id: `block-${client.id}-${count}`,
                                clientName: client.name,
                                type: 'bloque',
                                date: session.date,
                                amount: PRECIO_BLOQUE_ADIESTRADOR_IVA_INC
                            })
                        }
                    }
                })

                if (completed.length % 4 > 0) {
                    pendingSessions.push({
                        clientName: client.name,
                        count: completed.length % 4
                    })
                }
            })

            const evalConcepts: BillingConcept[] = monthEvals.map((ev: any) => ({
                id: `ev-${ev.id}`,
                clientName: ev.clients?.name || 'Cliente Desconocido',
                type: 'evaluacion',
                date: ev.created_at,
                amount: 0,
                deduction: PRECIO_EVALUACION_ADIESTRADOR
            }))

            const allConcepts = [...blocks, ...evalConcepts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setConcepts(allConcepts)

            const numBlocks = blocks.length
            const numEvals = evalConcepts.length
            const baseBloques = (numBlocks * PRECIO_BLOQUE_ADIESTRADOR_IVA_INC) / 1.21
            const deduccionesEvals = numEvals * PRECIO_EVALUACION_ADIESTRADOR
            const baseReducida = Math.max(0, baseBloques - deduccionesEvals)
            const iva = baseReducida * 0.21
            const total = baseReducida + iva

            const summaryData = {
                completedBlocks: numBlocks,
                evaluations: numEvals,
                baseImponible: settlementData?.base_imponible || baseBloques,
                evaluationsDeducted: settlementData?.evaluations_deducted_amount || deduccionesEvals,
                baseReducida: settlementData ? (settlementData.base_imponible - settlementData.evaluations_deducted_amount) : baseReducida,
                iva: settlementData?.iva_amount || iva,
                total: settlementData?.total_amount || total,
                pendingSessions
            }
            setSummary(summaryData)

        } catch (error) {
            console.error("Error fetching billing:", error)
        } finally {
            setLoading(false)
        }
    }


    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
    }

    // Generar opciones de meses (últimos 12 meses)
    const monthOptions = []
    const d = new Date()
    for (let i = 0; i < 12; i++) {
        const temp = new Date(d.getFullYear(), d.getMonth() - i, 1)
        const value = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`
        const label = temp.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
        monthOptions.push({ value, label })
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header section */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Mi Facturación</h1>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Resumen mensual para facturar a la escuela.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {settlementStatus !== 'none' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                            padding: '0.5rem 0.75rem', borderRadius: '9999px',
                            backgroundColor: settlementStatus === 'pagado' ? '#dcfce7' : '#fef3c7',
                            color: settlementStatus === 'pagado' ? '#166534' : '#92400e',
                            fontSize: '0.875rem', fontWeight: 600
                        }}>
                            {settlementStatus === 'pagado' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                            {settlementStatus === 'pagado' ? 'Liquidado por Admin' : 'Pendiente de Liquidar'}
                        </div>
                    )}

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
                            backgroundColor: 'white', fontWeight: 500, color: '#374151'
                        }}
                    >
                        {monthOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando datos...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '1.5rem', alignItems: 'start' }}>

                    {/* Left Column: List of items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Conceptos Facturables del Mes</h2>

                        {concepts.length === 0 ? (
                            <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                <FileText size={40} color="#d1d5db" style={{ margin: '0 auto 1rem' }} />
                                <p style={{ color: '#6b7280', fontWeight: 500 }}>No hay conceptos para facturar en este mes.</p>
                            </div>
                        ) : (
                            concepts.map(concept => (
                                <div key={concept.id} style={{
                                    backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                                    padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '0.5rem',
                                            backgroundColor: concept.type === 'bloque' ? '#eff6ff' : '#fdf2f8',
                                            color: concept.type === 'bloque' ? '#2563eb' : '#db2777',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {concept.type === 'bloque' ? <CalendarIcon size={20} /> : <FileText size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{concept.clientName}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <span style={{
                                                    textTransform: 'capitalize',
                                                    fontWeight: 500,
                                                    color: concept.type === 'bloque' ? '#2563eb' : '#db2777'
                                                }}>
                                                    {concept.type === 'bloque' ? 'Bloque de Sesiones (4)' : 'Evaluación (Cobro Efectivo)'}
                                                </span>
                                                • {new Date(concept.date).toLocaleDateString('es-ES')}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                        {concept.type === 'bloque' ? (
                                            <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{formatCurrency(concept.amount)} <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>IVA inc.</span></div>
                                        ) : (
                                            <div style={{ fontWeight: 600, color: '#dc2626' }}>- {formatCurrency(concept.deduction!)}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Right Column: Matematicas y Totales */}
                    <div style={{
                        backgroundColor: '#111827', color: 'white', borderRadius: '1rem',
                        padding: '1.5rem', position: 'sticky', top: '80px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={20} /> Resumen Liquidación
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid #374151', paddingBottom: '1rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
                                <span>Bloques (x{summary.completedBlocks})</span>
                                <span style={{ color: 'white' }}>{formatCurrency(summary.completedBlocks * PRECIO_BLOQUE_ADIESTRADOR_IVA_INC)} (IVA inc)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: '#9ca3af' }}>Base Imponible Bloques</span>
                                <span>{formatCurrency(summary.baseImponible)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: '#ef4444' }}>Evaluaciones a Deducir (x{summary.evaluations})</span>
                                <span style={{ color: '#ef4444' }}>- {formatCurrency(summary.evaluationsDeducted)}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
                                <span>Base de Facturación:</span>
                                <span>{formatCurrency(summary.baseReducida)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
                                <span>IVA (21%)</span>
                                <span>{formatCurrency(summary.iva)}</span>
                            </div>
                        </div>

                        <div style={{
                            backgroundColor: '#1f2937', padding: '1.25rem', borderRadius: '0.75rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ fontWeight: 600 }}>Total Factura:</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(summary.total)}</span>
                        </div>

                        {summary.pendingSessions.length > 0 && (
                            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #374151' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                                    Sesiones en progreso (No facturables)
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {summary.pendingSessions.map((ps, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ color: '#d1d5db' }}>{ps.clientName}</span>
                                            <span style={{ color: '#6b7280' }}>{ps.count} ses.</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                            Esta es la cantidad total por la que debes emitir la factura a la escuela por tus servicios de este mes.
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
