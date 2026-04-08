# Análisis CRM Escuela Canina — Errores y Mejoras Pendientes

---

## 🔴 ALTA PRIORIDAD

### 1. Email hardcodeado para acceso admin (SEGURIDAD)
- **Archivo**: `Dashboard.tsx` línea ~12
- El acceso al dashboard de admin comprueba el email `lupe@escuelacaninafranestevez.es` directamente en el código, ignorando el campo `role`
- **Fix**: Eliminar el check por email, usar solo `profile.role === 'admin'`

### 2. Race condition en facturación — polling de factura puede agotar intentos
- **Archivo**: `Facturacion.tsx` líneas 141-159
- El trigger de BD crea la factura después del pago, pero con solo 5 intentos puede no encontrarla a tiempo
- El usuario ve el modal de email con importe 0 si no se encuentra la factura
- **Fix**: Aumentar intentos y mostrar estado "procesando" claro

### 3. PDF puede enviarse vacío por email
- **Archivo**: `Facturacion.tsx` líneas 164-203
- El modal de email se abre con `pdfUrl: ''` mientras el PDF se genera en background. El usuario puede pulsar "Enviar" antes de que el PDF esté listo
- **Fix**: Deshabilitar botón de envío hasta que `pdfUrl` esté disponible

### 4. Errores de Supabase silenciosos en múltiples sitios
- **Archivos**: `Sesiones.tsx` líneas 117-119, `AdiestradorDashboard.tsx` varios
- Bloques `catch` que solo hacen `console.error` sin feedback visible al usuario
- **Fix**: Mostrar mensaje de error en UI con `showAlert`

### 5. Logs de debug en producción
- **Archivo**: `Facturacion.tsx` (15+ `console.log('[FC]', ...)`)
- Saturan la consola en producción y pueden exponer datos sensibles
- **Fix**: Eliminar todos los `console.log` de debug

---

## 🟡 MEDIA PRIORIDAD

### 6. Borrar cliente no elimina datos relacionados
- **Archivo**: `ClientDetail.tsx` líneas 220-232
- Al eliminar un cliente solo se borra el lead asociado. Quedan huérfanos: sesiones, evaluaciones, pagos, facturas
- **Fix**: Borrar en cascada o usar `ON DELETE CASCADE` en las FK de BD

### 7. Session numbers sin orden validado
- **Archivo**: `Sesiones.tsx`
- Se puede marcar la sesión 5 como completada sin que existan las sesiones 1-4
- **Fix**: Validar que la sesión anterior esté completada antes de completar la siguiente

### 8. Dirección no se puede escribir en modal de conversión de lead
- **Archivo**: `Leads.tsx` — campo de dirección
- El input de dirección aparece bloqueado en ciertos estados del formulario de conversión
- **Fix**: Revisar la lógica de `disabled` en el campo dirección

### 9. Carga de adiestradores sin manejo de error
- **Archivo**: `Leads.tsx` líneas 127-133
- Si la query falla, `adiestradores` queda vacío sin avisar al usuario
- **Fix**: Mostrar error si la query falla

### 10. Modal de conversión de lead no se cierra en caso de error
- **Archivo**: `Leads.tsx` líneas 186-194
- Si la conversión falla, el modal permanece abierto pero el estado interno puede quedar inconsistente
- **Fix**: Resetear el estado del formulario en el `catch`

### 11. Eliminación de cliente sin confirmación robusta
- **Archivo**: `ClientDetail.tsx` línea 219
- Hay confirmación pero solo una ventana; la acción es irreversible
- **Fix**: Confirmación en dos pasos o pedir escribir el nombre

### 12. Inconsistencia en el progresión de estados de cliente
- **Archivos**: varios
- Un cliente puede pasar a cualquier estado sin respetar el flujo (`evaluado → activo → finalizado`)
- **Fix**: Validar transiciones de estado en BD o en código

### 13. `Math.max` devuelve `NaN` si `session_number` es null
- **Archivo**: `Clients.tsx` líneas 169-176
- Si alguna sesión tiene `session_number = null`, `Math.max(...sessions.map(...))` devuelve `NaN`
- **Fix**: Filtrar nulls antes del `Math.max`

### 14. Sin estado de carga durante operaciones async
- **Archivos**: múltiples componentes
- Botones no muestran "cargando..." en todas las operaciones, el usuario no sabe si el click se registró
- **Fix**: Añadir estado `loading` y deshabilitar botón mientras se procesa

### 15. RLS — adiestradores podrían ver clientes de otras ciudades en rutas directas
- **Archivo**: `ClientDetail.tsx`, `EvaluationDetail.tsx`
- No se verifica que el adiestrador tenga permiso para ver ese cliente específico al entrar a la URL directamente
- **Fix**: Verificar en el componente que `client.city_id === profile.assigned_city_id`

### 16. Sin validación de email en formularios
- **Archivos**: `Usuarios.tsx`, `Leads.tsx`, `Clients.tsx`
- Los campos de email no validan el formato antes de guardar
- **Fix**: Añadir validación con regex o `type="email"`

---

## 🟢 BAJA PRIORIDAD / MEJORAS UX

### 17. Opciones de estado con nombres de personas hardcodeados
- **Archivo**: `Leads.tsx` líneas 326-335
- Opciones como "Intentando Contactar Lupe" tienen nombre fijo en el código
- **Fix**: Hacer configurable desde Ajustes

### 18. Opción duplicada en selector de estado de lead
- **Archivo**: `Leads.tsx` línea ~332
- "Tiene que hablarlo Pablo" aparece dos veces en el selector
- **Fix**: Eliminar el duplicado

### 19. Mensajes de estado vacío inconsistentes
- **Archivos**: múltiples páginas
- Algunos usan "No hay X", otros "Sin X", con capitalización distinta
- **Fix**: Unificar texto de estados vacíos

### 20. Sin exportación de datos a Excel/CSV
- **Archivos**: `Facturacion.tsx`, `AdminDashboard.tsx`
- No se puede exportar facturación ni estadísticas
- **Fix**: Añadir botón "Exportar CSV"

### 21. Sin paginación en tablas
- **Archivos**: `Clients.tsx`, `Leads.tsx`
- Con muchos registros la página se vuelve lenta
- **Fix**: Paginación o scroll infinito

### 22. Sin acciones en bloque para leads
- **Archivo**: `Leads.tsx`
- No se pueden seleccionar varios leads para cambiar estado o eliminar
- **Fix**: Checkboxes + acción en bloque

### 23. Sin error boundary global
- **Archivo**: `main.tsx`
- Si un proveedor de contexto falla, la app muestra pantalla en blanco sin mensaje
- **Fix**: Añadir `<ErrorBoundary>` en el árbol raíz

### 24. Confirmaciones solo en algunas acciones destructivas
- **Archivos**: varios
- Algunas acciones irreversibles tienen confirmación y otras no
- **Fix**: Revisar y añadir confirmación donde falte

### 25. Sección "Próximas Tareas" del comercial vacía
- **Archivo**: dashboard comercial
- La sección tiene solo texto de placeholder, no está implementada
- **Fix**: Implementar o eliminar la sección

---

## 📋 PENDIENTE EXTERNO (no depende del código)

- **Verificación DNS Resend** — dominio `escuelacaninafranestevez.es` pendiente de verificar para envío de facturas por email
- **CSP y jsPDF** — generación de PDF puede fallar en algunos navegadores por política `eval` bloqueada
- **Confirmación de email de nuevos usuarios** — hay que confirmar manualmente via SQL al crear usuarios desde el admin
