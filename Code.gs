/**
 * Google Apps Script - Backend para Sistema de Tareas
 * 
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 1. Crear un Google Spreadsheet con las siguientes hojas:
 *    - Log (para guardar cambios de tareas)
 *    - Config_Tareas (para configurar las tareas)
 *    - Config_Empleados (para configurar empleados)
 * 
 * 2. Estructura de Config_Tareas:
 *    | id | label | description | category | recurrence | targetStores |
 *    |T01 |Barrer |Barrer tienda|Mañana    |daily       |all           |
 *    |T02 |Stock  |Revisar stock|Dia       |L,X,V       |T1,T2         |
 * 
 * 3. Estructura de Config_Empleados:
 *    | id | name      |
 *    |001 |Ana García |
 *    |002 |Luis Pérez |
 * 
 * 4. Publicar como Web App:
 *    - Implementar > Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 */

const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI'; // Cambiar por tu ID

// Nombre de las hojas
const SHEET_LOG = 'Log';
const SHEET_TASKS = 'Config_Tareas';
const SHEET_EMPLOYEES = 'Config_Empleados';

/**
 * Maneja las peticiones GET
 * - action=getConfig -> Devuelve configuración de tareas y empleados
 */
function doGet(e) {
  try {
    const action = e?.parameter?.action || 'getConfig';
    
    if (action === 'getConfig') {
      return getConfig();
    }
    
    return createJsonResponse({ error: 'Acción no válida' }, 400);
  } catch (error) {
    return createJsonResponse({ error: error.message }, 500);
  }
}

/**
 * Maneja las peticiones POST
 * - action=saveTask -> Guarda cambio de estado de tarea
 * - action=saveAssignment -> Guarda nuevo encargo
 */
function doPost(e) {
  try {
    let data;
    
    // Soportar ambos content-types (text/plain para CORS bypass)
    if (e.postData?.type === 'text/plain' || e.postData?.type?.includes('text/plain')) {
      data = JSON.parse(e.postData.contents);
    } else if (e.postData?.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return createJsonResponse({ error: 'No data received' }, 400);
    }

    const action = data.action || 'saveTask';

    if (action === 'saveTask') {
      return saveTask(data);
    } else if (action === 'saveAssignment') {
      return saveAssignment(data);
    }

    return createJsonResponse({ error: 'Acción no válida' }, 400);
  } catch (error) {
    return createJsonResponse({ error: error.message }, 500);
  }
}

/**
 * Obtiene la configuración de tareas y empleados desde Google Sheets
 */
function getConfig() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Obtener tareas
  const tasksSheet = ss.getSheetByName(SHEET_TASKS);
  const tasksData = tasksSheet.getDataRange().getValues();
  const tasksHeaders = tasksData[0];
  
  const tasks = tasksData.slice(1).filter(row => row[0]).map(row => {
    const task = {};
    tasksHeaders.forEach((header, i) => {
      task[header.toLowerCase()] = row[i];
    });
    
    // Parsear targetStores
    if (typeof task.targetstores === 'string') {
      task.targetStores = task.targetstores.split(',').map(s => s.trim());
    } else {
      task.targetStores = ['all'];
    }
    delete task.targetstores;
    
    return {
      id: String(task.id),
      label: task.label || '',
      description: task.description || '',
      category: task.category || 'Dia',
      recurrence: String(task.recurrence || 'daily'),
      targetStores: task.targetStores,
      requiresPhoto: task.requiresphoto === true || task.requiresphoto === 'TRUE'
    };
  });
  
  // Obtener empleados
  const employeesSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  const employeesData = employeesSheet.getDataRange().getValues();
  const employeesHeaders = employeesData[0];
  
  const employees = employeesData.slice(1).filter(row => row[0]).map(row => {
    const emp = {};
    employeesHeaders.forEach((header, i) => {
      emp[header.toLowerCase()] = row[i];
    });
    
    return {
      id: String(emp.id),
      name: emp.name || ''
    };
  });
  
  return createJsonResponse({
    success: true,
    tasks,
    employees
  });
}

/**
 * Guarda un cambio de estado de tarea en la hoja Log
 * 
 * Columnas del Log (11 columnas forenses):
 * A: Timestamp
 * B: weekId (ej: 2025-W01)
 * C: dayName (ej: Lunes)
 * D: tienda (ej: T1)
 * E: empleado
 * F: tareaId
 * G: tareaLabel
 * H: prevStatus
 * I: newStatus
 * J: editCount
 * K: obs (observaciones)
 */
function saveTask(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_LOG);
  
  if (!sheet) {
    return createJsonResponse({ error: 'Hoja Log no encontrada' }, 404);
  }
  
  // Formatear timestamp
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  
  // Construir fila con 11 columnas forenses
  const row = [
    timestamp,                          // A: Timestamp
    data.weekId || '',                  // B: weekId
    data.dayName || '',                 // C: dayName
    data.storeId || data.tienda || '',  // D: tienda
    data.employee || data.empleado || '', // E: empleado
    data.taskId || data.tareaId || '',  // F: tareaId
    data.tareaLabel || '',              // G: tareaLabel
    data.prevStatus || '',              // H: prevStatus
    data.status || data.newStatus || '', // I: newStatus
    data.editCount || 1,                // J: editCount
    data.obs || ''                      // K: obs
  ];
  
  sheet.appendRow(row);
  
  return createJsonResponse({
    success: true,
    message: 'Tarea guardada correctamente',
    timestamp
  });
}

/**
 * Guarda un nuevo encargo (assignment) en la hoja Log
 */
function saveAssignment(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_LOG);
  
  if (!sheet) {
    return createJsonResponse({ error: 'Hoja Log no encontrada' }, 404);
  }
  
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  
  // Para encargos, usamos un formato especial
  const row = [
    timestamp,                          // A: Timestamp
    data.weekId || '',                  // B: weekId
    data.dayName || '',                 // C: dayName
    data.storeId || '',                 // D: tienda
    data.responsible || '',             // E: empleado (responsable)
    'ENCARGO',                          // F: tareaId
    data.description || '',             // G: tareaLabel (descripción)
    '',                                 // H: prevStatus
    'CREATED',                          // I: newStatus
    1,                                  // J: editCount
    `Ayudante: ${data.helper || '-'}`   // K: obs
  ];
  
  sheet.appendRow(row);
  
  return createJsonResponse({
    success: true,
    message: 'Encargo guardado correctamente',
    timestamp
  });
}

/**
 * Crea una respuesta JSON con headers CORS
 */
function createJsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNCIÓN DE TEST - Ejecutar manualmente para probar
 */
function testGetConfig() {
  const result = getConfig();
  Logger.log(result.getContent());
}

function testSaveTask() {
  const testData = {
    action: 'saveTask',
    weekId: '2025-W01',
    dayName: 'Lunes',
    storeId: 'T1',
    employee: '001 - Ana García',
    taskId: 'T01',
    tareaLabel: 'Barrer tienda',
    prevStatus: 'PENDING',
    status: 'DONE',
    editCount: 1,
    obs: 'Completada a las 10:00'
  };
  
  const mockEvent = {
    postData: {
      type: 'text/plain',
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
