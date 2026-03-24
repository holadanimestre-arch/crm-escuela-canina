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

    // 3. Find profile by email (to assign correctly)
    const trainerEmail = 'holadanimestre@gmail.com';
    // We try to find a profile with this email or simply use an admin check
    const { data: profileData } = await supabase.from('profiles').select('id, role').eq('email', trainerEmail).maybeSingle();

    let trainerId = null;
    if (profileData) {
        trainerId = profileData.id;
        console.log(`👤 ID del adiestrador encontrado: ${trainerId}`);
    } else {
        console.warn(`⚠️ No se encontró perfil para ${trainerEmail}. El lead se creará sin adiestrador_id, solo aparecerá si eres Admin con filtro Badalona.`);
    }

    // 4. Update the test lead created before or create a new one
    // Let's create a fresh one with proper status
    const leadName = 'Test Flujo Badalona (Pendiente Llamada)';
    const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
            name: leadName,
            email: 'test_badalona@example.com',
            phone: '600000000',
            city_id: badalonaId,
            status: 'pendiente_llamada', // THIS IS THE IMPORTANT CHANGE
            adiestrador_id: trainerId,   // Link it of possible
            source: 'manual'
        })
        .select()
        .single();

    if (leadError) {
        console.error('Error creating lead:', leadError.message);
        return;
    }

    console.log(`✅ Lead de prueba creado: ${leadData.name}`);
    console.log(`🚀 IMPORTANTE: Asegúrate de estar en la vista de "Llamadas Pendientes" dentro del panel de adiestrador.`);
    
    if (!trainerId) {
        console.log(`💡 Si no lo ves, comprueba que has seleccionado "Badalona" en el filtro superior.`);
    }
}

main();
