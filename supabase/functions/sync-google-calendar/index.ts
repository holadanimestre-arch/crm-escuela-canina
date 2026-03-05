import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getValidAccessToken(supabase: any, userId: string) {
    const { data, error } = await supabase
        .from('adiestrador_calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error || !data) return null

    // Si el token ha expirado (o está a punto de hacerlo, margen 5 min), refrescarlo
    if (Date.now() > (data.expiry_date - 300000)) {
        console.log('Refrescando token para usuario:', userId)
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId!,
                client_secret: clientSecret!,
                refresh_token: data.refresh_token,
                grant_type: 'refresh_token',
            }),
        })

        const result = await response.json()
        if (result.error) {
            console.error('Error refreshing token:', result.error)
            return null
        }

        // Actualizar en BD
        await supabase
            .from('adiestrador_calendar_tokens')
            .update({
                access_token: result.access_token,
                expiry_date: Date.now() + (result.expires_in * 1000),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)

        return result.access_token
    }

    return data.access_token
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { action, type, id } = await req.json()
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Obtener datos de la sesión o evaluación
        const table = type === 'session' ? 'sessions' : 'evaluations'
        const { data: item, error: fetchError } = await supabaseClient
            .from(table)
            .select('*, clients(name, phone, dog_breed)')
            .eq('id', id)
            .single()

        if (fetchError || !item) throw new Response('Item not found', { status: 404 })

        // El adiestrador_id depende de la tabla
        const adiestradorId = type === 'session'
            ? (item.adiestrador_id || await supabaseClient.from('clients').select('adiestrador_id').eq('id', item.client_id).single().then(r => r.data?.adiestrador_id))
            : item.adiestrador_id

        if (!adiestradorId) return new Response('No trainer assigned', { status: 200 })

        // 2. Obtener token de Google
        const accessToken = await getValidAccessToken(supabaseClient, adiestradorId)
        if (!accessToken) return new Response('Google Calendar not linked', { status: 200 })

        // 3. Preparar datos para Google
        const event = {
            summary: type === 'session'
                ? `Sesión ${item.session_number}: ${item.clients.name}`
                : `EVALUACIÓN: ${item.clients.name}`,
            description: `Cliente: ${item.clients.name}\nTeléfono: ${item.clients.phone || 'N/A'}\nPerro: ${item.clients.dog_breed || 'N/A'}\nNotas: ${item.comments || ''}`,
            start: { dateTime: new Date(item.date || item.scheduled_date).toISOString() },
            end: {
                dateTime: new Date(new Date(item.date || item.scheduled_date).getTime() + 60 * 60 * 1000).toISOString()
            }, // 1 hora por defecto
        }

        let googleResponse
        if (action === 'delete' && item.google_event_id) {
            googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.google_event_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
        } else if (item.google_event_id) {
            // Update
            googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.google_event_id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            })
        } else {
            // Create
            googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            })
        }

        const googleData = await googleResponse.json()
        if (googleData.id && !item.google_event_id) {
            // Guardar el ID del evento de Google en nuestra BD
            await supabaseClient
                .from(table)
                .update({ google_event_id: googleData.id })
                .eq('id', id)
        }

        return new Response(JSON.stringify({ success: true, googleData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
