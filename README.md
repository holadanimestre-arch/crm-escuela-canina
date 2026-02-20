# CRM Escuela Canina

Sistema central de gestión para escuela canina con adiestramiento a domicilio.
Aplicación web moderna, minimalista y orientada a datos.

## Stack Tecnológico

- **Frontend**: React + TypeScript + Vite
- **Estilos**: Vanilla CSS / CSS Modules
- **Backend/DB**: Supabase (Auth, Postgres, Storage)
- **Estado**: React Context
- **Routing**: React Router DOM

## Estructura del Proyecto

```
/src
  /assets      # Recursos estáticos
  /components  # Componentes UI reutilizables
  /context     # Estado global (Auth, Theme)
  /hooks       # Custom Hooks
  /layouts     # Estrucutras de página
  /lib         # Configuración de terceros (Supabase)
  /pages       # Vistas de la aplicación
  /services    # Llamadas a API / DB
  /types       # Definiciones TypeScript
  /utils       # Funciones auxiliares
```

## Primeros Pasos

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   Copiar `.env.example` (pendiente de creación) a `.env` y añadir credenciales de Supabase.

3. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Estado del Proyecto

**Fase Actual**: Fase 1 - Configuración Inicial y Arquitectura.
Consulta `implementation_plan.md` (en los artefactos de la IA) para el roadmap detallado.
