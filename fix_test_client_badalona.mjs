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
    console.log(`Using Badalona ID: ${badalona.id}`)

    // 2. Insert test client in Badalona
    const testClient = {
        name: 'Ana López (TEST)',
        phone: '600112233',
        email: 'ana.lopez.test@ejemplo.com',
        city_id: badalona.id,
        dog_breed: 'Golden Retriever',
        dog_age: '8 meses',
        address: 'Calle Marina 15, 2º2ª, Badalona',
        call_reason: 'Tira mucho de la correa y se pone nerviosa con otros perros',
        observations: 'Es muy sociable pero no tiene control. La dueña quiere clases los sábados.',
        status: 'evaluado',
        created_at: new Date().toISOString()
    }

    // Delete previous test clients
    await supabase.from('clients').delete().ilike('name', '%(TEST)%')

    const { data, error } = await supabase
        .from('clients')
        .insert(testClient)
        .select()

    if (error) {
        console.error('Error creating client:', error)
    } else {
        console.log(`✅ ¡Cliente "Ana López (TEST)" creado con éxito en Badalona!`)
    }
}

main()
