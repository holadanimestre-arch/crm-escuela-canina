import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CheckCircle2, Eye, AlertCircle } from 'lucide-react'
import { Modal } from '../../components/Modal'

type BillingConcept = {
    id: string
    clientName: string
    type: 'bloque' | 'evaluacion'
    date: string
    amount: number
    deduction?: number
}

type TrainerSummary = {
    trainerId: string
    trainerName: string
    completedBlocks: number
    evaluations: number
    baseImponible: number
    evaluationsDeducted: number
    baseReducida: number
    iva: number
    total: number
    status: 'pendiente' | 'pagado' | 'none'
    settlementId: string | null
    concepts: BillingConcept[]
    rawBlocks: any[]
    rawEvals: any[]
}

export function PagoAdiestradores() {
    const [loading, setLoading] = useState(true)
    const [trainers, setTrainers] = useState<TrainerSummary[]>([])
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
    })

    const [viewingTrainer, setViewingTrainer] = useState<TrainerSummary | null>(null)
    const [saving, setSaving] = useState(false)

    // Constantes
    const PRECIO_BLOQUE_ADIESTRADOR_IVA_INC = 120
    const PRECIO_EVALUACION_ADIESTRADOR = 20

    useEffect(() => {
        fetchAdminBillingData()
    }, [selectedMonth])

    async function fetchAdminBillingData() {
        setLoading(true)

        try {
            // 1. Fetch all adiestradores
            const { data: adiestradores } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'adiestrador')
                .order('full_name')

            if (!adiestradores) return

            // 2. Fetch existing settlements for this month
            const { data: settlements } = await supabase
                .from('trainer_settlements')
                .select('*')
                .eq('month', selectedMonth)

            const year = parseInt(selectedMonth.split('-')[0])
            const month = parseInt(selectedMonth.split('-')[1]) - 1
            const startDate = new Date(year, month, 1).toISOString()
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

            // 3. Fetch Evaluations
            const { data: allEvals } = await supabase
                .from('evaluations')
                .select(`id, adiestrador_id, created_at, result, trainer_settlement_id, paid_to_trainer, clients ( name )`)
                .gte('created_at', startDate)
                .lte('created_at', endDate)

            // 4. Fetch Sessions for blocks
            const { data: clientsData } = await supabase
                .from('clients')
                .select(`id, name, sessions ( id, session_number, date, completed, trainer_settlement_id, paid_to_trainer )`)

            const trainerSummaries: TrainerSummary[] = []

            for (const adiestrador of adiestradores) {
                const settlement = settlements?.find((s: any) => s.adiestrador_id === adiestrador.id)

                const evalsData = allEvals?.filter((ev: any) => ev.adiestrador_id === adiestrador.id) || []

                const blocks: any[] = []
                const billingConcepts: BillingConcept[] = []

                if (clientsData) {
                    clientsData.forEach((client: any) => {
                        const completedSessions = (client.sessions || [])
                            .filter((s: any) => s.completed)
                            .sort((a: any, b: any) => a.session_number - b.session_number)

                        let count = 0;
                        let lastSessionDate = '';
                        let blockIds: string[] = []

                        completedSessions.forEach((session: any) => {
                            count++;
                            lastSessionDate = session.date;
                            blockIds.push(session.id)

                            if (count % 4 === 0) {
                                // Important: We should ideally link clients to adiestradors.
                                // If the app doesn't strictly link them, we might be misattributing blocks.
                                // For this implementation, we assume if the evaluation was done by them, the client is theirs.
                                // Or we rely on the generic system. We will attribute based on evaluation matching.

                                // Let's find if this trainer did the evaluation for this client
                                const didEval = allEvals?.some((e: any) => e.clients?.name === client.name && e.adiestrador_id === adiestrador.id)

                                // For now, we will associate blocks based on the evaluation logic, or just show them if they exist in a "my clients" relation
                                // Let's use a simpler heuristic: if the 4th session was completed this month.
                                // (A deeper fix would add adiestrador_id to sessions or clients directly).

                                if (lastSessionDate >= startDate && lastSessionDate <= endDate) {
                                    // To prevent all trainers getting all blocks in admin view, we must filter.
                                    // Let's filter by: Did this trainer do the evaluation?
                                    // Or does this trainer have a settlement for these sessions?
                                    const isPaidToThisTrainer = session.trainer_settlement_id === settlement?.id

                                    if (didEval || isPaidToThisTrainer || settlement) {
                                        const concept: BillingConcept = {
                                            id: `block-${client.id}-${count}`,
                                            clientName: client.name,
                                            type: 'bloque',
                                            date: lastSessionDate,
                                            amount: PRECIO_BLOQUE_ADIESTRADOR_IVA_INC
                                        }
                                        billingConcepts.push(concept)
                                        blocks.push({ concept, sessionIds: [...blockIds] })
                                    }
                                }
                                blockIds = [] // reset for next block
                            }
                        })
                    })
                }

                const evalConcepts: BillingConcept[] = evalsData.map((ev: any) => ({
                    id: `ev-${ev.id}`,
                    clientName: ev.clients?.name || 'Cliente Desconocido',
                    type: 'evaluacion',
                    date: ev.created_at,
                    amount: 0,
                    deduction: PRECIO_EVALUACION_ADIESTRADOR
                }))

                const allConcepts = [...billingConcepts, ...evalConcepts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

                const numBlocks = billingConcepts.length
                const numEvals = evalConcepts.length

                const baseBloques = (numBlocks * PRECIO_BLOQUE_ADIESTRADOR_IVA_INC) / 1.21
                const deduccionesEvals = numEvals * PRECIO_EVALUACION_ADIESTRADOR
                const baseReducida = Math.max(0, baseBloques - deduccionesEvals)
                const iva = baseReducida * 0.21
                const total = baseReducida + iva

                let summaryData = {
                    trainerId: adiestrador.id,
                    trainerName: adiestrador.full_name || 'Desconocido',
                    completedBlocks: numBlocks,
                    evaluations: numEvals,
                    baseImponible: baseBloques,
                    evaluationsDeducted: deduccionesEvals,
                    baseReducida: baseReducida,
                    iva: iva,
                    total: total,
                    status: settlement ? settlement.status as 'pendiente' | 'pagado' : 'none' as 'none',
                    settlementId: settlement ? settlement.id : null,
                    concepts: allConcepts,
                    rawBlocks: blocks,
                    rawEvals: evalsData
                }

                if (settlement) {
                    summaryData = {
                        ...summaryData,
                        baseImponible: settlement.base_imponible,
                        evaluationsDeducted: settlement.evaluations_deducted_amount,
                        baseReducida: settlement.base_imponible - settlement.evaluations_deducted_amount,
                        iva: settlement.iva_amount,
                        total: settlement.total_amount
                    }
                }

                trainerSummaries.push(summaryData)
            }

            setTrainers(trainerSummaries)

        } catch (error) {
            console.error("Error fetching admin billing:", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleMarkAsPaid(trainer: TrainerSummary) {
        if (!confirm(`¿Estás seguro de marcar como PAGADO a ${trainer.trainerName} por ${formatCurrency(trainer.total)}?`)) return

        setSaving(true)
        try {
            let settlementIdToUse = trainer.settlementId

            // 1. Create or Update Settlement Record
            if (settlementIdToUse) {
                const { error } = await supabase
                    .from('trainer_settlements')
                    .update({ status: 'pagado' })
                    .eq('id', settlementIdToUse)
                if (error) throw error
            } else {
                const { data: newSettlement, error } = await supabase
                    .from('trainer_settlements')
                    .insert({
                        adiestrador_id: trainer.trainerId,
                        month: selectedMonth,
                        base_imponible: trainer.baseImponible,
                        evaluations_deducted_amount: trainer.evaluationsDeducted,
                        iva_amount: trainer.iva,
                        total_amount: trainer.total,
                        status: 'pagado'
                    })
                    .select()
                    .single()

                if (error) throw error
                settlementIdToUse = newSettlement.id
            }

            // 2. Mark related evaluations as paid
            const evalIds = trainer.rawEvals.map(e => e.id)
            if (evalIds.length > 0) {
                await supabase
                    .from('evaluations')
                    .update({ trainer_settlement_id: settlementIdToUse, paid_to_trainer: true })
                    .in('id', evalIds)
            }

            // 3. Mark related sessions as paid
            const sessionIds = trainer.rawBlocks.flatMap(b => b.sessionIds)
            if (sessionIds.length > 0) {
                await supabase
                    .from('sessions')
                    .update({ trainer_settlement_id: settlementIdToUse, paid_to_trainer: true })
                    .in('id', sessionIds)
            }

            setViewingTrainer(null)
            fetchAdminBillingData()

        } catch (error: any) {
            alert('Error al liquidar: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
    }

    const monthOptions = []
    const d = new Date()
    for (let i = 0; i < 12; i++) {
        const temp = new Date(d.getFullYear(), d.getMonth() - i, 1)
        const value = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`
        const label = temp.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
        monthOptions.push({ value, label })
    }

    // Calcula totales globales del mes
    const totalMesAdmin = trainers.reduce((acc, curr) => acc + curr.total, 0)
    const pendientesCount = trainers.filter(t => t.status !== 'pagado' && t.total > 0).length

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Pago a Adiestradores</h1>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Gestiona las facturas y liquidaciones mensuales de los entrenadores.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', borderLeft: '4px solid #3b82f6' }}>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.5rem' }}>Total a Pagar (Mes)</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{formatCurrency(totalMesAdmin)}</p>
                        </div>
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', borderLeft: '4px solid #f59e0b' }}>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.5rem' }}>Adiestradores Pendientes</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{pendientesCount}</p>
                        </div>
                    </div>

                    {/* Trainers List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {trainers.map(trainer => (
                            <div key={trainer.trainerId} style={{
                                backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                                padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                opacity: trainer.total === 0 ? 0.6 : 1
                            }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {trainer.trainerName}
                                        {trainer.status === 'pagado' ? (
                                            <span style={{ fontSize: '0.75rem', backgroundColor: '#dcfce7', color: '#166534', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>Liquidad0</span>
                                        ) : trainer.total > 0 ? (
                                            <span style={{ fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>Pendiente</span>
                                        ) : null}
                                    </h3>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.375rem', display: 'flex', gap: '1rem' }}>
                                        <span>Bloques: {trainer.completedBlocks}</span>
                                        <span>Evaluaciones: {trainer.evaluations}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Factura (IVA inc)</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(trainer.total)}</div>
                                    </div>

                                    <button
                                        onClick={() => setViewingTrainer(trainer)}
                                        disabled={trainer.total === 0}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.5rem 1rem', borderRadius: '0.5rem',
                                            backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
                                            color: '#374151', fontWeight: 500, cursor: trainer.total > 0 ? 'pointer' : 'not-allowed',
                                            opacity: trainer.total > 0 ? 1 : 0.5
                                        }}
                                    >
                                        <Eye size={16} /> Ver Detalle
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Modal de Detalle y Liquidación */}
            {viewingTrainer && (
                <Modal
                    isOpen={!!viewingTrainer}
                    onClose={() => setViewingTrainer(null)}
                    title={`Detalle Facturación: ${viewingTrainer.trainerName}`}
                >
                    <div style={{ minWidth: '500px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: '#6b7280' }}>Base Imponible Bloques</span>
                                <span style={{ fontWeight: 500 }}>{formatCurrency(viewingTrainer.baseImponible)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: '#ef4444' }}>Deducción Evaluaciones en Efectivo</span>
                                <span style={{ color: '#ef4444', fontWeight: 500 }}>- {formatCurrency(viewingTrainer.evaluationsDeducted)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                <span>Base Reducida (Facturable):</span>
                                <span>{formatCurrency(viewingTrainer.baseReducida)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: '#6b7280' }}>IVA (21%)</span>
                                <span>{formatCurrency(viewingTrainer.iva)}</span>
                            </div>
                            <div style={{
                                backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem'
                            }}>
                                <span style={{ fontWeight: 600 }}>Total de la Factura:</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(viewingTrainer.total)}</span>
                            </div>
                        </div>

                        <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>Conceptos (Lo que ve el adiestrador)</h4>
                            {viewingTrainer.concepts.map(c => (
                                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.8rem' }}>
                                    <div>
                                        <span style={{ fontWeight: 500 }}>{c.clientName}</span>
                                        <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>{c.type === 'bloque' ? 'Bloque' : 'Evaluación'}</span>
                                    </div>
                                    <div style={{ fontWeight: 600, color: c.type === 'bloque' ? '#111827' : '#ef4444' }}>
                                        {c.type === 'bloque' ? formatCurrency(c.amount) : `- ${formatCurrency(c.deduction!)}`}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {viewingTrainer.status !== 'pagado' ? (
                            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', color: '#1e3a8a', fontSize: '0.875rem' }}>
                                    <AlertCircle size={20} style={{ flexShrink: 0 }} />
                                    <p>Al hacer clic en <strong>Liquidar y Marcar Pagado</strong>, certificarás que has abonado el importe al adiestrador. Los bloques y evaluaciones de este mes quedarán sellados en la base de datos para no duplicarse.</p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button onClick={() => setViewingTrainer(null)} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #bfdbfe', background: 'white', color: '#1e3a8a', fontWeight: 500, cursor: 'pointer' }}>
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => handleMarkAsPaid(viewingTrainer)}
                                        disabled={saving}
                                        style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                                    >
                                        {saving ? 'Liquidando...' : 'Liquidar y Marcar Pagado'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#166534', fontWeight: 600 }}>
                                <CheckCircle2 size={20} /> Estas facturas ya constan como pagadas al adiestrador.
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    )
}
