import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { useDialog } from '../../context/DialogContext'
import { Modal } from '../../components/Modal'
import { registerClientPayment } from '../../utils/registerPayment'
import { Paperclip, FileText, Plus, Search, Wallet } from 'lucide-react'

const euro = (n: number) => `${(n || 0).toFixed(2)}€`
const localYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export function PagosClientes() {
    const navigate = useNavigate()
    const { showAlert } = useDialog()
    const { cityId, dateRange } = useFilters()

    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'movimientos' | 'saldos'>('movimientos')
    const [payments, setPayments] = useState<any[]>([])
    const [clients, setClients] = useState<any[]>([])
    const [settings, setSettings] = useState<any>(null)
    const sessionPrice = settings?.default_session_price || 0

    // Filtros movimientos
    const [estado, setEstado] = useState<'all' | 'cobrado' | 'pendiente'>('all')
    const [metodo, setMetodo] = useState<'all' | 'efectivo' | 'transferencia'>('all')
    const [search, setSearch] = useState('')

    // Alta de pago
    const [showRegister, setShowRegister] = useState(false)
    const [regSearch, setRegSearch] = useState('')
    const [regClientId, setRegClientId] = useState('')
    const [regAmount, setRegAmount] = useState('')
    const [regMethod, setRegMethod] = useState<'transferencia' | 'efectivo'>('transferencia')
    const [regNotes, setRegNotes] = useState('')
    const [regSaving, setRegSaving] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            let payQ = supabase
                .from('payments')
                .select('*, invoices(invoice_number, pdf_url), clients!inner(id, name, dog_name, city_id, status, cities(name))')
            if (cityId !== 'all') payQ = payQ.eq('clients.city_id', cityId)
            const { data: payData } = await payQ.order('received_at', { ascending: false })

            let cliQ = supabase
                .from('clients')
                .select('id, name, dog_name, status, address, email, city_id, cities(name), evaluations(total_sessions)')
            if (cityId !== 'all') cliQ = cliQ.eq('city_id', cityId)
            const { data: cliData } = await cliQ.order('name')

            const { data: setData } = await supabase.from('crm_settings').select('*').maybeSingle()

            setPayments(payData || [])
            setClients(cliData || [])
            setSettings(setData || null)
        } catch (err: any) {
            showAlert('Error al cargar los pagos: ' + (err.message || 'Error desconocido'))
        } finally {
            setLoading(false)
        }
    }, [cityId, showAlert])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Cálculos compartidos ──────────────────────────────────────────
    const paidByClient = useMemo(() => {
        const map: Record<string, number> = {}
        for (const p of payments) {
            if (p.received) map[p.client_id] = (map[p.client_id] || 0) + (p.amount || 0)
        }
        return map
    }, [payments])

    const lastPaymentByClient = useMemo(() => {
        const map: Record<string, string> = {}
        for (const p of payments) {
            const d = p.received_at || p.created_at
            if (p.received && d && (!map[p.client_id] || d > map[p.client_id])) map[p.client_id] = d
        }
        return map
    }, [payments])

    const contractedOf = useCallback((client: any): number | null => {
        const evs = Array.isArray(client.evaluations) ? client.evaluations : []
        const total = evs.map((e: any) => e?.total_sessions).find((t: any) => t != null)
        if (total == null || sessionPrice <= 0) return null
        return total * sessionPrice
    }, [sessionPrice])

    // ── Movimientos: rango de fechas + filtros ────────────────────────
    const fromStr = localYMD(dateRange.from)
    const toStr = localYMD(dateRange.to)

    const inRange = useCallback((p: any) => {
        const d = p.received_at || p.created_at
        if (!d) return false
        const ymd = localYMD(new Date(d))
        return ymd >= fromStr && ymd <= toStr
    }, [fromStr, toStr])

    const scopedPayments = useMemo(() => payments.filter(inRange), [payments, inRange])

    const filteredMovs = useMemo(() => {
        const q = search.trim().toLowerCase()
        return scopedPayments.filter(p => {
            if (estado === 'cobrado' && !p.received) return false
            if (estado === 'pendiente' && p.received) return false
            if (metodo !== 'all' && p.method !== metodo) return false
            if (q) {
                const name = (p.clients?.name || '').toLowerCase()
                const dog = (p.clients?.dog_name || '').toLowerCase()
                if (!name.includes(q) && !dog.includes(q)) return false
            }
            return true
        })
    }, [scopedPayments, estado, metodo, search])

    // ── Saldos por cliente ────────────────────────────────────────────
    const saldos = useMemo(() => {
        return clients
            .filter(c => c.status === 'activo' || c.status === 'finalizado')
            .map(c => {
                const contracted = contractedOf(c)
                const paid = paidByClient[c.id] || 0
                const pending = contracted != null ? contracted - paid : null
                return { client: c, contracted, paid, pending, last: lastPaymentByClient[c.id] || null }
            })
            .sort((a, b) => (b.pending ?? -1) - (a.pending ?? -1))
    }, [clients, contractedOf, paidByClient, lastPaymentByClient])

    // ── KPIs ──────────────────────────────────────────────────────────
    const kpiCobradoPeriodo = useMemo(() => scopedPayments.filter(p => p.received).reduce((s, p) => s + (p.amount || 0), 0), [scopedPayments])
    const kpiNumPagos = scopedPayments.length
    const kpiCobradoMes = useMemo(() => {
        const now = new Date()
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        return payments.filter(p => p.received && (p.received_at || p.created_at)?.startsWith(ym)).reduce((s, p) => s + (p.amount || 0), 0)
    }, [payments])
    const kpiPendiente = useMemo(() => saldos.reduce((s, r) => s + (r.pending && r.pending > 0 ? r.pending : 0), 0), [saldos])

    // ── Acciones ──────────────────────────────────────────────────────
    const viewReceipt = async (p: any) => {
        if (!p.receipt_path) return
        try {
            const { data, error } = await supabase.storage.from('justificantes').createSignedUrl(p.receipt_path, 60)
            if (error) throw error
            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
        } catch (err: any) {
            showAlert('No se pudo abrir el justificante: ' + (err.message || 'Error desconocido'))
        }
    }

    const regClient = clients.find(c => c.id === regClientId)
    const regClientMatches = useMemo(() => {
        const q = regSearch.trim().toLowerCase()
        if (!q) return clients.slice(0, 8)
        return clients.filter(c => (c.name || '').toLowerCase().includes(q) || (c.dog_name || '').toLowerCase().includes(q)).slice(0, 8)
    }, [clients, regSearch])

    const resetRegister = () => {
        setShowRegister(false); setRegSearch(''); setRegClientId(''); setRegAmount(''); setRegMethod('transferencia'); setRegNotes('')
    }

    const submitRegister = async () => {
        if (!regClient) { showAlert('Selecciona un cliente.'); return }
        const amount = parseFloat(regAmount)
        if (!amount || amount <= 0) { showAlert('Introduce un importe válido.'); return }
        setRegSaving(true)
        try {
            const res = await registerClientPayment({
                client: { id: regClient.id, name: regClient.name, address: regClient.address, email: regClient.email, cities: regClient.cities },
                amount,
                method: regMethod,
                notes: regNotes || null,
                settings
            })
            resetRegister()
            await fetchData()
            showAlert(res.invoiceNumber
                ? `Pago registrado. Factura #${res.invoiceNumber} generada.`
                : 'Pago registrado. La factura puede tardar unos segundos en generarse.')
        } catch (err: any) {
            showAlert('Error al registrar el pago: ' + (err.message || 'Error desconocido'))
        } finally {
            setRegSaving(false)
        }
    }

    if (loading) return <div>Cargando pagos...</div>

    const kpiCard = (label: string, value: string, color: string, bg: string, border: string) => (
        <div style={{ padding: '0.9rem 1.1rem', backgroundColor: bg, borderRadius: '0.75rem', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '0.7rem', color, textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color }}>{value}</div>
        </div>
    )

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: window.innerWidth < 640 ? '1.25rem' : '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Wallet size={22} /> Pagos Clientes
                </h1>
                <button
                    onClick={() => setShowRegister(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                >
                    <Plus size={16} /> Registrar pago
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {kpiCard('Cobrado (periodo)', euro(kpiCobradoPeriodo), '#166534', '#f0fdf4', '#bbf7d0')}
                {kpiCard('Cobrado este mes', euro(kpiCobradoMes), '#0369a1', '#f0f9ff', '#bae6fd')}
                {kpiCard('Nº pagos (periodo)', String(kpiNumPagos), '#374151', '#f9fafb', '#e5e7eb')}
                {kpiCard('Pendiente de cobro', euro(kpiPendiente), '#854d0e', '#fefce8', '#fde68a')}
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1.25rem', display: 'flex', gap: '1.5rem' }}>
                {([['movimientos', 'Movimientos'], ['saldos', 'Por cliente (saldos)']] as const).map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        style={{ padding: '0.75rem 0', background: 'none', border: 'none', borderBottom: tab === k ? '2px solid #000' : '2px solid transparent', fontWeight: tab === k ? 600 : 400, color: tab === k ? '#000' : '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'movimientos' ? (
                <>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                placeholder="Buscar cliente o perro..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem', width: '220px' }}
                            />
                        </div>
                        <select value={estado} onChange={e => setEstado(e.target.value as any)} style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem', backgroundColor: 'white' }}>
                            <option value="all">Todos los estados</option>
                            <option value="cobrado">Cobrados</option>
                            <option value="pendiente">Pendientes</option>
                        </select>
                        <select value={metodo} onChange={e => setMetodo(e.target.value as any)} style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem', backgroundColor: 'white' }}>
                            <option value="all">Todos los métodos</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="efectivo">Efectivo</option>
                        </select>
                    </div>

                    <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                    {['Fecha', 'Cliente', 'Importe', 'Método', 'Justificante', 'Factura', 'Estado'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMovs.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay pagos en este periodo.</td></tr>
                                ) : filteredMovs.map(p => (
                                    <tr
                                        key={p.id}
                                        className="clickable-row"
                                        style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                                        onClick={() => navigate(`/clientes/${p.client_id}`)}
                                    >
                                        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>{fmtDate(p.received_at || p.created_at)}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                                            {p.clients?.name}
                                            {p.clients?.dog_name && <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>🐕 {p.clients.dog_name}</div>}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{euro(p.amount)}</td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: p.method === 'transferencia' ? '#dbeafe' : '#f3e8ff', color: p.method === 'transferencia' ? '#1e40af' : '#6b21a8' }}>
                                                {p.method === 'transferencia' ? '🏦 Transf.' : p.method === 'efectivo' ? '💵 Efec.' : '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            {p.receipt_path ? (
                                                <button onClick={e => { e.stopPropagation(); viewReceipt(p) }} title="Ver justificante" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer' }}>
                                                    <Paperclip size={12} /> Ver
                                                </button>
                                            ) : <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            {p.invoices?.pdf_url ? (
                                                <a href={p.invoices.pdf_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'none' }}>
                                                    <FileText size={14} /> #{p.invoices.invoice_number}
                                                </a>
                                            ) : p.invoices?.invoice_number ? (
                                                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>#{p.invoices.invoice_number}</span>
                                            ) : <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: p.received ? '#dcfce7' : '#fef9c3', color: p.received ? '#166534' : '#854d0e' }}>
                                                {p.received ? '✅ Cobrado' : '⏳ Pendiente'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                {['Cliente', 'Contratado', 'Pagado', 'Pendiente', '% cobrado', 'Último pago'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {saldos.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No hay clientes activos o finalizados.</td></tr>
                            ) : saldos.map(({ client, contracted, paid, pending, last }) => {
                                const pct = contracted && contracted > 0 ? Math.min(100, Math.round((paid / contracted) * 100)) : null
                                const debt = pending != null && pending > 0
                                return (
                                    <tr key={client.id} className="clickable-row" style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', backgroundColor: debt ? '#fffbeb' : 'white' }} onClick={() => navigate(`/clientes/${client.id}`)}>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                                            {client.name}
                                            {client.dog_name && <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>🐕 {client.dog_name}</div>}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>{contracted != null ? euro(contracted) : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#166534' }}>{euro(paid)}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: debt ? '#b91c1c' : '#6b7280' }}>
                                            {pending != null ? euro(pending) : <span style={{ color: '#9ca3af', fontWeight: 400 }}>—</span>}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            {pct != null ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '80px', height: '7px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? '#16a34a' : '#3b82f6', borderRadius: '4px' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{pct}%</span>
                                                </div>
                                            ) : <span style={{ color: '#9ca3af' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmtDate(last)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal registrar pago */}
            <Modal isOpen={showRegister} onClose={resetRegister} title="Registrar pago">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Cliente</label>
                        {regClient ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f9fafb' }}>
                                <span style={{ fontWeight: 600 }}>{regClient.name}{regClient.dog_name ? ` · 🐕 ${regClient.dog_name}` : ''}</span>
                                <button onClick={() => { setRegClientId(''); setRegSearch('') }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Cambiar</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    placeholder="Buscar cliente por nombre o perro..."
                                    value={regSearch}
                                    onChange={e => setRegSearch(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                                />
                                <div style={{ marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {regClientMatches.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setRegClientId(c.id); setRegAmount('') }}
                                            style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #f3f4f6', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                                        >
                                            {c.name} {c.dog_name && <span style={{ color: '#6b7280' }}>· 🐕 {c.dog_name}</span>}
                                            <span style={{ float: 'right', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'capitalize' }}>{c.status}</span>
                                        </button>
                                    ))}
                                    {regClientMatches.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '0.5rem' }}>Sin resultados.</p>}
                                </div>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Importe (€)</label>
                            <input type="number" step="0.01" value={regAmount} onChange={e => setRegAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Método</label>
                            <select value={regMethod} onChange={e => setRegMethod(e.target.value as any)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: 'white' }}>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Notas (opcional)</label>
                        <input value={regNotes} onChange={e => setRegNotes(e.target.value)} placeholder="Ej: Pago sesiones 1-4" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <button onClick={resetRegister} disabled={regSaving} style={{ padding: '0.6rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={submitRegister} disabled={regSaving || !regClient} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.375rem', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: regSaving ? 'wait' : 'pointer', opacity: regSaving || !regClient ? 0.7 : 1 }}>
                            {regSaving ? 'Registrando...' : 'Registrar pago'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
