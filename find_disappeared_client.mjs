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

    console.log('=== CLIENTES RECIENTES (últimos 5 creados) ===')
    const { data: clients } = await supabase.from('clients').select(`
        id, name, status, city_id, adiestrador_id, email
    `).order('created_at', { ascending: false }).limit(5)
    
    console.table(clients)

    console.log('\n=== SESIONES RECIENTES ===')
    const { data: sessions } = await supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(5)
    console.table(sessions)

    console.log('\n=== EVALUACIONES RECIENTES ===')
    const { data: evals } = await supabase.from('evaluations').select('*').order('created_at', { ascending: false }).limit(5)
    console.table(evals)
}

main()
