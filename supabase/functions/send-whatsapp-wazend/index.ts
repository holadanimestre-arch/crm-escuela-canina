import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { clientId } = await req.json()

        // Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get Client Info
        const { data: client, error: clientError } = await supabaseClient
            .from('clients')
            .select('name, phone, adiestrador_id')
            .eq('id', clientId)
            .single()

        if (clientError || !client) {
            throw new Error('Client not found')
        }

        // 2. Get Template from settings
        const { data: settings } = await supabaseClient
            .from('crm_settings')
            .select('whatsapp_no_contesta_template')
            .single()

        const template = settings?.whatsapp_no_contesta_template || 'Hola [NOMBRE], soy de la Escuela Canina Fran Estévez. No hemos podido contactar contigo por teléfono.'

        // 3. Parse Message (Only name substitution)
        const message = template.replace('[NOMBRE]', client.name)

        // 4. Format Phone Number (Ensure +34 prefix)
        let rawPhone = client.phone.replace(/\D/g, '')
        // Si no empieza por 34 y tiene 9 dígitos (formato español), le añadimos el 34
        if (!rawPhone.startsWith('34') && rawPhone.length === 9) {
            rawPhone = '34' + rawPhone
        }
        const formattedPhone = rawPhone

        // 5. Wazend API Config
        const apiToken = Deno.env.get('WAZEND_API_TOKEN')
        const instanceName = Deno.env.get('WAZEND_INSTANCE_NAME')

        if (!apiToken || !instanceName) {
            throw new Error('Wazend configuration missing (API Token or Instance Name)')
        }

        // 6. Call Wazend
        const response = await fetch(`https://api2.wazend.net/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({
                number: formattedPhone,
                message: message
            })
        })

        const result = await response.json()

        if (!response.ok) {
            throw new Error(`Wazend API error: ${JSON.stringify(result)}`)
        }

        // 7. Update client log
        await supabaseClient
            .from('clients')
            .update({ last_whatsapp_sent_at: new Date().toISOString() })
            .eq('id', clientId)

        return new Response(
            JSON.stringify({ success: true, result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
