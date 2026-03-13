import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clientEmail, clientName, invoiceNumber, amount, invoiceDate, pdfUrl } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada')

    const formattedNumber = String(invoiceNumber).padStart(3, '0')
    const formattedAmount = parseFloat(amount).toFixed(2)
    const formattedDate = new Date(invoiceDate).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    })

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background-color: #111827; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Escuela Canina Fran Estévez</h1>
        </div>
        <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 8px;">Hola <strong>${clientName}</strong>,</p>
          <p style="color: #6b7280; margin-bottom: 24px;">
            Te adjuntamos la factura correspondiente a tu servicio de adiestramiento a domicilio.
          </p>

          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Número de factura</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">#${formattedNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Fecha</td>
                <td style="padding: 6px 0; text-align: right;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Concepto</td>
                <td style="padding: 6px 0; text-align: right;">Adiestramiento a domicilio</td>
              </tr>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 12px 0 6px; font-weight: 700; font-size: 16px;">Total</td>
                <td style="padding: 12px 0 6px; text-align: right; font-weight: 700; font-size: 18px; color: #111827;">${formattedAmount} €</td>
              </tr>
            </table>
          </div>

          ${pdfUrl ? `
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${pdfUrl}"
               style="display: inline-block; background-color: #111827; color: white; padding: 12px 28px;
                      border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
              📄 Ver / Descargar Factura
            </a>
          </div>
          ` : ''}

          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
            Si tienes alguna duda, contáctanos en
            <a href="mailto:info@escuelacaninafranestevez.es" style="color: #2563eb;">info@escuelacaninafranestevez.es</a>
          </p>
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Escuela Canina Fran Estévez <facturas@escuelacaninafranestevez.es>',
        to: [clientEmail],
        subject: `Factura #${formattedNumber} - Escuela Canina Fran Estévez`,
        html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Error enviando email con Resend')
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
