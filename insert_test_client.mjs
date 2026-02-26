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

    if (authError) {
        console.error('Auth error:', authError.message)
        return
    }
    console.log('✅ Logged in as admin')

    // Get a city
    const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .eq('active', true)
        .limit(1)

    if (!cities?.length) {
        console.error('No cities found')
        return
    }
    const city = cities[0]
    console.log(`Using city: ${city.name}`)

    // Insert test client
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
            name: 'Carlos García (TEST)',
            phone: '612345678',
            email: 'carlos.test@ejemplo.com',
            city_id: city.id,
            dog_breed: 'Pastor Alemán',
            dog_age: '3 años',
            address: 'Calle Test 123',
            status: 'evaluado',
        })
        .select()
        .single()

    if (clientError) {
        console.error('Error creating client:', clientError)
        return
    }

    console.log('')
    console.log(`✅ Cliente creado: ${client.name}`)
    console.log(`   ID: ${client.id}`)
    console.log(`   Teléfono: ${client.phone}`)
    console.log(`   Perro: ${client.dog_breed}, ${client.dog_age}`)
    console.log(`   Ciudad: ${city.name}`)
    console.log('')
    console.log('🎉 ¡Entra como adiestrador y verás a "Carlos García (TEST)" en Llamadas Pendientes!')
}

main()
