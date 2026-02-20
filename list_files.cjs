const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://gufbkrzpalsrizkqusyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function check() {
  const { data: files, error } = await supabase.storage.from('invoices').list()
  if (error) {
    fs.writeFileSync('files_log.txt', 'Error: ' + JSON.stringify(error))
    return
  }
  const names = files.map(f => f.name).join('\n')
  fs.writeFileSync('files_log.txt', names || 'empty')
}

check()
