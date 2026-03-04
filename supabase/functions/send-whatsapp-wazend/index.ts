import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { clientId, leadId } = await req.json()
        const apiToken = Deno.env.get('WAZEND_API_TOKEN')
        const instanceName = Deno.env.get('WAZEND_INSTANCE_NAME')
        const baseUrl = Deno.env.get('WAZEND_BASE_URL') || 'https://api1.wazend.net'

        if (!apiToken || !instanceName) throw new Error('Faltan secretos en Supabase (TOKEN o INSTANCIA)')

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        let table = clientId ? 'clients' : 'leads'
        let id = clientId || leadId

        if (!id) throw new Error('No se proporcionó ID de cliente o lead')

        const { data: entity, error: entityError } = await supabaseClient.from(table).select('name, phone').eq('id', id).single()
        if (entityError || !entity || !entity.phone) throw new Error(`No se encontró el teléfono del ${table}`)

        const { data: settings } = await supabaseClient.from('crm_settings').select('whatsapp_no_contesta_template').single()
        const template = settings?.whatsapp_no_contesta_template || 'Hola [NOMBRE], no hemos podido contactar contigo por teléfono.'
        const text = template.replace('[NOMBRE]', entity.name)

        let phone = entity.phone.replace(/\D/g, '')
        if (!phone.startsWith('34') && phone.length === 9) phone = '34' + phone

        console.log(`[WA-SEND] Intentando enviar a ${phone} a través de ${baseUrl}`)

        const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apiKey': apiToken
            },
            body: JSON.stringify({ number: phone, text: text })
        })

        const result = await response.json()

        if (!response.ok) {
            return new Response(JSON.stringify({ error: `Wazend devolvió error: ${JSON.stringify(result)}` }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Marcar como enviado y resetear flag de envío automático
        const updatePayload: any = { last_whatsapp_sent_at: new Date().toISOString() }
        if (table === 'leads') {
            updatePayload.send_whatsapp = false
        }

        await supabaseClient.from(table).update(updatePayload).eq('id', id)

        return new Response(JSON.stringify({ success: true, result }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('[WA-SEND] Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
