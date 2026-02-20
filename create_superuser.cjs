const SUPABASE_URL = 'https://gufbkrzpalsrizkqusyr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1ZmJrcnpwYWxzcml6a3F1c3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTQxNjgsImV4cCI6MjA4NTYzMDE2OH0.iNOuSJXTViosN8xSgGF6Rds5fhmqo-xQYxTfbrx253g';

const EMAIL = 'info@escuelacaninafranestevez.es';
const PASSWORD = 'Xk9mQp2wLs7nRv4j'; // Random 16 chars (alphanumeric only)

async function createSuperUser() {
    console.log('=== Creando Superusuario ===');
    console.log(`Email: ${EMAIL}`);
    console.log(`Contraseña: ${PASSWORD}`);
    console.log('');

    // 1. Sign up via Supabase Auth REST API
    console.log('Paso 1: Registrando usuario...');
    const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
            data: { full_name: 'Fran Estévez (Admin)' }
        })
    });

    const signUpText = await signUpRes.text();
    console.log('Status:', signUpRes.status);
    console.log('Response:', signUpText);

    let signUpData;
    try {
        signUpData = JSON.parse(signUpText);
    } catch (e) {
        console.error('❌ No se pudo parsear la respuesta');
        process.exit(1);
    }

    if (!signUpRes.ok) {
        console.error('❌ Error al crear el usuario');
        process.exit(1);
    }

    const userId = signUpData.id;
    console.log('✅ Usuario creado con ID:', userId);

    // 2. Wait for trigger
    console.log('⏳ Esperando a que se cree el perfil...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Try to sign in
    console.log('Paso 2: Intentando iniciar sesión...');
    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    const signInText = await signInRes.text();
    console.log('Login Status:', signInRes.status);

    if (!signInRes.ok) {
        console.log('⚠️  Login falló (puede requerir confirmación de email)');
        console.log('Response:', signInText);
        console.log('');
        console.log('📝 INSTRUCCIONES MANUALES:');
        console.log('   1. Ve a https://supabase.com/dashboard/project/gufbkrzpalsrizkqusyr/auth/users');
        console.log('   2. Confirma el email del usuario manualmente');
        console.log('   3. Ve al SQL Editor y ejecuta:');
        console.log(`      UPDATE public.profiles SET role = 'admin', full_name = 'Fran Estévez (Admin)' WHERE id = '${userId}';`);
    } else {
        const signInData = JSON.parse(signInText);
        const accessToken = signInData.access_token;

        // 4. Update profile to admin
        console.log('Paso 3: Actualizando perfil a admin...');
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ role: 'admin', full_name: 'Fran Estévez (Admin)' })
        });

        if (updateRes.ok) {
            console.log('✅ Perfil actualizado a rol ADMIN');
        } else {
            const errText = await updateRes.text();
            console.log('⚠️  No se pudo actualizar automáticamente:', errText);
            console.log('   Ejecuta en el SQL Editor de Supabase:');
            console.log(`   UPDATE public.profiles SET role = 'admin', full_name = 'Fran Estévez (Admin)' WHERE id = '${userId}';`);
        }
    }

    console.log('');
    console.log('========================================');
    console.log('🔑 CREDENCIALES DEL SUPERUSUARIO:');
    console.log(`   Email:      ${EMAIL}`);
    console.log(`   Contraseña: ${PASSWORD}`);
    console.log('========================================');
    console.log('');
    console.log('⚠️  ¡GUARDA ESTA CONTRASEÑA EN UN LUGAR SEGURO!');
}

createSuperUser().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
