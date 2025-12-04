// Service for managing task states, history, and custom assignments

// Get current week's Monday date (ISO format YYYY-MM-DD)
const getWeekKey = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
};

// Get task states for current week
export const getTaskStates = (storeId) => {
  const weekKey = getWeekKey();
  const storageKey = `taskStates_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  return data ? JSON.parse(data) : {};
};

// Save task states for current week
export const saveTaskStates = (storeId, states) => {
  const weekKey = getWeekKey();
  const storageKey = `taskStates_${storeId}_${weekKey}`;
  localStorage.setItem(storageKey, JSON.stringify(states));
};

// Update a specific task state
export const updateTaskState = (storeId, taskId, dayOfWeek, updates) => {
  const states = getTaskStates(storeId);
  const taskKey = `${taskId}_${dayOfWeek}`;
  
  const currentState = states[taskKey] || {
    status: 'PENDING',
    history: []
  };

  // Add to history
  const timestamp = new Date().toLocaleString('es-ES');
  const historyEntry = {
    timestamp,
    employee: updates.employee || 'Sistema',
    status: updates.status || currentState.status
  };

  const newHistory = [historyEntry, ...currentState.history].slice(0, 3);

  states[taskKey] = {
    ...currentState,
    ...updates,
    history: newHistory
  };

  saveTaskStates(storeId, states);
  return states[taskKey];
};

// Get custom assignments (encargos) for current week
export const getCustomAssignments = (storeId) => {
  const weekKey = getWeekKey();
  const storageKey = `customAssignments_${storeId}_${weekKey}`;
  const data = localStorage.getItem(storageKey);
  return data ? JSON.parse(data) : [];
};

// Add custom assignment
export const addCustomAssignment = (storeId, assignment) => {
  const assignments = getCustomAssignments(storeId);
  const newAssignment = {
    id: `custom_${Date.now()}`,
    ...assignment,
    createdAt: new Date().toISOString()
  };
  assignments.push(newAssignment);
  
  const weekKey = getWeekKey();
  const storageKey = `customAssignments_${storeId}_${weekKey}`;
  localStorage.setItem(storageKey, JSON.stringify(assignments));
  
  return newAssignment;
};

// Get task status for a specific day
export const getTaskStatus = (storeId, taskId, dayOfWeek) => {
  const states = getTaskStates(storeId);
  const taskKey = `${taskId}_${dayOfWeek}`;
  return states[taskKey] || { status: 'PENDING', history: [] };
};

// Helper: Get day of week (1=Monday, 7=Sunday)
export const getDayOfWeek = (date = new Date()) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

// Helper: Check if date is today
export const isToday = (dayOfWeek) => {
  return getDayOfWeek() === dayOfWeek;
};

// Helper: Check if date is in the past (within current week)
export const isPastDay = (dayOfWeek) => {
  return dayOfWeek < getDayOfWeek();
};
