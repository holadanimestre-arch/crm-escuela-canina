const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://gufbkrzpalsrizkqusyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

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
