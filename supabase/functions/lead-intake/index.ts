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

// Convierte las respuestas del formulario (preguntas) en texto legible para `notes`.
// Acepta: un string ya formateado, un objeto { pregunta: respuesta },
// o un array de { question/name, answer/value/values }.
const formatAnswers = (raw: unknown): string => {
  if (!raw) return ''
  if (typeof raw === 'string') return raw.trim()

  const lines: string[] = []
  const pushLine = (q: unknown, a: unknown) => {
    const question = String(q ?? '').trim()
    const answer = Array.isArray(a) ? a.join(', ') : String(a ?? '').trim()
    if (!question && !answer) return
    lines.push(question ? `${question}: ${answer}` : answer)
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        pushLine(o.question ?? o.name ?? o.key, o.answer ?? o.value ?? o.values)
      } else {
        pushLine('', item)
      }
    }
  } else if (typeof raw === 'object') {
    for (const [q, a] of Object.entries(raw as Record<string, unknown>)) pushLine(q, a)
  }

  return lines.join('\n')
}

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
  const sourceOverride = String(payload.source ?? '').trim()

  // Respuestas a las preguntas del formulario: se pueden enviar como `notes`
  // (string) y/o `answers` (objeto o array pregunta/respuesta).
  const notesText = [formatAnswers(payload.notes), formatAnswers(payload.answers)]
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!name) return json(400, { error: 'Missing name' })
  if (!email && !phone) return json(400, { error: 'Missing email or phone' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let cityId: string | null = null
  let cityName: string | null = null

  if (citySlug) {
    // 1) Coincidencia exacta por slug (p.ej. la landing envía "madrid").
    const { data: exact, error: cityErr } = await supabase
      .from('cities')
      .select('id, name')
      .eq('slug', citySlug)
      .maybeSingle()

    if (cityErr) return json(500, { error: 'City lookup failed', detail: cityErr.message })

    if (exact) {
      cityId = exact.id
      cityName = exact.name
    } else {
      // 2) Coincidencia flexible: el texto puede ser el TÍTULO del formulario de Meta
      //    (p.ej. "Escuela Canina Madrid"). Buscamos la ciudad cuyo slug/nombre
      //    aparezca dentro del texto normalizado, prefiriendo la coincidencia más larga.
      const { data: cities } = await supabase.from('cities').select('id, name, slug')
      if (cities && cities.length) {
        const candidates = cities
          .filter((c) => {
            const s = normaliseSlug(String(c.slug ?? ''))
            const n = normaliseSlug(String(c.name ?? ''))
            return (s && citySlug.includes(s)) || (n && citySlug.includes(n))
          })
          .sort((a, b) => String(b.name ?? '').length - String(a.name ?? '').length)
        if (candidates[0]) {
          cityId = candidates[0].id
          cityName = candidates[0].name
        }
      }
    }
  }

  const sourceTag = sourceOverride || (cityId ? `landing:${citySlug}` : 'landing:general')
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
      notes: notesText || null,
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
