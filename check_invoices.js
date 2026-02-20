import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function check() {
  const { data, error } = await supabase.from('invoices').select('invoice_number, pdf_url, invoice_date')
  if (error) {
    console.error(error)
    return
  }
  console.log('Invoices data:')
  data.forEach(inv => {
    console.log(`#${inv.invoice_number} | Date: ${inv.invoice_date} | PDF: ${inv.pdf_url}`)
  })
}

check()
