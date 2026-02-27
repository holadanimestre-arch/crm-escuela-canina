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

    // 1. Get the profile of this user to find their real ID
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Admin user ID:', user.id)

    // 2. Find trainer city assignments for THIS user (info@escuelacaninafranestevez.es)
    const { data: assignments } = await supabase
        .from('adiestrador_cities')
        .select('city_id, cities(name)')
        .eq('adiestrador_id', user.id)

    console.log('Trainer assignments for admin user:', JSON.stringify(assignments, null, 2))

    // 3. Clear ANY test client to avoid confusion
    await supabase.from('clients').delete().ilike('name', '%(TEST)%')

    // 4. If no assignments, use ALL active cities or just the first active one
    let targetCityId;
    if (assignments && assignments.length > 0) {
        targetCityId = assignments[0].city_id;
        console.log(`Using assigned city: ${assignments[0].cities?.name}`);
    } else {
        const { data: firstCity } = await supabase
            .from('cities')
            .select('id, name')
            .eq('active', true)
            .limit(1)
            .single()
        targetCityId = firstCity.id;
        console.log(`No specific assignment. Using first active city: ${firstCity.name}`);
    }

    const testClient = {
        name: 'Ana López (TEST)',
        phone: '600112233',
        email: 'ana.lopez.test@ejemplo.com',
        city_id: targetCityId,
        dog_breed: 'Golden Retriever',
        dog_age: '8 meses',
        address: 'Calle Marina 15, 2º2ª, Badalona',
        call_reason: 'Tira mucho de la correa y se pone nerviosa con otros perros',
        observations: 'Es muy sociable pero no tiene control. La dueña quiere clases los sábados.',
        status: 'evaluado',
        created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('clients')
        .insert(testClient)
        .select()

    if (error) {
        console.error('Error creating client:', error)
    } else {
        console.log(`✅ ¡Cliente de prueba "Ana López (TEST)" creado con éxito!`)
    }
}

main()
