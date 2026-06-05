import { supabase } from '../lib/supabase'
import { generateInvoicePDF } from './invoiceGenerator'

export interface RegisterPaymentClient {
    id: string
    name: string
    address?: string | null
    email?: string | null
    cities?: { name: string } | null
}

export interface RegisterPaymentInput {
    client: RegisterPaymentClient
    amount: number
    method: 'efectivo' | 'transferencia'
    notes?: string | null
    settings?: any
}

export interface RegisterPaymentResult {
    paymentId: string | null
    invoiceNumber: number | null
    pdfUrl: string | null
}

/**
 * Registra un pago de cliente: inserta el pago (el trigger de BD crea la factura),
 * espera la factura, genera el PDF, lo sube y actualiza la URL.
 * Lógica única compartida por la ficha de cliente y la sección "Pagos Clientes".
 */
export async function registerClientPayment({ client, amount, method, notes, settings }: RegisterPaymentInput): Promise<RegisterPaymentResult> {
    // 1. Siguiente número de pago del cliente
    const { data: existing } = await supabase
        .from('payments')
        .select('payment_number')
        .eq('client_id', client.id)
        .order('payment_number', { ascending: false })
        .limit(1)
    const nextNumber = existing && existing.length > 0 ? (existing[0].payment_number + 1) : 1

    // 2. Insertar pago (el trigger crea la factura)
    const { data: pData, error: pErr } = await supabase
        .from('payments')
        .insert({
            client_id: client.id,
            amount,
            payment_number: nextNumber,
            received: true,
            received_at: new Date().toISOString(),
            method,
            notes: notes || null
        })
        .select()
        .maybeSingle()
    if (pErr) throw pErr
    const paymentId = pData?.id ?? null

    // 3. Esperar a que el trigger genere la factura (hasta ~10s)
    let invoice: any = null
    for (let i = 0; i < 12; i++) {
        const query = paymentId
            ? supabase.from('invoices').select('*').eq('payment_id', paymentId).maybeSingle()
            : supabase.from('invoices').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        const { data: inv } = await query
        if (inv) { invoice = inv; break }
        await new Promise(r => setTimeout(r, 800))
    }

    // 4. Generar y subir el PDF (si falla, el pago queda igualmente registrado)
    let pdfUrl: string | null = null
    if (invoice) {
        try {
            const pdfBlob = await generateInvoicePDF({
                invoiceNumber: invoice.invoice_number,
                date: new Date(),
                clientName: client.name,
                clientAddress: client.address || '',
                clientCity: client.cities?.name || '',
                concept: 'Adiestramiento a Domicilio',
                amount,
                paymentMethod: method,
                settings
            })
            const fileName = `factura_${invoice.invoice_number}_${client.id}.pdf`
            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true })
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName)
                await supabase.from('invoices').update({ pdf_url: urlData.publicUrl }).eq('id', invoice.id)
                pdfUrl = urlData.publicUrl
            }
        } catch {
            // Generación de PDF fallida — el pago sigue registrado
        }
    }

    return { paymentId, invoiceNumber: invoice?.invoice_number ?? null, pdfUrl }
}
