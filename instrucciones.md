1. Objetivo del sistema

Construir una aplicación web interna que sea el sistema central de gestión de una escuela canina con adiestramiento a domicilio, operando en múltiples ciudades.

La aplicación debe:

Gestionar leads, clientes, evaluaciones, sesiones, pagos y facturas

Centralizar todos los datos del negocio

Mostrar métricas clave de forma muy visual y ordenada

Permitir análisis por ciudad o global

Permitir selección de rango de fechas en todas las métricas

Escalar hasta 50 ciudades en 2026

Sustituir herramientas externas (Notion, dashboards externos, formularios)

2. Stack tecnológico (OBLIGATORIO)
Backend y base de datos

Supabase

PostgreSQL como base de datos

Supabase Auth para autenticación

Storage para PDFs de facturas

Row Level Security (RLS)

Frontend

Aplicación web generada por Antigravity

Consumo directo de Supabase (o capa API interna)

API

API REST propia de la aplicación

Compatible con Make, n8n u otras integraciones

3. Estética y diseño (OBLIGATORIO)

La aplicación debe seguir una estética moderna, minimalista y funcional:

Fondo blanco

Texto negro

Uso moderado de grises para separadores

Colores solo para:

Estados (badges)

Gráficos

Diseño tipo herramienta interna / CRM

Priorización de:

KPIs

Gráficos

Tablas

Interfaz pensada para uso diario intensivo

Desktop-first

4. Principios obligatorios del sistema

Una sola fuente de verdad

Datos críticos viven solo en la app.

La app es el formulario

Toda entrada y edición de datos se hace dentro de la app.

Eventos automáticos

Fechas clave se asignan automáticamente por eventos.

Separación clara por roles

Comerciales → leads

Adiestradores → servicio

Dirección → dinero y métricas

Visual primero

El estado del negocio debe entenderse “de un vistazo”.

Integrable

API REST y webhooks.

5. Roles del sistema
Administrador (Dirección)

Acceso total

Visualiza dashboards globales

Gestiona pagos y facturas

Gestiona usuarios y ciudades

Comercial

Gestiona leads

Actualiza estados

Convierte leads en clientes

No ve métricas financieras globales

Adiestrador

Acceso solo a su ciudad

Gestiona evaluaciones y sesiones

No ve pagos ni facturas

6. Modelo de entidades (alto nivel)
6.1 Ciudad

id

nombre

activa

adiestrador_asignado

6.2 Lead

Campos:

id

nombre

teléfono

email

ciudad

estado

comercial_asignado

created_at

evaluation_accepted_at (automático)

notas

source (manual | email | api)

external_source_id (para deduplicación)

Estados exactos:

Nuevo

Intentando contactar

Tiene que hablarlo

Evaluación aceptada

Evaluación denegada

Perdido

Regla
Si el estado pasa a “Evaluación aceptada” → asignar evaluation_accepted_at si está vacío.

6.3 Cliente (FUENTE DE VERDAD)

Campos:

id

lead_id

nombre

teléfono

email

dirección

ciudad

raza_perro

edad_perro

evaluation_done_at (automático)

estado (Evaluado / Activo / Finalizado)

created_at

6.4 Evaluación

Campos:

id

client_id

ciudad

resultado (Aprobada / Rechazada)

comentarios

created_at

Regla
Al crear evaluación → asignar client.evaluation_done_at si está vacío.

6.5 Sesión

Campos:

id

client_id

session_number (1–8)

fecha

completada

comentarios

Regla
Al completar sesión 8 → cliente pasa a Finalizado.

6.6 Pago

Campos:

id

client_id

payment_number (1 o 2)

amount (variable)

received (boolean, manual)

received_at (automático)

method

notes

Regla
Cuando received pasa a true:

asignar received_at

generar factura automáticamente

6.7 Factura

Campos:

id

invoice_number (correlativo)

invoice_series (opcional)

invoice_date (fecha del día)

client_id

payment_id

city_id

amount

currency (EUR)

status (issued / voided)

pdf_url

created_at

Reglas críticas

1 factura por pago recibido

Numeración correlativa sin saltos

Idempotencia (no duplicados)

Generar PDF y almacenarlo

7. Entrada de leads por email (integrado)

La app debe exponer un endpoint:

POST /api/leads/ingest-email


Recibe datos parseados del email

Usa external_source_id para deduplicar

Crea lead con:

estado = Nuevo

source = email

El email puede llegar vía Make, n8n u otro sistema, pero el destino final es la API de la app.

8. API REST (OBLIGATORIO)

Autenticación por API Key o JWT

Endpoints mínimos:

Leads

Clientes

Pagos

Facturas

Ingesta email

Webhooks opcionales:

lead.created

lead.status_changed

payment.received

invoice.issued

9. Dashboards y métricas (CRÍTICO)
9.1 Filtros globales (OBLIGATORIOS)

Todos los dashboards deben incluir:

Filtro de ciudad

Todas las ciudades

Ciudad concreta

Filtro de rango de fechas

Fecha inicio / fecha fin

Presets:

Hoy

Últimos 7 días

Últimos 30 días

Mes actual

Mes anterior

Personalizado

Los filtros afectan a todos los KPIs, gráficos y tablas.

Mostrar siempre:

“Todas las ciudades · 01/01/2026 – 31/01/2026”

9.2 Reglas temporales por métrica

Leads → lead.created_at

Evaluación aceptada → lead.evaluation_accepted_at

Evaluación realizada → client.evaluation_done_at

Clientes → client.created_at

Pagos → payment.received_at

Facturas → invoice.invoice_date

Sesiones → session.fecha

9.3 Dashboard Dirección (Global)

KPIs:

Leads totales

Evaluaciones aceptadas

Evaluaciones realizadas

Clientes activos

Ingresos totales

Gráficos:

Funnel completo

Ingresos por ciudad

Conversión por ciudad

Evolución temporal

Tablas:

Ranking de ciudades

Últimos clientes

Pagos pendientes

9.4 Dashboard Comercial

Leads asignados

Estados y leads atascados

Evaluaciones aceptadas

Conversión por comercial

9.5 Dashboard Adiestrador (ciudad)

Evaluaciones pendientes

Clientes activos

Sesiones de hoy / semana

Progreso por cliente

10. Reglas de visibilidad

Adiestrador: solo su ciudad, sin importes

Comercial: sin métricas financieras globales

Admin: acceso total

11. Alcance MVP

Incluye:

Gestión completa interna

Facturación automática

Dashboards gráficos con filtros

API REST

Ingesta de leads por email

Excluye:

APIs publicitarias

Facturación fiscal avanzada

Automatizaciones externas complejas

12. Principio rector final

Datos fiables,
métricas claras,
decisiones rápidas.


Nota Final: Este documento actúa como archivo inicial de referencia, cuyo propósito es explicar qué es el proyecto, qué se va a construir y cómo se divide el trabajo, sin entrar en detalles de implementacion.