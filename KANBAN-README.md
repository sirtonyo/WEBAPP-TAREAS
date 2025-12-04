# 📋 Sistema Kanban de Gestión de Tareas Semanal

## 🎯 Descripción

Sistema de gestión de tareas transformado en un **Tablero Kanban Semanal** con visualización semafórica, gestión avanzada de estados, historial de cambios y persistencia semanal.

## ✨ Características Principales

### 1. **Detección Automática de Tienda por URL**
- La aplicación lee el parámetro `?store=TX` de la URL
- **Ejemplo:** `http://localhost:5173/?store=T1`
- Si no hay parámetro o es inválido, se muestra pantalla de error
- No requiere selector manual de tienda

### 2. **Vista Kanban Semanal**
- **7 columnas** (Lunes a Domingo) en CSS Grid responsive
- **Día actual destacado** con fondo amarillo y badge "HOY"
- **Código de colores semafórico:**
  - 🟢 **Verde:** Tarea completada (DONE)
  - 🔴 **Rojo:** Tarea pendiente HOY (urgente)
  - 🟠 **Naranja:** Tarea pendiente ATRASADA (late)
  - ⚪ **Gris:** Tarea futura

### 3. **Tarjetas de Tarea Inteligentes**
- Siempre visibles (no se ocultan al completarse)
- Muestran nombre de la tarea
- **Si está completada:** Icono ✓ + nombre del empleado
- **Si está pendiente:** Texto "No realizada"
- Badge 📷 para tareas que requieren foto

### 4. **Modal de Edición (Lightbox)**
Al hacer clic en cualquier tarjeta:
- **Historial de cambios** (últimos 3 registros)
  - Timestamp
  - Nombre del empleado
  - Estado (Completada/Pendiente)
- **Input obligatorio:** Nº Empleado / Nombre (para marcar como hecha)
- **Botones de acción:**
  - ✓ Marcar como Hecha (verde) - requiere nombre
  - ○ Marcar como Pendiente (rojo) - solo si estaba hecha

### 5. **Gestión de Encargos (Manager)**
- **Botón flotante "+"** (esquina inferior derecha)
- **Acceso con PIN:** 1983
- **Formulario de encargo:**
  - Descripción (obligatorio)
  - Responsable (obligatorio)
  - Ayudante (opcional)
  - Día de la semana
- Los encargos aparecen como tarjetas moradas con icono 🔧

### 6. **Persistencia Semanal (localStorage)**
- Estados guardados por **semana** (clave: lunes de cada semana)
- Cada tarea mantiene:
  - Estado (DONE/PENDING)
  - Empleado asignado
  - Historial de cambios (máximo 3)
- Los encargos personalizados también se persisten

### 7. **Mapping de Tareas por Día**
Cada tarea tiene un array `days` que indica en qué columnas aparece:
- **Revisión Escaparate:** Solo Lunes (1)
- **Antihurto:** Lunes a Sábado (1-6)
- **Limpieza General:** Solo Sábado (6)
- **Tareas diarias:** Todos los días (1-7)

## 🗂️ Estructura del Proyecto

```
src/
├── components/
│   ├── KanbanBoard.jsx          # Tablero principal (Grid de 7 columnas)
│   ├── KanbanBoard.css          # Estilos del tablero
│   ├── TaskCard.jsx             # Tarjeta individual de tarea
│   ├── TaskCard.css             # Estilos de tarjetas con semáforo
│   ├── TaskModal.jsx            # Modal de edición con historial
│   ├── TaskModal.css            # Estilos del modal
│   ├── ErrorScreen.jsx          # Pantalla de error de acceso
│   ├── ErrorScreen.css          # Estilos de error
│   ├── ConfigScreen.jsx         # (Deprecado - mantener por compatibilidad)
│   └── TaskSection.jsx          # (Deprecado - mantener por compatibilidad)
├── services/
│   └── taskService.js           # Lógica de persistencia y estados
├── data/
│   └── tasks.json               # Tareas con propiedad 'days'
├── App.jsx                      # App principal con detección URL
└── App.css                      # Estilos globales
```

