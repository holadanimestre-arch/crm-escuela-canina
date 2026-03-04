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

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const s = data.settings || {}

    // 1. Header (Black)
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, pageWidth, 40, 'F')

    // Logo embedding (Top Left)
    try {
        // Draw white background for logo area to ensure visibility


        if (s.invoice_logo_url) {
            const format = s.invoice_logo_url.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(s.invoice_logo_url, format, 11, 9, 23, 23)
        } else {
            // Real Logo from public/logo.png (Hardcoded base64)
            const logoBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAYAAAA+s9J6AAAQAElEQVR4AezdC9BuU/0H8NU/E1E6iRyMIpc5kUuNS1NIlGuXQ+ggTLlHF0bRaNSgEFJyiZhpGEZyKYNCE2Gky4RIyq1S0SRMmu5N//NZWa99nvM+593P8+7neffzPr933u9el73Wb/3Wb6/v/q299uX5v5TSfwNhgxgDMzcGkHCh/eM/LBAWmCmLBAlnyvLRbljgOQsECZ8zRARhgZmyQJBwpiw//HajxZZaIEjY0gMTao2PBYKE43Oso6cttUCQsKUHJtQaHwsECcfnWEdPW2qBAZCwpT0NtcICLbVAkLClBybUGh8LBAnH51hHT1tqgSBhSw9MqDU+FggSjs+xHkBPQ2QTFggSNmHFkBEWmIYFgoTTMF5UDQs0YYEgYRNWDBlhgWlYIEg4DeNF1bBAExYYDRI20dOQERZoqQWChC09MKHW+FggSDg+xzp62lILBAlbemBCrfGxQJBwfI71aPR0DLUMEo7hQY8ut8sCQcJ2HY/QZgwtECQcw4MeXW6XBYKE7Toeoc0YWmBsSTiGxzq63FILBAlbemBCrfGxQJBwfI71RE+XWmqpBMsss0wO7ZAuYYnPmzcvHXXUUemss85KBx10UHrJS16iSKBhCwQJGzboKIn797//nUmYyCWUB/vss0+6+uqr08knn5wOO+ywdPrpp6f99ttvlLo3MroGCUfmUDWnKJIVaX//+9/TX/7ylyRPuMIKK6Srr7wynXPOOYknVO4///lP9oI77rii5Mih7QoHCdt+hAaoH+LxfpowBeXx7r777rTrrrtm0v3zn/9ML3zhC+1O4quttlqaO3duTsemOQsECZuzZWskIdSSlKnu5/1e//rX+p+uvvz6deuqpafXVV89VeT8EFMKLXvSi9IpXvCKtssoqeX9smrNAkLA5W7ZCUpVgyyxceCmQLy4EXpDCvN/Xv/719Pa3vz29+MUvlpWBgICAwpwZm4FYIEg4ELPOnFAE03qZZiIbyHP9Jy7cbrvt0l133ZW++MUvprXWWishmzJLginpr3/96yUViX19WCBI2IfRulRpRTaSgWkmsokXUBD5zj333HTppZemDTbYIJMPuZZEwuIJn3zyyfTUU08RE2jQAkHCBo3ZBlEIRw8rm3vssUe+z+c2wwUXXJA9n2u/Qw45JM2ZM2eCgMq75hNOBiSVz3MKA81aIEjYrD2HKs3Us6A0jHA///nP03333ZcuvPDC9JnPfCYdffTRaf/9908bb7zxxGqn8jycaauQ55TXCR4SCSFI2GmdZtJBwmbsODQpVdLxetJCns/9PYQTRywE6+bh7AeKC5UV74R98u6///50zTXXiAYatkCQsGGDDlocwoF23Fh33bfLLrvkp1vc35PfFHjBQuKTTjopPfHEE/kJm6bkj7CcRlUPEjZqzsEJ4/Gg2oJFkn333Td99rOfTbxftylltU4vcV7wb3/7W/aAl19+eSZgOQH0IifKLtkCQcIl26dVezsJYOHluOOOywR0zVa9z9eE4ghoFfW0005rQlzI6GKBIGEXw7QtGwHLzXa6bbHFFunMM8/M9/iky7RRvF+YflbreoD7gAMOyKuq8ukgLKjqU/Ii7N0CQcLebTZjNZAAXAuagq644oqL6GL6uEhGDwkEBB714YcfTocffnjae++9F5Ewd+7ctNlmmyXXoO3Zrv8AHTZsc10RtoSAAAAAElFTkSuQmCC';
            doc.addImage('data:image/png;base64,' + logoBase64, 'PNG', 11, 9, 23, 23)
        }

        // Business Name next to logo
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.text('ESCUELA CANINA FRAN ESTÉVEZ', 40, 22)

    } catch (e) {
        console.warn('Could not add logo to PDF:', e)
        // Fallback text if logo fails
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.text('ESCUELA CANINA', 40, 18)
        doc.setFontSize(10)
        doc.text('FRAN ESTÉVEZ', 40, 24)
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
