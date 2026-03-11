import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
    // Manejo de CORS (Preflight)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const { clientId, leadId } = body
        
        const apiToken = Deno.env.get('WAZEND_API_TOKEN')
        const instanceName = Deno.env.get('WAZEND_INSTANCE_NAME')
        const baseUrl = Deno.env.get('WAZEND_BASE_URL') || 'https://api1.wazend.net'

        if (!apiToken || !instanceName) {
            throw new Error('Faltan secretos en Supabase (WAZEND_API_TOKEN o WAZEND_INSTANCE_NAME)')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        let table = clientId ? 'clients' : 'leads'
        let id = clientId || leadId

        if (!id) throw new Error('No se proporcionó ID de cliente o lead')

        // 1. Obtener datos del cliente/lead y su asignado
        const { data: entity, error: entityError } = await supabaseClient
            .from(table)
            .select(`
                name, 
                phone, 
                assigned_id: ${clientId ? 'adiestrador_id' : 'comercial_id'},
                profiles: ${clientId ? 'adiestrador_id' : 'comercial_id'} (full_name)
            `)
            .eq('id', id)
            .single()

        if (entityError || !entity || !entity.phone) {
            throw new Error(`No se encontró el teléfono o datos del ${table}`)
        }

        const assignedName = (entity as any).profiles?.full_name || 'tu adiestrador'

        // 2. Obtener plantilla personalizada o por defecto
        const { data: settings } = await supabaseClient
            .from('crm_settings')
            .select('whatsapp_no_contesta_template')
            .single()

        const template = settings?.whatsapp_no_contesta_template || 
            'Hola [NOMBRE], soy [ADIESTRADOR] de la Escuela Canina. No hemos podido contactar contigo por teléfono.'
        
        let text = template.replace('[NOMBRE]', entity.name || 'cliente')
        text = text.replace('[ADIESTRADOR]', assignedName)

        // 3. Formatear teléfono
        let phone = entity.phone.replace(/\D/g, '')
        if (!phone.startsWith('34') && phone.length === 9) phone = '34' + phone

        console.log(`[WA-SEND] Intentando enviar a ${phone} a través de ${baseUrl} (Instancia: ${instanceName})`)

        // 4. Petición a Wazend
        const wazendUrl = `${baseUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`
        
        const response = await fetch(wazendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apiKey': apiToken
            },
            body: JSON.stringify({ 
                number: phone, 
                text: text,
                instance: instanceName // Añadimos por si acaso la versión lo requiere en el body
            })
        })

        // Capturar respuesta con timeout mental? No, fetch nativo.
        const resultText = await response.text()
        let result = {}
        try {
            result = JSON.parse(resultText)
        } catch (_) {
            result = { raw: resultText }
        }

        if (!response.ok) {
            console.error(`[WA-SEND] Wazend respondió con status ${response.status}:`, resultText)
            return new Response(JSON.stringify({ 
                error: `Wazend devolvió error (${response.status}): ${resultText.substring(0, 100)}` 
            }), {
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 5. Marcar como enviado y resetear flag si es lead
        const updatePayload: any = { last_whatsapp_sent_at: new Date().toISOString() }
        if (table === 'leads') {
            updatePayload.send_whatsapp = false
        }

        await supabaseClient.from(table).update(updatePayload).eq('id', id)

        return new Response(JSON.stringify({ success: true, result }), {
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('[WA-SEND] Fatal Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 200, // Siempre devolvemos 200 para capturar el error amigablemente en el front
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

