import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://gufbkrzpalsrizkqusyr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function main() {
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'info@escuelacaninafranestevez.es',
        password: 'Xk9mQp2wLs7nRv4j'
    })
    if (authError) { console.error('Auth error:', authError.message); return }

    console.log('=== 1. CITIES WITH "BADALONA" ===')
    const { data: cities } = await supabase.from('cities').select('*').ilike('name', '%badalona%')
    console.table(cities)

    console.log('\n=== 2. PROFILE OF holadanimestre@gmail.com ===')
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, role, assigned_city_id').eq('email', 'holadanimestre@gmail.com')
    console.table(profiles)

    const adiestradorCityId = profiles?.[0]?.assigned_city_id
    console.log(`\nAdiestrador assigned_city_id: ${adiestradorCityId}`)

    console.log('\n=== 3. ALL CLIENTS WITH STATUS "evaluado" ===')
    const { data: evalClients } = await supabase.from('clients').select('id, name, status, city_id, created_at').eq('status', 'evaluado').order('created_at', { ascending: false }).limit(10)
    console.table(evalClients)

    console.log('\n=== 4. RECENT CLIENTS (last 5, any status) ===')
    const { data: recentClients } = await supabase.from('clients').select('id, name, status, city_id, created_at').order('created_at', { ascending: false }).limit(5)
    console.table(recentClients)

    if (cities && cities.length > 0 && adiestradorCityId) {
        const badalonaIds = cities.map(c => c.id)
        console.log(`\nBadalona city IDs: ${badalonaIds.join(', ')}`)
        console.log(`Adiestrador assigned_city_id: ${adiestradorCityId}`)
        console.log(`Match: ${badalonaIds.includes(adiestradorCityId) ? '✅ YES' : '❌ NO'}`)

        console.log('\n=== 5. CLIENTS IN BADALONA (any status) ===')
        const { data: badClients } = await supabase.from('clients').select('id, name, status, city_id').in('city_id', badalonaIds)
        console.table(badClients)
    }
}

main()