## 🚀 Uso

### Desarrollo Local
```bash
npm run dev
```
Acceder con: `http://localhost:5173/?store=T1`

### Producción
```bash
npm run build
npm run preview
```

## 🔗 URLs de Acceso

Cada tienda tiene su propia URL:
- **Tienda Colón:** `?store=T1`
- **Tienda Ruzafa:** `?store=T2`
- **Tienda 3:** `?store=T3`
- **Tienda 4:** `?store=T4`

## 🎨 Tecnologías

- **React 18** - Framework principal
- **Vite** - Build tool y dev server
- **CSS Grid** - Layout del Kanban
- **localStorage** - Persistencia de datos
- **CSS Animations** - Transiciones y feedback visual

## 📊 Datos de Tareas (tasks.json)

```json
{
  "id": "t3",
  "label": "Revisión Escaparate",
  "category": "Apertura",
  "requiresPhoto": true,
  "targetStores": ["all"],
  "days": [1]  // Solo Lunes
}
```

### Propiedad `days` - Mapping de días:
- `1` = Lunes
- `2` = Martes
- `3` = Miércoles
- `4` = Jueves
- `5` = Viernes
- `6` = Sábado
- `7` = Domingo

## 🔐 Funciones de Manager

**PIN de acceso:** `1983`

### Crear Encargo:
1. Click en botón flotante "+"
2. Introducir PIN: 1983
3. Completar formulario
4. El encargo aparece en la columna del día seleccionado

## 🎯 Lógica de Estados

### PENDING (Pendiente)
- **Hoy:** Borde rojo + animación pulse
- **Atrasado:** Borde naranja
- **Futuro:** Borde gris

### DONE (Completado)
- Borde verde
- Fondo degradado verde suave
- Muestra ✓ + nombre empleado

## 📱 Responsive Design

- **Desktop (>1600px):** 7 columnas completas
- **Tablet (1200-1600px):** 7 columnas reducidas
- **Mobile (768-1200px):** 4 columnas
- **Small Mobile (<768px):** 2 columnas
- **Tiny (<480px):** 1 columna (scroll vertical)

## 🔄 Persistencia y Sincronización

### Estructura localStorage:
```javascript
// Estados de tareas
localStorage['taskStates_T1_2025-12-02'] = {
  "t1_1": {  // taskId_dayOfWeek
    status: "DONE",
    employee: "Juan Pérez",
    history: [
      {
        timestamp: "03/12/2025 10:30:15",
        employee: "Juan Pérez",
        status: "DONE"
      }
    ]
  }
}

// Encargos personalizados
localStorage['customAssignments_T1_2025-12-02'] = [
  {
    id: "custom_1733234567890",
    description: "Revisar almacén",
    responsible: "María",
    helper: "Luis",
    dayOfWeek: 3,
    createdAt: "2025-12-03T10:30:00.000Z"
  }
]
```

### Clave de semana:
Se usa el **lunes de la semana** como identificador único:
- Permite mantener datos históricos
- Resetea automáticamente cada semana
- Compatible con revisión de semanas pasadas

## 🛠️ Próximos Pasos (Backend)

### Integración con Google Sheets Apps Script:

#### GET (Lectura)
```javascript
function doGet(e) {
  const storeId = e.parameter.store;
  const weekKey = e.parameter.week;
  // Devolver estados de la semana actual
  return ContentService.createTextOutput(
    JSON.stringify({
      taskStates: {...},
      customAssignments: [...]
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

#### POST (Escritura)
```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  // Registrar en Sheet: timestamp, store, task, employee, status
  // ...
}
```

## 📞 Soporte

Para errores de acceso o configuración, contactar con Dirección.

---

**Versión:** 2.0.0 (Kanban Refactor)  
**Última actualización:** Diciembre 2025
