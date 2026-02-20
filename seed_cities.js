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
    { name: 'Barcelona', active: true },
    { name: 'Zaragoza', active: true },
    { name: 'Sevilla', active: true },
    { name: 'Plasencia', active: true },
    { name: 'Cáceres', active: true },
    { name: 'Mérida', active: true },
    { name: 'Badajoz', active: true },
    { name: 'A Coruña', active: true },
    { name: 'Valencia', active: true },
    { name: 'Salamanca', active: true },
    { name: 'Navalmoral', active: true },
    { name: 'Talavera de la Reina', active: true },
    { name: 'Sevilla Laura', active: true },
    { name: 'Málaga', active: true },
    { name: 'Madrid', active: true },
    { name: 'Pamplona', active: true },
    { name: 'Murcia', active: true },
    { name: 'Palma de Mallorca', active: true },
    { name: 'Las Palmas', active: true },
    { name: 'Badalona', active: true },
    { name: 'Barcelona Judith', active: true },
    { name: 'Valencia Hector', active: true },
    { name: 'Madrid Gonzalo', active: true },
    { name: 'Granollers', active: true },
    { name: 'Donosti', active: true }
]

const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

async function seed() {
    console.log('Signing in as admin...')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD
    })

    if (authError) {
        console.error('Error signing in:', authError.message)
        process.exit(1)
    }

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
