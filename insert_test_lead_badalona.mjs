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
    const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', '%Badalona%')
        .maybeSingle()

    if (cityError || !cityData) {
        console.error('Error finding Badalona:', cityError?.message || 'City not found');
        return;
    }

    const badalonaId = cityData.id;
    console.log(`📍 ID de Badalona encontrado: ${badalonaId}`);

    // 3. Insert Lead
    const leadName = 'Test Prueba Flujo ' + Math.floor(Math.random() * 1000);
    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
            name: leadName,
            email: 'prueba_flujo@example.com',
            phone: '600000000',
            city_id: badalonaId,
            status: 'nuevo',
            source: 'manual'
        })
        .select()
        .single();

    if (leadError) {
        console.error('Error creating lead:', leadError.message);
        return;
    }

    console.log(`✅ Lead de prueba creado: ${leadData.name}`);
    console.log(`🚀 Ahora puedes ir a la vista de adiestrador para procesar este lead.`);
}

main();
