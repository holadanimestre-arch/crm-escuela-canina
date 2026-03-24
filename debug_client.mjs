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

    const adiestradorId = 'ef0ad7e5-9f36-43d5-96f5-d4470b7b0581' // holadanimestre@gmail.com

    console.log('=== CLIENTES ASIGNADOS ===')
    const { data: clients, error: cErr } = await supabase.from('clients')
        .select('*')
        .eq('adiestrador_id', adiestradorId)
    
    if (cErr) console.error(cErr)
    console.table(clients || [])

    console.log('=== CLIENTE PERDIDO "0f941b7b-cf06-4fbc-9adc-d394f0a1278e" DE CERCA ===')
    const { data: cli } = await supabase.from('clients').select('*').eq('id', '0f941b7b-cf06-4fbc-9adc-d394f0a1278e')
    console.log(cli)
}

main()
