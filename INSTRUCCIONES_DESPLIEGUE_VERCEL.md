# Instrucciones de Despliegue en Vercel

Este documento detalla los pasos para desplegar el CRM de la Escuela Canina en Vercel, configurando el subdominio `crm.escuelacaninafranestevez.es`.

## 1. Preparación del Proyecto

El proyecto (Vite + React) ya está preparado. He creado el archivo `vercel.json` en la raíz del proyecto para asegurar que las rutas funcionen correctamente al recargar la página (comportamiento habitual en aplicaciones de tipo SPA - Single Page Application).

Asegúrate de:
1. Tener una cuenta en [Vercel](https://vercel.com/) (puedes registrarte usando tu cuenta de GitHub).
2. Tener el código de este proyecto subido a un repositorio de GitHub.

## 2. Despliegue en Vercel

1. Inicia sesión en tu cuenta de Vercel.
2. En el panel principal (Dashboard), haz clic en el botón **"Add New..."** y luego selecciona **"Project"**.
3. En la sección "Import Git Repository", busca el repositorio de GitHub donde tienes el CRM y haz clic en **"Import"**.
4. Se abrirá la pantalla de configuración del proyecto:
   - **Project Name:** `crm-escuela-canina` (o el nombre que prefieras).
   - **Framework Preset:** Vercel debería detectar automáticamente que estás usando **Vite**. Si no lo hace, selecciónalo de la lista.
   - **Root Directory:** Déjalo como está (la raíz del proyecto `./`).
   - **Build and Output Settings:** Puedes dejar los valores por defecto (Build command: `npm run build`, Output directory: `dist`).
5. **¡MUY IMPORTANTE! - Environment Variables (Variables de Entorno)**
   Abre la sección "Environment Variables" y añade las variables que tienes en tu archivo `.env` local para que la aplicación web se pueda comunicar con Supabase:
   - Añade `VITE_SUPABASE_URL` y pégale su valor correspondiente.
   - Añade `VITE_SUPABASE_ANON_KEY` y pégale su valor correspondiente.
6. Haz clic en el botón **"Deploy"**.
7. Vercel comenzará a construir y desplegar tu aplicación. Una vez que termine (tardará entre 1 y 2 minutos), verás una pantalla de éxito confirmando el despliegue con una URL temporal generada por Vercel (por ejemplo: `crm-escuela-canina.vercel.app`).

## 3. Configuración del Subdominio (crm.escuelacaninafranestevez.es)

Una vez desplegada la aplicación, vamos a vincularla al subdominio que ya tienes:

1. En la pantalla de éxito que te apareció en Vercel o en el panel de tu proyecto en Vercel, ve a la pestaña **"Settings"** (Ajustes).
2.  En el menú lateral izquierdo, haz clic en **"Domains"**.
3.  Escribe tu subdominio: `crm.escuelacaninafranestevez.es` en el campo y haz clic en **"Add"**.
4. Al añadirlo, Vercel te indicará que la configuración DNS tiene un estado "Invalid Configuration" o similar, y **te dará un registro que debes añadir a los DNS de tu proveedor de dominio**. 
5. Coge la información que te da Vercel para el registro DNS, que generalmente es un registro de tipo **CNAME**:
   - **Name / Host:** `crm`
   - **Type:** `CNAME`
   - **Value / Points to:** `cname.vercel-dns.com`

**En tu proveedor de Dominio (donde tienes comprado `escuelacaninafranestevez.es`):**

1. Entra al panel de control de donde hayas comprado tu dominio (por ejemplo: DonDominio, Hostinger, GoDaddy, etc.).
2. Ve a la gestión de **DNS / Zonas DNS**.
3. Añade un nuevo registro con los datos que te proporcionó Vercel:
   - **Tipo de registro:** `CNAME`
   - **Nombre / Host:** `crm` *(esto es para crear el subdominio sobre el dominio principal)*
   - **Valor / Destino:** `cname.vercel-dns.com.` *(es importante incluir el punto al final si tu proveedor lo requiere)*
4. Guarda los cambios.

## 4. Esperar Propagación y Verificar

- La propagación de los DNS puede tardar desde unos minutos hasta 24-48 horas, aunque actualmente suele ser bastante rápido. 
- Vuelve al panel de "Domains" en Vercel. Verás que después de un rato, cuando los DNS se actualicen, el estado de tu dominio pasará a estar verificado (con un check verde). Automáticamente, Vercel creará y asignará de forma gratuita un certificado SSL para que tu sitio cargue en modo seguro (HTTPS).
- Una vez validado, simplemente entra a `https://crm.escuelacaninafranestevez.es` desde tu navegador y ¡ya tendrás el CRM funcionando en la nube!

## Nota sobre Actualizaciones:
A partir de este momento, cada vez que hagas un `git push` a la rama principal (generalmente `main` o `master`) de tu repositorio en GitHub, Vercel detectará los cambios, compilará y desplegará automáticamente la nueva versión del CRM sin que tengas que hacer nada más.

**Últimos cambios aplicados para producción:**
- Se ha movido el logo a la carpeta `public` para asegurar que cargue correctamente en el servidor.
- Se ha incluido el archivo `vercel.json` para que las rutas internas funcionen al recargar.
- Se ha verificado que no existan rutas locales (`localhost`) en el código.
- Se han incluido todos los permisos especiales para Lupe y la carga de fotos.
