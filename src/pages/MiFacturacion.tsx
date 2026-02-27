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
        total: 0
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
            // 1. Check if there's an existing settlement for this month
            const { data: settlementData } = await supabase
                .from('trainer_settlements')
                .select('*')
                .eq('adiestrador_id', profile.id)
                .eq('month', selectedMonth)
                .single()

            if (settlementData) {
                setSettlementStatus(settlementData.status)
            }

            // 2. We need to fetch evaluations and sessions to calculate the current month
            // or display the settled month.

            // For now, let's calculate based on the dates of the events for the selected month.
            // In a fully robust system, if a settlement exists, we might want to just show the settled items.
            // But calculating on the fly works if we assume the status comes from the settlement.

            const year = parseInt(selectedMonth.split('-')[0])
            const month = parseInt(selectedMonth.split('-')[1]) - 1 // JS months are 0-indexed

            const startDate = new Date(year, month, 1).toISOString()
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

            // Fetch Evaluations for this month
            // They are billable as soon as they are completed (created_at basically, or scheduled_date)
            const { data: evalsData } = await supabase
                .from('evaluations')
                .select(`
                    id, 
                    created_at, 
                    result,
                    clients ( name )
                `)
                .eq('adiestrador_id', profile.id)
                .gte('created_at', startDate)
                .lte('created_at', endDate)

            // Fetch Sessions to find completed blocks
            // A block is completed when session 4, 8, 12, etc., is completed.
            // We need to look at sessions completed in this month.
            // Note: the logic here is simplified. We look for session_number % 4 === 0 that were completed this month.
            // In reality, we might want to check the date the 4th session was completed.
            // Since we only have 'date' (which is scheduled date) and 'completed' boolean, 
            // we will use the 'date' of the 4th session as the completion date of the block.

            const { data: clientsData } = await supabase
                .from('clients')
                .select(`
                    id, 
                    name,
                    sessions ( id, session_number, date, completed )
                `)

            // Process blocks
            const blocks: BillingConcept[] = []

            if (clientsData && profile.id) {
                // To properly assign blocks, we technically need to ensure the trainer did them.
                // Our schema doesn't link session -> trainer directly. 
                // But for 'mis clientes' (adiestrador role), we assume the trainer did them if they are the assigned trainer.
                // Or if they did the evaluation. Let's assume for now adiestradors only see their own stuff.
                // To be perfectly accurate, we need to filter clients by those belonging to this trainer.
                // Since there is no explicit 'trainer_id' on clients (unless auth handles it via RLS, which it doesn't strictly),
                // we will rely on the evaluations linking them, or just process all clients if RLS restricts it.
                // Assuming RLS restricts 'clients' to only those the adiestrador has access to.

                clientsData.forEach((client: any) => {
                    const completedSessions = (client.sessions || [])
                        .filter((s: any) => s.completed)
                        .sort((a: any, b: any) => a.session_number - b.session_number)

                    // Group by 4
                    let count = 0;
                    let lastSessionDate = '';

                    completedSessions.forEach((session: any) => {
                        count++;
                        lastSessionDate = session.date;

                        // Every 4 sessions is a block
                        if (count % 4 === 0) {
                            // Check if this 4th session falls in the selected month
                            if (lastSessionDate >= startDate && lastSessionDate <= endDate) {
                                blocks.push({
                                    id: `block-${client.id}-${count}`,
                                    clientName: client.name,
                                    type: 'bloque',
                                    date: lastSessionDate,
                                    amount: PRECIO_BLOQUE_ADIESTRADOR_IVA_INC
                                })
                            }
                        }
                    })
                })
            }

            // Process Evaluations
            const evalConcepts: BillingConcept[] = (evalsData || []).map((ev: any) => ({
                id: `ev-${ev.id}`,
                clientName: ev.clients?.name || 'Cliente Desconocido',
                type: 'evaluacion',
                date: ev.created_at,
                amount: 0, // No suma a la base imponible
                deduction: PRECIO_EVALUACION_ADIESTRADOR // Resta de la base
            }))

            const allConcepts = [...blocks, ...evalConcepts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            setConcepts(allConcepts)

            // CALCULAR MATES
            const numBlocks = blocks.length
            const numEvals = evalConcepts.length

            // Base Imponible de Bloques = (120 * numBlocks) / 1.21
            // Usamos 120 IVA INCL, calculamos base imponible y luego restamos.
            // O mejor:
            // 120 IVA Incluido = 99.17 Base + 20.83 IVA
            const baseBloques = (numBlocks * PRECIO_BLOQUE_ADIESTRADOR_IVA_INC) / 1.21

            // Deducciones en B
            const deduccionesEvals = numEvals * PRECIO_EVALUACION_ADIESTRADOR

            // Base final para calcular IVA
            const baseReducida = Math.max(0, baseBloques - deduccionesEvals)

            // IVA
            const iva = baseReducida * 0.21

            // Total = Base Reducida + IVA
            const total = baseReducida + iva

            setSummary({
                completedBlocks: numBlocks,
                evaluations: numEvals,
                baseImponible: baseBloques,
                evaluationsDeducted: deduccionesEvals,
                baseReducida: baseReducida,
                iva: iva,
                total: total
            })

            // If we fetched an existing settlement, we could optionally override these calculations
            // with `settlementData.total_amount` etc., ensuring historical accuracy even if prices change.
            if (settlementData) {
                setSummary({
                    completedBlocks: numBlocks, // these counts might still be dynamic
                    evaluations: numEvals,
                    baseImponible: settlementData.base_imponible,
                    evaluationsDeducted: settlementData.evaluations_deducted_amount,
                    baseReducida: settlementData.base_imponible - settlementData.evaluations_deducted_amount,
                    iva: settlementData.iva_amount,
                    total: settlementData.total_amount
                })
            }


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

                        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                            Esta es la cantidad total por la que debes emitir la factura a la escuela por tus servicios de este mes.
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
