import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gufbkrzpalsrizkqusyr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g',
    { auth: { persistSession: false } }
);

async function testSignup() {
    const { data, error } = await supabase.auth.signUp({
        email: 'holadanimestre@gmail.com',
        password: 'password123',
    });
    console.log("Error:", error);
    console.log("Data User:", data?.user);
}

testSignup();
