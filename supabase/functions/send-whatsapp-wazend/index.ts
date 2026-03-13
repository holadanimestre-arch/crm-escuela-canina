import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json().catch(() => ({}))
        const id = body.leadId || body.clientId
        const table = body.leadId ? 'leads' : 'clients'

        if (!id) throw new Error('ID no proporcionado')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )

        // 1. Obtener datos
        const { data: item, error: itemError } = await supabase
            .from(table)
            .select('name, phone')
            .eq('id', id)
            .single()

        if (itemError || !item) throw new Error('Registro no encontrado en la base de datos')

        // 2. Obtener plantilla
        const { data: settings } = await supabase
            .from('crm_settings')
            .select('whatsapp_no_contesta_template')
            .maybeSingle()

        const template = settings?.whatsapp_no_contesta_template || 'Hola [NOMBRE], soy de la Escuela Canina. No hemos podido contactar contigo.'
        const message = template.replace('[NOMBRE]', item.name || 'cliente')

        // 3. Formatear teléfono
        let phone = (item.phone || '').replace(/\D/g, '')
        if (phone.length === 9) phone = '34' + phone

        // 4. Secretos y llamada
        const token = Deno.env.get('WAZEND_API_TOKEN')
        const instance = Deno.env.get('WAZEND_INSTANCE_NAME')
        const baseUrl = Deno.env.get('WAZEND_BASE_URL') || 'https://api1.wazend.net'

        if (!token || !instance) throw new Error('Faltan secretos de Wazend (TOKEN o INSTANCIA)')

        console.log(`[WA-SEND] Enviando a ${phone} via ${baseUrl}...`)

        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apiKey': token 
            },
            body: JSON.stringify({ 
                number: phone, 
                text: message 
            })
        })

        const result = await response.json().catch(() => ({ raw: 'No legible' }))

        if (response.ok) {
            await supabase.from(table).update({ 
                last_whatsapp_sent_at: new Date().toISOString(),
                send_whatsapp: false 
            }).eq('id', id)
            
            return new Response(JSON.stringify({ success: true, result }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        } else {
            return new Response(JSON.stringify({ error: 'Wazend rechazó el mensaje', details: result }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

    } catch (err: any) {
        console.error('[WA-SEND] Fatal:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})







