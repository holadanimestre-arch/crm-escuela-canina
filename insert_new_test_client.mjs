import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://gufbkrzpalsrizkqusyr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function main() {
    // Auth as admin
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'info@escuelacaninafranestevez.es',
        password: 'Xk9mQp2wLs7nRv4j'
    })
    if (authError) { console.error('Auth error:', authError.message); return }

    // 1. Get Badalona ID
    const { data: badalona } = await supabase
        .from('cities')
        .select('id, name')
        .ilike('name', '%Badalona%')
        .single()

    if (!badalona) {
        console.error('Badalona city not found')
        return
    }

    // 2. Clear old "(TEST)" clients and their evaluations to be safe
    const { data: oldClients } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', '%(TEST)%')

    if (oldClients && oldClients.length > 0) {
        const oldIds = oldClients.map(c => c.id)
        await supabase.from('sessions').delete().in('client_id', oldIds)
        await supabase.from('evaluations').delete().in('client_id', oldIds)
        await supabase.from('clients').delete().in('id', oldIds)
    }

    // 3. Insert new test client in Badalona
    const testClient = {
        name: 'Roberto Gómez (TEST)',
        phone: '655443322',
        email: 'roberto.gomez.test@ejemplo.com',
        city_id: badalona.id,
        dog_breed: 'Bulldog Francés',
        dog_age: '2 años',
        address: 'Avenida de la Riera 45, 1ºA, Badalona',
        call_reason: 'Tiene ansiedad por separación, muerde los muebles',
        observations: 'El cliente tiene un horario complicado de tardes. Mejor llamarle por las mañanas.',
        status: 'evaluado', // Inicial para llamadas pendientes
        created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('clients')
        .insert(testClient)
        .select()

    if (error) {
        console.error('Error creating client:', error)
    } else {
        console.log(`✅ ¡Nuevo cliente "${testClient.name}" creado con éxito en Llamadas Pendientes!`)
    }
}

main()
