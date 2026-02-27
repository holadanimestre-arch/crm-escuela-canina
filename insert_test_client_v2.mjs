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

    const { data: cityData } = await supabase
        .from('cities')
        .select('id, name')
        .ilike('name', '%Badalona%')
        .single()

    if (!cityData) {
        console.error('City Badalona not found')
        return
    }

    // Try excluding no_contesta_at to see if it's just a cache issue
    const testClient = {
        name: 'Ana López (TEST)',
        phone: '600112233',
        email: 'ana.lopez.test@ejemplo.com',
        city_id: cityData.id,
        dog_breed: 'Golden Retriever',
        dog_age: '8 meses',
        address: 'Calle Marina 15, 2º2ª, Badalona',
        call_reason: 'Tira mucho de la correa y se pone nerviosa con otros perros',
        observations: 'Es muy sociable pero no tiene control. La dueña quiere clases los sábados.',
        status: 'evaluado'
    }

    const { data, error } = await supabase
        .from('clients')
        .insert(testClient)
        .select()

    if (error) {
        console.error('Error creating client:', error)
        return
    }

    console.log(`✅ ¡Cliente de prueba creado!`)
}

main()
