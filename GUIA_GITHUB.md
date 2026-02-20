# Guía para Subir el Proyecto a GitHub

Sigue estos pasos para subir tu código a GitHub por primera vez.

## 1. Crear el Repositorio en GitHub

1. Entra en tu cuenta de [GitHub](https://github.com/).
2. Haz clic en el botón **"+"** (arriba a la derecha) y selecciona **"New repository"**.
3. **Repository name:** `crm-escuela-canina`
4. Manténlo como **Public** o **Private** (según prefieras).
5. **¡IMPORTANTE!**: No marques ninguna de las opciones de "Initialize this repository with" (ni README, ni .gitignore, ni license). Queremos el repositorio vacío.
6. Haz clic en **"Create repository"**.

## 2. Inicializar Git en tu Ordenador

Abre tu terminal en la carpeta del proyecto y ejecuta estos comandos uno a uno:

```bash
# 1. Inicializar el repositorio local
git init

# 2. Añadir todos los archivos (Git respetará el archivo .gitignore automáticamente)
git add .

# 3. Guardar los cambios localmente
git commit -m "Primer despliegue del CRM"

# 4. Cambiar el nombre de la rama principal a main
git branch -M main
```

## 3. Vincular y Subir a GitHub

En la página de GitHub que acabas de crear, verás una sección llamada **"…or push an existing repository from the command line"**. Copia y pega esos comandos (o usa estos sustituyendo tu usuario):

```bash
# 1. Vincular con GitHub (SUSTITUYE 'tu-usuario' por el tuyo real)
git remote add origin https://github.com/tu-usuario/crm-escuela-canina.git

# 2. Subir el código definitivo
git push -u origin main
```

---

### ¡Listo!
Una vez hecho esto, tu código estará en GitHub. Ahora ya puedes volver al paso 2 de las **INSTRUCCIONES_DESPLIEGUE_VERCEL.md** para conectar Vercel con este nuevo repositorio.
