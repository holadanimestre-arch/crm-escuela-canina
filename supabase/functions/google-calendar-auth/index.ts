import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const { method } = req
    const url = new URL(req.url)

    // 1. Iniciar flujo OAuth (Redirigir a Google)
    if (method === 'GET' && !url.searchParams.has('code')) {
        const userId = url.searchParams.get('userId')
        if (!userId) return new Response('UserId missing', { status: 400 })

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')
        const scopes = ['https://www.googleapis.com/auth/calendar.events'].join(' ')

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri!)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `state=${userId}`

        return Response.redirect(authUrl)
    }

    // 2. Callback de Google (Procesar el código)
    if (method === 'GET' && url.searchParams.has('code')) {
        const code = url.searchParams.get('code')
        const userId = url.searchParams.get('state') // Recuperamos el userId del state

        if (!code || !userId) return new Response('Code or State missing', { status: 400 })

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
        const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')

        // Intercambiar código por tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri!,
                grant_type: 'authorization_code',
            }),
        })

        const tokens = await tokenResponse.json()
        if (tokens.error) {
            console.error('Error exchanging code:', tokens.error)
            return new Response(JSON.stringify(tokens), { status: 400 })
        }

        // Guardar tokens en la base de datos
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { error } = await supabaseClient
            .from('adiestrador_calendar_tokens')
            .upsert({
                user_id: userId,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: Date.now() + (tokens.expires_in * 1000),
                updated_at: new Date().toISOString(),
            })

        if (error) {
            console.error('Error saving tokens:', error)
            return new Response('Error saving tokens', { status: 500 })
        }

        // Redirigir de vuelta al CRM
        const appUrl = Deno.env.get('APP_URL') || ''
        return Response.redirect(`${appUrl}/agenda?linked=true`)
    }

    return new Response('Not found', { status: 404 })
})
