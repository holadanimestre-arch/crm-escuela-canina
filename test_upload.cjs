const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://gufbkrzpalsrizkqusyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function check() {
  const { data, error } = await supabase.storage.from('invoices').upload('test.txt', 'Hello World', { upsert: true })
  if (error) {
    fs.writeFileSync('upload_log.txt', 'Error: ' + JSON.stringify(error))
    return
  }
  fs.writeFileSync('upload_log.txt', 'Success: ' + JSON.stringify(data))
}

check()
