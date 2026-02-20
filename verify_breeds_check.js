
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gufbkrzpalsrizkqusyr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBreeds() {
    console.log('Checking dog_breeds table...')
    const { data, error } = await supabase
        .from('dog_breeds')
        .select('*')
        .limit(5)

    if (error) {
        console.error('Error querying dog_breeds:', error.message)
        if (error.code === '42P01') {
            console.error('CONCLUSION: The table "dog_breeds" does not exist. Migration was not run.')
        }
    } else {
        console.log('Success! Found breeds:', data)
        console.log(`Count: ${data.length}`)
    }
}

checkBreeds()
