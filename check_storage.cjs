const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://gufbkrzpalsrizkqusyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function check() {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error('Error listing buckets:', error)
    return
  }
  console.log('Buckets:', data.map(b => b.name))
  
  const { data: files, error: filesError } = await supabase.storage.from('invoices').list()
  if (filesError) {
    console.error('Error listing files in invoices:', filesError)
  } else {
    console.log('Files in invoices:', files.map(f => f.name))
  }
}

check()
