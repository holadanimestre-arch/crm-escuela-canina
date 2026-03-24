import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://gufbkrzpalsrizkqusyr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function main() {
    // 1. Auth as Admin
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'info@escuelacaninafranestevez.es',
        password: 'Xk9mQp2wLs7nRv4j'
    })
    if (authError) { console.error('Auth error:', authError.message); return }

    // 2. Get Badalona City ID
    const { data: cityData } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', '%Badalona%')
        .maybeSingle()

    if (!cityData) {
        console.error('Error finding Badalona');
        return;
    }

    const badalonaId = cityData.id;

    // 3. Insert Client with status 'evaluado'
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
            name: 'Cliente Prueba Flujo Badalona',
            email: 'cliente_test@example.com',
            phone: '611223344',
            city_id: badalonaId,
            status: 'evaluado', // This matches the new Dashboard filter
            dog_breed: 'Golden Retriever',
            observations: 'Necesita mejorar el paseo con correa.'
        })
        .select()
        .single();

    if (clientError) {
        console.error('Error creating client:', clientError.message);
        return;
    }

    console.log(`✅ CLIENTE de prueba creado: ${clientData.name}`);
    console.log(`🚀 Ahora SÍ debería aparecer en "Llamadas Pendientes" porque los adiestradores tienen permiso sobre la tabla clients.`);
}

main();
