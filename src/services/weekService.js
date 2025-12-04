// Week calculation service - Industrial Logic
import { fetchWeeklyStatus, saveTask, saveAssignment, isApiConfigured } from './api.js';

// Get Monday of current week
export const getMondayOfWeek = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Get week number (ISO)
export const getWeekNumber = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Get week key for storage (e.g., "2025-W49")
export const getWeekKey = (date = new Date()) => {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
};

// Get all dates of current week (Monday to Sunday)
export const getWeekDates = () => {
  const monday = getMondayOfWeek();
  const dates = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  
  return dates;
};

// Format date for display (e.g., "2 Dic")
export const formatDateShort = (date) => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

// Get day of week (1=Monday, 7=Sunday)
export const getDayOfWeek = (date = new Date()) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

// Check if date is today
export const isToday = (date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

// Check if date is in the past
export const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate < today;
};

// Check if date is in the future
export const isFutureDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate > today;
};

// Generate unique task key for the week
export const generateTaskKey = (storeId, taskId, dayOfWeek) => {
  const weekKey = getWeekKey();
  return `${storeId}-${weekKey}-D${dayOfWeek}-${taskId}`;
};

// Get task states for current week (from localStorage - sync separately)
export const getWeeklyTaskStates = (storeId) => {
  const weekKey = getWeekKey();
  const storageKey = `tasks_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  return data ? JSON.parse(data) : {};
};

// Save task states for current week (localStorage)
export const saveWeeklyTaskStates = (storeId, states) => {
  const weekKey = getWeekKey();
  const storageKey = `tasks_${storeId}_${weekKey}`;
  localStorage.setItem(storageKey, JSON.stringify(states));
};

// Sync task states from API to localStorage
export const syncFromApi = async (storeId) => {
  const weekKey = getWeekKey();
  
  if (!isApiConfigured()) {
    console.log('[Sync] API not configured, using localStorage only');
    return {
      taskStates: getWeeklyTaskStates(storeId),
      assignments: getWeeklyAssignments(storeId),
      synced: false
    };
  }

  try {
    const apiData = await fetchWeeklyStatus(storeId, weekKey);
    
    if (apiData.synced && apiData.taskStates) {
      // Merge API data with local (API takes precedence)
      const localStates = getWeeklyTaskStates(storeId);
      const mergedStates = { ...localStates, ...apiData.taskStates };
      saveWeeklyTaskStates(storeId, mergedStates);
      
      // Merge assignments
      if (apiData.assignments && apiData.assignments.length > 0) {
        const weekKey = getWeekKey();
        const storageKey = `assignments_${storeId}_${weekKey}`;
        localStorage.setItem(storageKey, JSON.stringify(apiData.assignments));
      }
      
      console.log('[Sync] Data synced from API successfully');
      return {
        taskStates: mergedStates,
        assignments: apiData.assignments || getWeeklyAssignments(storeId),
        synced: true
      };
    }
    
    // API error - return local data
    return {
      taskStates: getWeeklyTaskStates(storeId),
      assignments: getWeeklyAssignments(storeId),
      synced: false
    };
  } catch (error) {
    console.error('[Sync] Error syncing from API:', error);
    return {
      taskStates: getWeeklyTaskStates(storeId),
      assignments: getWeeklyAssignments(storeId),
      synced: false
    };
  }
};

// Update single task state (saves to localStorage AND API)
export const updateWeeklyTaskState = (storeId, taskId, dayOfWeek, updates) => {
  const states = getWeeklyTaskStates(storeId);
  const taskKey = `${taskId}_D${dayOfWeek}`;
  const weekKey = getWeekKey();
  
  const current = states[taskKey] || { status: 'PENDING', history: [] };
  const prevStatus = current.status;
  
  // Add to history (max 4)
  const historyEntry = {
    timestamp: new Date().toLocaleString('es-ES'),
    employee: updates.employee || 'Sistema',
    status: updates.status
  };
  
  const newHistory = [historyEntry, ...current.history].slice(0, 4);
  
  states[taskKey] = {
    ...current,
    status: updates.status,
    employee: updates.employee,
    history: newHistory
  };
  
  // Save to localStorage immediately
  saveWeeklyTaskStates(storeId, states);
  
  // Async save to API with enriched payload for forensic logging
  if (isApiConfigured()) {
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const apiPayload = {
      weekId: weekKey,
      dayName: updates.dayName || DAYS[dayOfWeek - 1],
      tienda: storeId,
      empleado: updates.employee || '',
      tareaId: taskId,
      tareaLabel: updates.tareaLabel || taskId,
      prevStatus: prevStatus,
      newStatus: updates.status,
      editCount: updates.editCount || newHistory.length,
      obs: updates.obs || ''
    };
    
    console.log('[weekService] Preparando payload para API:', apiPayload);
    
    saveTask(apiPayload).then(result => {
      if (!result.success) {
        console.warn('[API] Failed to save task, data preserved in localStorage');
      } else {
        console.log('[API] Task saved successfully');
      }
    });
  }
  
  return states[taskKey];
};

// Get custom assignments for current week
export const getWeeklyAssignments = (storeId) => {
  const weekKey = getWeekKey();
  const storageKey = `assignments_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  return data ? JSON.parse(data) : [];
};

// Add custom assignment for current week (saves to localStorage AND API)
export const addWeeklyAssignment = (storeId, assignment) => {
  const assignments = getWeeklyAssignments(storeId);
  const weekKey = getWeekKey();
  
  const newAssignment = {
    id: `custom_${Date.now()}`,
    ...assignment,
    createdAt: new Date().toISOString()
  };
  assignments.push(newAssignment);
  
  const storageKey = `assignments_${storeId}_${weekKey}`;
  localStorage.setItem(storageKey, JSON.stringify(assignments));
  
  // Async save to API
  if (isApiConfigured()) {
    saveAssignment({
      storeId,
      weekId: weekKey,
      ...newAssignment
    }).then(result => {
      if (!result.success) {
        console.warn('[API] Failed to save assignment, data preserved in localStorage');
      }
    });
  }
  
  return newAssignment;
};

// ============ DAILY CLOSE MANAGEMENT ============

// Get daily close status for a specific day
export const getDailyCloseStatus = (storeId, dayOfWeek) => {
  const weekKey = getWeekKey();
  const storageKey = `close_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  const closes = data ? JSON.parse(data) : {};
  return closes[`D${dayOfWeek}`] || null;
};

// Check if a day is closed
export const isDayClosed = (storeId, dayOfWeek) => {
  const closeStatus = getDailyCloseStatus(storeId, dayOfWeek);
  return closeStatus?.closed === true;
};

// Save daily close status
export const saveDailyClose = (storeId, dayOfWeek, employee) => {
  const weekKey = getWeekKey();
  const storageKey = `close_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  const closes = data ? JSON.parse(data) : {};
  
  closes[`D${dayOfWeek}`] = {
    closed: true,
    closedAt: new Date().toISOString(),
    closedBy: employee
  };
  
  localStorage.setItem(storageKey, JSON.stringify(closes));
  return closes[`D${dayOfWeek}`];
};

// Unlock a day (for admin use from Google Sheets)
export const unlockDay = (storeId, dayOfWeek) => {
  const weekKey = getWeekKey();
  const storageKey = `close_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  const closes = data ? JSON.parse(data) : {};
  
  if (closes[`D${dayOfWeek}`]) {
    closes[`D${dayOfWeek}`].closed = false;
    closes[`D${dayOfWeek}`].unlockedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(closes));
  }
  
  return closes[`D${dayOfWeek}`];
};
