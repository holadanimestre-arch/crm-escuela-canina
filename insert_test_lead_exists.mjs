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

    // 3. Create fresh lead with 'evaluacion_aceptada' which matches DB constraint
    const leadName = 'Prueba Final Badalona (Evaluación Aceptada)';
    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
            name: leadName,
            email: 'test_final@example.com',
            phone: '600000000',
            city_id: badalonaId,
            status: 'evaluacion_aceptada', // Matches DB
            source: 'manual'
        })
        .select()
        .single();

    if (leadError) {
        console.error('Error creating lead:', leadError.message);
        return;
    }

    console.log(`✅ Lead de prueba creado: ${leadData.name}`);
    console.log(`🚀 IMPORTANTE: Acabo de descubrir que el código del Dashboard busca un estado llamado "pendiente_llamada" que NO existe en la base de datos.`);
    console.log(`Voy a proceder a corregir el Dashboard para que use "evaluacion_aceptada".`);
}

main();
