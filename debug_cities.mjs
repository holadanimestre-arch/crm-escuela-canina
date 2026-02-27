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
    if (authError) { console.error('Auth error:', authError.message); return }

    // Update the existing test client to have call_reason and observations
    const { data, error } = await supabase
        .from('clients')
        .update({
            call_reason: 'Perro agresivo con otros perros en el parque',
            observations: 'El dueño tiene horario de mañanas libre. Prefiere zona de Badalona centro.',
            address: 'Calle Mayor 42, 3ºA, Badalona'
        })
        .eq('name', 'Carlos García (TEST)')
        .select()

    if (error) {
        console.error('Error:', error)
        return
    }
    console.log('✅ Cliente actualizado con motivo de llamada y observaciones:')
    console.log(`   Motivo: ${data?.[0]?.call_reason}`)
    console.log(`   Observaciones: ${data?.[0]?.observations}`)
    console.log(`   Dirección: ${data?.[0]?.address}`)
    console.log('')
    console.log('🎉 Recarga la página para ver los cambios!')
}

main()
