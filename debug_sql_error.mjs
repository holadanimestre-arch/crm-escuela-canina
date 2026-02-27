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

    const { data: badalona } = await supabase
        .from('cities')
        .select('id, name')
        .ilike('name', '%Badalona%')
        .single()

    // Run the count query and check for error
    const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .is('evaluation_done_at', null)
        .is('no_contesta_at', null)
        .eq('city_id', badalona.id)

    if (error) {
        console.error('ERROR in pending count query:', error.message)
        console.error('Error details:', error)
    } else {
        console.log('Pending count:', count)
    }
}

main()
