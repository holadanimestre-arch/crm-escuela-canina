import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

interface InvoiceData {
    invoiceNumber: string | number
    date: Date
    clientName: string
    clientAddress: string
    clientCity: string
    clientZip?: string
    concept: string
    amount: number
    paymentMethod?: string
    // Business Settings
    settings?: {
        business_name?: string
        business_cif?: string
        business_address?: string
        business_phone?: string
        business_email?: string
        business_iban?: string
        invoice_footer?: string
        invoice_logo_url?: string
    }
}

export const generateInvoicePDF = (data: InvoiceData): Blob => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const s = data.settings || {}

    // 1. Black Header
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, pageWidth, 40, 'F')

    // Logo embedding (Top Left)
    try {
        if (s.invoice_logo_url) {
            // Using a simple check to see if it's base64 or a URL
            const format = s.invoice_logo_url.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(s.invoice_logo_url, format, 10, 5, 25, 25)
        } else {
            // Real Logo from src/assets/logo.png
            const logoBase64 = 'data:image/png;base64,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'
            doc.addImage(logoBase64, 'PNG', 10, 5, 25, 25)
        }
    } catch (e) {
        console.warn('Could not add logo to PDF:', e)
        // Fallback text if logo fails
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.text('ESCUELA CANINA', 10, 18)
        doc.setFontSize(10)
        doc.text('FRAN ESTÉVEZ', 10, 24)
    }

    // White text in header (Centered)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont("helvetica", "bold")
    doc.text('FACTURA', pageWidth / 2, 25, { align: 'center' })

    // Header Info (Right)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text('613 33 30 01', pageWidth - 15, 15, { align: 'right' })
    doc.text('info@escuelacaninafranestevez.es', pageWidth - 15, 22, { align: 'right' })

    // 2. Client & Invoice Info (Body)
    doc.setTextColor(0, 0, 0)

    // Client Info (Left)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text('Cliente', 15, 55)
    doc.setFontSize(12)
    doc.text(data.clientName, 15, 62)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(data.clientAddress || '', 15, 68)
    doc.text(`${data.clientCity}${data.clientZip ? ` (${data.clientZip})` : ''}, España`, 15, 74)

    // Invoice Meta (Left, below client)
    doc.setFont("helvetica", "bold")
    doc.text(`FACTURA F26${String(data.invoiceNumber).padStart(3, '0')}`, 15, 90)
    doc.text(`Fecha ${format(data.date, 'dd/MM/yyyy')}`, 15, 96)

    // 3. Table Calculations
    const vatRate = 0.21
    const total = data.amount
    const subtotal = total / (1 + vatRate)
    const vatAmount = total - subtotal

    // 4. Table
    autoTable(doc, {
        startY: 110,
        head: [['CONCEPTO', 'PRECIO', 'UDS.', 'SUBTOTAL', 'IVA', 'TOTAL']],
        body: [
            [
                { content: data.concept, styles: { fontStyle: 'bold' } },
                `${subtotal.toFixed(2)}\u00A0€`,
                '1',
                `${subtotal.toFixed(2)}\u00A0€`,
                '21\u00A0%',
                `${total.toFixed(2)}\u00A0€`
            ]
        ],
        theme: 'plain',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            halign: 'center',
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center', cellWidth: 28 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 28 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', cellWidth: 28 }
        },
        styles: {
            fontSize: 8,
            cellPadding: 4,
            overflow: 'linebreak',
            minCellHeight: 10
        }
    })

    // 5. Totals Block
    const finalTableY = (doc as any).lastAutoTable.finalY || 110
    const finalY = finalTableY + 10
    const totalsX = pageWidth - 65

    doc.setFont("helvetica", "bold")
    doc.text('BASE IMPONIBLE', totalsX, finalY)
    doc.text(`${subtotal.toFixed(2)} €`, pageWidth - 15, finalY, { align: 'right' })

    doc.text('IVA 21%', totalsX, finalY + 8)
    doc.text(`${vatAmount.toFixed(2)} €`, pageWidth - 15, finalY + 8, { align: 'right' })

    doc.setFontSize(12)
    doc.text('TOTAL', totalsX, finalY + 18)
    doc.text(`${total.toFixed(2)} €`, pageWidth - 15, finalY + 18, { align: 'right' })

    // 6. Footer (Payment Method)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    let paymentText = 'Pago al contado'
    if (data.paymentMethod === 'transferencia') {
        paymentText = 'Pago por Transferencia Bancaria'
    } else if (data.paymentMethod === 'efectivo') {
        paymentText = 'Pago al contado'
    }
    doc.text(paymentText, 15, finalY + 50)

    if (s.business_iban) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.text(`IBAN: ${s.business_iban}`, 15, finalY + 57)
    }

    // 7. Footer Bar (Black)
    doc.setFillColor(0, 0, 0)
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")

    if (s.invoice_footer) {
        const splitFooter = doc.splitTextToSize(s.invoice_footer, pageWidth - 40)
        doc.text(splitFooter, pageWidth / 2, pageHeight - 12, { align: 'center' })
    } else {
        const footerLine1 = `${s.business_name || 'Escuela Canina Fran Estévez'} ${s.business_cif || ''} ${s.business_address || ''}`
        const footerLine2 = 'España'
        doc.text(footerLine1, pageWidth / 2, pageHeight - 12, { align: 'center' })
        doc.text(footerLine2, pageWidth / 2, pageHeight - 7, { align: 'center' })
    }

    return doc.output('blob')
}
