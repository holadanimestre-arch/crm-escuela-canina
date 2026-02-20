
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const cities = [
    { name: 'Madrid', active: true },
    { name: 'Barcelona', active: true },
    { name: 'Sevilla', active: true },
    { name: 'Valencia', active: true },
    { name: 'Málaga', active: true },
    { name: 'Zaragoza', active: true },
    { name: 'Bilbao', active: true },
    { name: 'Murcia', active: true },
    { name: 'Palma', active: true },
    { name: 'Las Palmas', active: true }
]

async function seed() {
    console.log('Seeding cities...')
    for (const city of cities) {
        const { error } = await supabase
            .from('cities')
            .upsert(city, { onConflict: 'name' })

        if (error) {
            console.error(`Error seeding ${city.name}:`, error.message)
        } else {
            console.log(`City ${city.name} synced.`)
        }
    }
    console.log('Seeding finished.')
}

seed()
