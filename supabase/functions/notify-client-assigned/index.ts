import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_TEMPLATE = 'Buenas! te he subido un cliente para llamar cuando puedas 😉'

function formatPhone(raw: string): string {
    let phone = (raw || '').replace(/\D/g, '')
    if (phone.length === 9) phone = '34' + phone
    return phone
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json().catch(() => ({}))
        const clientId = body.clientId
        if (!clientId) throw new Error('clientId no proporcionado')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )

        // 1. Cliente y su adiestrador
        const { data: client, error: cErr } = await supabase
            .from('clients')
            .select('name, adiestrador_id')
            .eq('id', clientId)
            .single()
        if (cErr || !client) throw new Error('Cliente no encontrado')
        if (!client.adiestrador_id) {
            return new Response(JSON.stringify({ ok: true, sent: false, reason: 'Cliente sin adiestrador asignado' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        // 2. Teléfono del adiestrador
        const { data: trainer } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', client.adiestrador_id)
            .maybeSingle()
        if (!trainer || !trainer.phone) {
            return new Response(JSON.stringify({ ok: true, sent: false, reason: 'Adiestrador sin teléfono' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        // 3. Plantilla
        const { data: settings } = await supabase
            .from('crm_settings')
            .select('whatsapp_new_client_template')
            .maybeSingle()
        const template = settings?.whatsapp_new_client_template || DEFAULT_TEMPLATE
        const message = template.replace('[NOMBRE]', client.name || 'un cliente')

        // 4. Wazend
        const token = Deno.env.get('WAZEND_API_TOKEN')
        const instance = Deno.env.get('WAZEND_INSTANCE_NAME')
        const baseUrl = (Deno.env.get('WAZEND_BASE_URL') || 'https://api1.wazend.net').replace(/\/$/, '')
        if (!token || !instance) throw new Error('Faltan secretos de Wazend (TOKEN o INSTANCIA)')

        const phone = formatPhone(trainer.phone)
        const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apiKey': token },
            body: JSON.stringify({ number: phone, text: message })
        })
        const result = await response.json().catch(() => ({ raw: 'No legible' }))

        return new Response(JSON.stringify({ ok: response.ok, sent: response.ok, trainer: trainer.full_name, result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })
    } catch (err: any) {
        console.error('[notify-client-assigned] Fatal:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })
    }
})
