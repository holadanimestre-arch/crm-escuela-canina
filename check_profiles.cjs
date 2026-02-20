const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://gufbkrzpalsrizkqusyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g'
)

async function check() {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) {
    fs.writeFileSync('profiles_log.txt', 'Error: ' + JSON.stringify(error))
    return
  }
  fs.writeFileSync('profiles_log.txt', JSON.stringify(data, null, 2))
}

check()
