import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://gufbkrzpalsrizkqusyr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function main() {
    // List all profiles to see what we have
    const { data: profiles, error: err1 } = await supabase.from('profiles').select('*')
    if (err1) { console.error('Error fetching profile:', err1); return; }

    console.log('Profiles:', profiles)

    // And also list cities just in case
    const { data: cities } = await supabase.from('cities').select('*')
    console.log('Cities:', cities)
}
main()
