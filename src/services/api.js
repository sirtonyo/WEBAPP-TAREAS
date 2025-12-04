// API Service - Google Apps Script Backend Connection
// Hardcoded URL for testing - replace with your actual Google Apps Script URL
const API_URL = import.meta.env.VITE_API_URL || 'PEGUE_AQUI_LA_URL_DE_GOOGLE';

/**
 * Fetch weekly status from backend
 * @param {string} storeId - Store identifier (e.g., 'T1', 'T2')
 * @param {string} weekId - Week identifier (e.g., '2025-W49')
 * @returns {Promise<Object>} Task states and assignments
 */
export const fetchWeeklyStatus = async (storeId, weekId) => {
  try {
    const url = `${API_URL}?action=read&storeId=${encodeURIComponent(storeId)}&weekId=${encodeURIComponent(weekId)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Expected response format:
    // {
    //   success: true,
    //   taskStates: { "T1_D1": { status: "DONE", employee: "123 - Juan", history: [...] }, ... },
    //   assignments: [ { id: "custom_xxx", description: "...", ... }, ... ]
    // }
    
    return {
      taskStates: data.taskStates || {},
      assignments: data.assignments || [],
      synced: true
    };
  } catch (error) {
    console.error('[API] Error fetching weekly status:', error);
    // Return empty data on error - let local storage be fallback
    return {
      taskStates: {},
      assignments: [],
      synced: false,
      error: error.message
    };
  }
};

/**
 * Save task state to backend
 * @param {Object} taskData - Task data to save
 * @returns {Promise<Object>} Response from server
 */
export const saveTask = async (taskData) => {
  try {
    const payload = {
      action: 'saveTask',
      ...taskData
    };
    
    // Debug para verificar payload completo
    console.log('[API] Enviando Payload Completo:', payload);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        // text/plain evita preflight CORS con Google Apps Script
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[API] Error saving task:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save assignment to backend
 * @param {Object} assignmentData - Assignment data to save
 * @returns {Promise<Object>} Response from server
 */
export const saveAssignment = async (assignmentData) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        // text/plain evita preflight CORS con Google Apps Script
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'saveAssignment',
        ...assignmentData
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[API] Error saving assignment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if API is configured and available
 * @returns {boolean}
 */
export const isApiConfigured = () => {
  return API_URL && API_URL !== 'PEGUE_AQUI_LA_URL_DE_GOOGLE';
};

/**
 * Fetch configuration (tasks and employees) from backend
 * @param {string} storeId - Store identifier (e.g., 'T1', 'T2')
 * @returns {Promise<Object>} Configuration data { tasks: [...], employees: [...] }
 */
export const fetchConfig = async (storeId) => {
  try {
    const url = `${API_URL}?action=getConfig&storeId=${encodeURIComponent(storeId)}`;
    
    console.log('[API] Fetching config for store:', storeId);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('[API] Config received:', data);
    console.log('[API] Tasks count:', data.tasks?.length || 0);
    console.log('[API] Employees count:', data.employees?.length || 0);
    
    // Expected response format:
    // {
    //   success: true,
    //   tasks: [{ id, label, category, recurrence, requiresPhoto, description, targetStores }, ...],
    //   employees: [{ id, name }, ...]
    // }
    
    return {
      tasks: data.tasks || [],
      employees: data.employees || [],
      success: data.success === true && (data.tasks?.length > 0 || data.employees?.length > 0)
    };
  } catch (error) {
    console.error('[API] Error fetching config:', error);
    return {
      tasks: [],
      employees: [],
      success: false,
      error: error.message
    };
  }
};

/**
 * Get the current API URL (for debugging)
 * @returns {string}
 */
export const getApiUrl = () => API_URL;
