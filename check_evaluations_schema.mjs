import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://gufbkrzpalsrizkqusyr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function main() {
    const { data, error } = await supabase.from('evaluations').select('*').limit(1)
    if (error) {
        console.error('Error:', error)
    } else {
        if (data.length > 0) {
            console.log('Columns in evaluations table:', Object.keys(data[0]))
        } else {
            console.log('No evaluations found')
        }
    }
}
main()
