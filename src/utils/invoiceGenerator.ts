import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import logo from '../assets/logo.png'

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

// Helper to ensure image is loaded before adding to PDF
const getImageData = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } else {
                reject(new Error('Could not get canvas context'));
            }
        };
        img.onerror = () => reject(new Error(`Could not load image at ${url}`));
        img.src = url;
    });
};

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
        const logoStatic = logo as string;
        const logoUrl = s.invoice_logo_url || logoStatic;

        // Try to get base64 data to ensure it's loaded
        const logoData = await getImageData(logoUrl);
        doc.addImage(logoData, 'PNG', 10, 5, 30, 30)

    } catch (e) {
        console.warn('Could not add logo to PDF:', e)
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
                `${subtotal.toFixed(2)} €`,
                '1',
                `${subtotal.toFixed(2)} €`,
                '21 %',
                `${total.toFixed(2)} €`
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
