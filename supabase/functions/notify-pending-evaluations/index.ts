import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const DAYS = 2
const DEFAULT_TEMPLATE = 'Buenas! He visto que el cliente "[NOMBRE]" no tiene asignada la fecha de evaluación inicial todavía, ¿qué problema has tenido?'

function formatPhone(raw: string): string {
    let phone = (raw || '').replace(/\D/g, '')
    if (phone.length === 9) phone = '34' + phone
    return phone
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        // Protección: solo se ejecuta con el secreto compartido (lo manda el cron)
        const cronSecret = Deno.env.get('CRON_SECRET')
        if (cronSecret) {
            const provided = req.headers.get('x-cron-secret')
            if (provided !== cronSecret) {
                return new Response(JSON.stringify({ error: 'No autorizado' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
                })
            }
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )

        // 1. Clientes asignados hace >= 2 días, en estado 'evaluado', sin aviso previo
        const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
        const { data: candidates, error: cErr } = await supabase
            .from('clients')
            .select('id, name, adiestrador_id, created_at')
            .eq('status', 'evaluado')
            .not('adiestrador_id', 'is', null)
            .is('eval_reminder_sent_at', null)
            .lte('created_at', cutoff)
        if (cErr) throw cErr

        if (!candidates || candidates.length === 0) {
            return new Response(JSON.stringify({ ok: true, checked: 0, sent: 0, message: 'Sin candidatos' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        // 2. Quitar los que YA tienen una evaluación con fecha
        const clientIds = candidates.map(c => c.id)
        const { data: evals } = await supabase
            .from('evaluations')
            .select('client_id, scheduled_date')
            .in('client_id', clientIds)
            .not('scheduled_date', 'is', null)
        const withDate = new Set((evals || []).map(e => e.client_id))
        const pending = candidates.filter(c => !withDate.has(c.id))

        // 3. Teléfonos de los adiestradores implicados
        const trainerIds = [...new Set(pending.map(c => c.adiestrador_id))]
        const { data: trainers } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .in('id', trainerIds)
        const trainerById: Record<string, any> = {}
        for (const t of (trainers || [])) trainerById[t.id] = t

        // 4. Plantilla del mensaje
        const { data: settings } = await supabase
            .from('crm_settings')
            .select('whatsapp_eval_reminder_template')
            .maybeSingle()
        const template = settings?.whatsapp_eval_reminder_template || DEFAULT_TEMPLATE

        // 5. Secretos de Wazend
        const token = Deno.env.get('WAZEND_API_TOKEN')
        const instance = Deno.env.get('WAZEND_INSTANCE_NAME')
        const baseUrl = (Deno.env.get('WAZEND_BASE_URL') || 'https://api1.wazend.net').replace(/\/$/, '')
        if (!token || !instance) throw new Error('Faltan secretos de Wazend (TOKEN o INSTANCIA)')

        let sent = 0
        const results: any[] = []

        for (const client of pending) {
            const trainer = trainerById[client.adiestrador_id]
            if (!trainer || !trainer.phone) {
                results.push({ client: client.name, skipped: 'adiestrador sin teléfono' })
                continue
            }
            const phone = formatPhone(trainer.phone)
            const message = template.replace('[NOMBRE]', client.name || 'el cliente')

            try {
                const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apiKey': token },
                    body: JSON.stringify({ number: phone, text: message })
                })
                if (response.ok) {
                    await supabase.from('clients').update({ eval_reminder_sent_at: new Date().toISOString() }).eq('id', client.id)
                    sent++
                    results.push({ client: client.name, trainer: trainer.full_name, ok: true })
                } else {
                    const detail = await response.json().catch(() => ({}))
                    results.push({ client: client.name, ok: false, detail })
                }
            } catch (err: any) {
                results.push({ client: client.name, ok: false, error: err.message })
            }
        }

        return new Response(JSON.stringify({ ok: true, checked: pending.length, sent, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })
    } catch (err: any) {
        console.error('[notify-pending-evaluations] Fatal:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })
    }
})
