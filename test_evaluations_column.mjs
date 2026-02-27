import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gufbkrzpalsrizkqusyr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'

// For schema queries, sometimes we need the service role key or RPC, but we can try to trigger a cache refresh or check it.
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'info@escuelacaninafranestevez.es',
        password: 'Xk9mQp2wLs7nRv4j'
    })

    // Try selecting adiestrador_id directly to see if we get the same error
    const { error } = await supabase
        .from('evaluations')
        .select('adiestrador_id')
        .limit(1)

    if (error) {
        console.error('Error selecting adiestrador_id:', error)
    } else {
        console.log('adiestrador_id exists and query succeeded.')
    }
}
main()
