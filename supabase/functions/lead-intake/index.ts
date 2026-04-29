import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const normaliseSlug = (raw: string) =>
  raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const expectedSecret = Deno.env.get('LEAD_INTAKE_SECRET')
  if (!expectedSecret) return json(500, { error: 'LEAD_INTAKE_SECRET not configured' })

  const providedSecret = req.headers.get('x-api-key')
  if (providedSecret !== expectedSecret) return json(401, { error: 'Unauthorized' })

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const name = String(payload.name ?? '').trim()
  const email = String(payload.email ?? '').trim().toLowerCase()
  const phone = String(payload.phone ?? '').trim()
  const citySlugRaw = String(payload.city_slug ?? '').trim()
  const citySlug = normaliseSlug(citySlugRaw)

  if (!name) return json(400, { error: 'Missing name' })
  if (!email && !phone) return json(400, { error: 'Missing email or phone' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let cityId: string | null = null
  let cityName: string | null = null

  if (citySlug) {
    const { data: city, error: cityErr } = await supabase
      .from('cities')
      .select('id, name')
      .eq('slug', citySlug)
      .maybeSingle()

    if (cityErr) return json(500, { error: 'City lookup failed', detail: cityErr.message })
    if (city) {
      cityId = city.id
      cityName = city.name
    }
  }

  const sourceTag = cityId ? `landing:${citySlug}` : 'landing:general'
  const externalSourceId = `${sourceTag}:${email || 'noemail'}:${phone || 'nophone'}`

  const { data: inserted, error: insertErr } = await supabase
    .from('leads')
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      city_id: cityId,
      status: 'nuevo',
      source: sourceTag,
      external_source_id: externalSourceId,
    })
    .select('id')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return json(200, { ok: true, deduped: true, message: 'Lead already exists for this email/phone' })
    }
    return json(500, { error: 'Insert failed', detail: insertErr.message })
  }

  return json(200, { ok: true, lead_id: inserted.id, city: cityName })
})
