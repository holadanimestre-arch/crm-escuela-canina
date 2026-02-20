const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://gufbkrzpalsrizkqusyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function check() {
  console.log('Starting check...')
  const { data: buckets, error: bError } = await supabase.storage.listBuckets()
  if (bError) {
    console.error('Error listing buckets:', bError)
    return
  }
  console.log('Buckets:', buckets.map(b => b.name))
  
  const { data: files, error: filesError } = await supabase.storage.from('invoices').list()
  if (filesError) {
    console.error('Error listing files in invoices:', filesError)
  } else {
    console.log('Files in invoices:', files ? files.map(f => f.name) : 'none')
  }
}

check().catch(err => console.error('Final error:', err))
