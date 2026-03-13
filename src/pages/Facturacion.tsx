import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, Download, Calendar, Search } from 'lucide-react'
import { generateInvoicePDF } from '../utils/invoiceGenerator'
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

export function Facturacion() {
    const [clients, setClients] = useState<any[]>([])
    const [invoices, setInvoices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ totalReceived: 0, totalFiltered: 0 })
    const [processingPayment, setProcessingPayment] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [settings, setSettings] = useState<any>(null)
    const [emailModal, setEmailModal] = useState<{ clientEmail: string; clientName: string; invoiceNumber: number; amount: number; invoiceDate: string; pdfUrl: string } | null>(null)
    const [sendingEmail, setSendingEmail] = useState(false)

    // Filters
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)

        // Fetch clients with their payments
        const { data: clientsData } = await supabase
            .from('clients')
            .select(`
                id, name, email, address,
                cities(name),
                payments(payment_number, amount)
            `)
            .in('status', ['evaluado', 'activo', 'finalizado'])
            .order('name')

        // Fetch invoices
        const { data: invoicesData } = await supabase
            .from('invoices')
            .select(`
                *,
                clients(name)
            `)
            .order('invoice_number', { ascending: false })

        if (clientsData) {
            setClients(clientsData.map((c: any) => ({
                ...c,
                payments: c.payments || []
            })))
        }

        if (invoicesData) {
            setInvoices(invoicesData)
            const total = invoicesData.reduce((acc, curr) => acc + curr.amount, 0)
            setStats(prev => ({ ...prev, totalReceived: total }))
        }

        // Fetch CRM Settings
        const { data: settingsData } = await supabase
            .from('crm_settings')
            .select('*')
            .single()

        if (settingsData) setSettings(settingsData)

        setLoading(false)
    }

    // Memoized filtered invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const date = new Date(inv.invoice_date)
            return isWithinInterval(date, {
                start: new Date(startDate),
                end: new Date(endDate + 'T23:59:59')
            })
        })
    }, [invoices, startDate, endDate])

    // Update filtered stats
    useEffect(() => {
        const total = filteredInvoices.reduce((acc, curr) => acc + curr.amount, 0)
        setStats(prev => ({ ...prev, totalFiltered: total }))
    }, [filteredInvoices])

    const handleReceivePayment = async (client: any, paymentNumber: number) => {
        if (!confirm(`¿Registrar Pago ${paymentNumber} para ${client.name}? Esto generará una factura automáticamente.`)) return

        setProcessingPayment(`${client.id}-${paymentNumber}`)
        const amount = prompt("Introduce el importe pagado (€):", "0")
        if (!amount || isNaN(parseFloat(amount))) {
            setProcessingPayment(null)
            return
        }

        const numericAmount = parseFloat(amount)

        try {
            // 1. Insert Payment (Trigger will create Invoice record)
            const { data: pData, error: pError } = await supabase
                .from('payments')
                .insert({
                    client_id: client.id,
                    amount: numericAmount,
                    payment_number: paymentNumber,
                    received: true,
                    received_at: new Date().toISOString(),
                    method: 'transferencia'
                })
                .select()
                .single()

            if (pError) throw pError

            // 2. Wait for trigger and fetch invoice
            let invoice = null
            for (let i = 0; i < 5; i++) {
                const { data: invData } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('payment_id', pData.id)
                    .maybeSingle()

                if (invData) {
                    invoice = invData
                    break
                }
                await new Promise(r => setTimeout(r, 500))
            }

            let finalPdfUrl = ''

            if (invoice) {
                // 3. Generate PDF
                const pdfBlob = await generateInvoicePDF({
                    invoiceNumber: invoice.invoice_number,
                    date: new Date(),
                    clientName: client.name,
                    clientAddress: client.address || '',
                    clientCity: client.cities?.name || '',
                    concept: 'Adiestramiento a Domicilio',
                    amount: numericAmount,
                    paymentMethod: 'transferencia',
                    settings: settings
                })

                // 4. Upload PDF
                const fileName = `factura_${invoice.invoice_number}_${client.id}.pdf`
                const { error: uploadError } = await supabase.storage
                    .from('invoices')
                    .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true })

                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName)
                    finalPdfUrl = urlData.publicUrl
                    await supabase.from('invoices').update({ pdf_url: finalPdfUrl }).eq('id', invoice.id)
                }

                // 5. Fetch fresh client email and show modal
                const { data: freshClient } = await supabase
                    .from('clients')
                    .select('email')
                    .eq('id', client.id)
                    .single()

                const clientEmail = freshClient?.email || client.email

                if (clientEmail) {
                    setEmailModal({
                        clientEmail,
                        clientName: client.name,
                        invoiceNumber: invoice.invoice_number,
                        amount: numericAmount,
                        invoiceDate: invoice.invoice_date || new Date().toISOString(),
                        pdfUrl: finalPdfUrl
                    })
                } else {
                    alert('Pago registrado y factura generada. El cliente no tiene email registrado.')
                    fetchData()
                }
            } else {
                alert('Pago registrado correctamente.')
                fetchData()
            }

        } catch (error: any) {
            console.error('Error processing payment:', error)
            alert('Error al procesar el pago: ' + error.message)
        } finally {
            setProcessingPayment(null)
        }
    }

    const handleSendEmail = async () => {
        if (!emailModal) return
        setSendingEmail(true)
        try {
            const { error } = await supabase.functions.invoke('send-invoice-email', {
                body: emailModal
            })
            if (error) throw error
            alert(`Factura enviada correctamente a ${emailModal.clientEmail}`)
        } catch (err: any) {
            alert('Error al enviar el email: ' + (err.message || 'Error desconocido'))
        } finally {
            setSendingEmail(false)
            setEmailModal(null)
            fetchData()
        }
    }

    const handleDismissEmailModal = () => {
        setEmailModal(null)
        fetchData()
    }

    const handleViewInvoice = async (inv: any) => {
        // Open window immediately to avoid popup blocker
        const win = window.open('', '_blank')
        if (!win) {
            alert('Por favor, permite las ventanas emergentes para ver la factura.')
            return
        }
        win.document.write('Cargando factura...')

        try {
            // Reconstruct path if pdf_url is missing
            let path = ''
            if (inv.pdf_url) {
                path = inv.pdf_url.split('/').pop() || ''
            } else {
                path = `factura_${inv.invoice_number}_${inv.client_id}.pdf`
            }

            if (!path) {
                win.close()
                return
            }

            const { data, error } = await supabase.storage
                .from('invoices')
                .createSignedUrl(path, 60)

            if (error) {
                console.error('Error creating signed URL:', error)
                // Fallback to public URL guess if signed fails
                const { data: publicData } = supabase.storage.from('invoices').getPublicUrl(path)
                win.location.href = publicData.publicUrl
            } else if (data?.signedUrl) {
                win.location.href = data.signedUrl
            } else {
                win.close()
                alert('No se pudo generar el enlace de la factura.')
            }
        } catch (err) {
            console.error('Error viewing invoice:', err)
            win.close()
        }
    }

    const handleDownloadAll = async () => {
        if (filteredInvoices.length === 0) return
        setDownloading(true)

        try {
            for (let i = 0; i < filteredInvoices.length; i++) {
                const inv = filteredInvoices[i]
                let path = inv.pdf_url ? inv.pdf_url.split('/').pop() : `factura_${inv.invoice_number}_${inv.client_id}.pdf`

                if (!path) continue

                const { data } = await supabase.storage
                    .from('invoices')
                    .createSignedUrl(path, 60)

                if (data?.signedUrl) {
                    const link = document.createElement('a')
                    link.href = data.signedUrl
                    link.download = `Factura_${inv.invoice_number}.pdf`
                    link.target = '_blank'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)

                    await new Promise(r => setTimeout(r, 1000))
                }
            }
        } catch (err) {
            console.error('Error downloading batch:', err)
            alert('Error al descargar las facturas.')
        } finally {
            setDownloading(false)
        }
    }

    if (loading) return <div>Cargando facturación...</div>

    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Facturación y Pagos</h1>

            {/* Stats */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                    <div style={{ color: '#6b7280', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Facturado</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#111827' }}>{stats.totalReceived.toFixed(2)} €</div>
                </div>
                <div style={{ padding: '1.25rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                    <div style={{ color: '#0369a1', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Filtrado</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#0c4a6e' }}>{stats.totalFiltered.toFixed(2)} €</div>
                </div>
            </div>

            {/* Pending Payments */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Pagos Pendientes</h2>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: '#6b7280' }}>Cliente</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: '#6b7280' }}>Estado Pago 1</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: '#6b7280' }}>Estado Pago 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map(client => {
                                // Find all registered payment numbers
                                const registeredNumbers = client.payments.map((p: any) => p.payment_number)
                                const maxRegistered = registeredNumbers.length > 0 ? Math.max(...registeredNumbers) : 0

                                // We show P1, P2 and the "Next" one if it's needed
                                const nextToRegister = maxRegistered + 1

                                return (
                                    <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{client.name}</td>
                                        <td colSpan={2} style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {registeredNumbers.sort((a: number, b: number) => a - b).map((num: number) => (
                                                    <span key={num} style={{ color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.25rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                                        P{num} OK
                                                    </span>
                                                ))}
                                                <button
                                                    onClick={() => handleReceivePayment(client, nextToRegister)}
                                                    disabled={!!processingPayment}
                                                    style={{
                                                        padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #2563eb',
                                                        backgroundColor: 'white', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                                                    }}
                                                >
                                                    {processingPayment === `${client.id}-${nextToRegister}` ? '...' : `+ Registrar P${nextToRegister}`}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invoices History */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Historial de Facturas</h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f9fafb', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                            <Calendar size={16} color="#6b7280" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                            />
                            <span style={{ color: '#9ca3af' }}>-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                            />
                        </div>

                        <button
                            onClick={handleDownloadAll}
                            disabled={downloading || filteredInvoices.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: '#111827', color: 'white',
                                border: 'none', cursor: filteredInvoices.length > 0 ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 500,
                                opacity: (downloading || filteredInvoices.length === 0) ? 0.7 : 1
                            }}
                        >
                            <Download size={16} />
                            {downloading ? 'Descargando...' : 'Descargar Filtradas'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {filteredInvoices.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px dashed #d1d5db' }}>
                            <Search size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                            No hay facturas en este rango de fechas.
                        </div>
                    ) : (
                        filteredInvoices.map(inv => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', transition: 'all 0.2s', cursor: 'default', flexWrap: 'wrap', gap: '1rem' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1', minWidth: '200px' }}>
                                    <div style={{ width: '40px', height: '40px', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', flexShrink: 0 }}>
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>
                                            Factura #{String(inv.invoice_number).padStart(3, '0')} - {inv.clients?.name}
                                        </div>
                                        <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                                            {inv.invoice_date ? format(new Date(inv.invoice_date), 'dd/MM/yyyy') : '-'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', width: window.innerWidth < 640 ? '100%' : 'auto' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{inv.amount.toFixed(2)} €</div>
                                    <button
                                        onClick={() => handleViewInvoice(inv)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            border: 'none', background: 'none', cursor: 'pointer',
                                            color: '#2563eb', fontSize: '0.8rem', fontWeight: 600,
                                            padding: '0.5rem 0.75rem', borderRadius: '0.375rem', backgroundColor: '#eff6ff'
                                        }}
                                    >
                                        <Download size={16} /> Ver
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Email Invoice Modal */}

        {emailModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#111827', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FileText size={22} color="white" />
                        <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Factura generada</h2>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '1rem', lineHeight: 1.6 }}>
                            La <strong>Factura #{String(emailModal.invoiceNumber).padStart(3, '0')}</strong> de <strong>{emailModal.amount.toFixed(2)} €</strong> se ha generado correctamente para <strong>{emailModal.clientName}</strong>.
                        </p>
                        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '0.875rem 1rem', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.85rem', color: '#166534', margin: 0 }}>
                                ¿Quieres enviar la factura por email a:
                            </p>
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#14532d', margin: '0.25rem 0 0' }}>
                                {emailModal.clientEmail}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleDismissEmailModal}
                                style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
                            >
                                No, omitir
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={sendingEmail}
                                style={{ flex: 2, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', background: '#111827', color: 'white', cursor: sendingEmail ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                {sendingEmail ? 'Enviando...' : '📧 Sí, enviar factura'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}

