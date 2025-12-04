import { createContext, useContext, useState, useEffect } from 'react';
import { fetchConfig, isApiConfigured } from '../services/api';

// Fallback tasks for offline/development mode
const FALLBACK_TASKS = [
  { id: 't1', label: 'Limpieza de Bandejas', category: 'Mañana', recurrence: '0', requiresPhoto: false, description: 'Limpiar todas las bandejas de exposición', targetStores: ['all'] },
  { id: 't2', label: 'Limpieza Mostrador', category: 'Mañana', recurrence: '0', requiresPhoto: false, description: 'Limpiar mostrador principal', targetStores: ['all'] },
  { id: 't3', label: 'Revisión Escaparate', category: 'Mañana', recurrence: '1', requiresPhoto: true, description: 'Revisar y fotografiar escaparate', targetStores: ['all'] },
  { id: 't4', label: 'Limpieza Puerta', category: 'Mañana', recurrence: '0', requiresPhoto: false, description: 'Limpiar cristales de la puerta', targetStores: ['all'] },
  { id: 't5', label: 'Limpieza Espejos', category: 'Dia', recurrence: '0', requiresPhoto: false, description: 'Limpiar todos los espejos', targetStores: ['all'] },
  { id: 't6', label: 'Aspirado Asientos', category: 'A fondo', recurrence: '36', requiresPhoto: false, description: 'Aspirar asientos (Miércoles y Sábado)', targetStores: ['all'] },
  { id: 't7', label: 'Basura / Cartón', category: 'Dia', recurrence: '0', requiresPhoto: false, description: 'Sacar basura y cartón', targetStores: ['all'] },
  { id: 't8', label: 'Antihurto', category: 'Mañana', recurrence: '123456', requiresPhoto: false, description: 'Revisar sistema antihurto', targetStores: ['all'] },
];

const FALLBACK_EMPLOYEES = [
  { id: '01', name: 'Juan García' },
  { id: '02', name: 'María López' },
  { id: '03', name: 'Pedro Martínez' },
  { id: '24', name: 'Jose Luis' },
  { id: '56', name: 'Josete' },
];

const ConfigContext = createContext(null);

export function ConfigProvider({ children, storeId }) {
  const [config, setConfig] = useState({
    tasks: [],
    employees: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    const loadConfig = async () => {
      if (!storeId) {
        setConfig(prev => ({ ...prev, loading: false }));
        return;
      }

      setConfig(prev => ({ ...prev, loading: true, error: null }));

      if (!isApiConfigured()) {
        console.log('[Config] API not configured, using fallback data');
        setConfig({
          tasks: FALLBACK_TASKS,
          employees: FALLBACK_EMPLOYEES,
          loading: false,
          error: null
        });
        return;
      }

      try {
        const result = await fetchConfig(storeId);
        
        if (result.success && result.tasks.length > 0) {
          setConfig({
            tasks: result.tasks,
            employees: result.employees,
            loading: false,
            error: null
          });
        } else {
          // Use fallback if API returns empty
          console.log('[Config] API returned empty, using fallback');
          setConfig({
            tasks: FALLBACK_TASKS,
            employees: FALLBACK_EMPLOYEES,
            loading: false,
            error: result.error || null
          });
        }
      } catch (error) {
        console.error('[Config] Error loading config:', error);
        setConfig({
          tasks: FALLBACK_TASKS,
          employees: FALLBACK_EMPLOYEES,
          loading: false,
          error: error.message
        });
      }
    };

    loadConfig();
  }, [storeId]);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

/**
 * Filter tasks for a specific day based on recurrence
 * @param {Array} tasks - All tasks
 * @param {number} dayOfWeek - ISO day (1=Monday, 7=Sunday)
 * @returns {Array} Tasks that should appear on this day
 * 
 * Supported recurrence formats:
 * - "daily" or "0" = show every day
 * - "123456" = numbers 1-7 (Monday=1, Sunday=7)
 * - "L,M,X,J,V,S,D" = Spanish day letters (comma separated or not)
 */
export function getTasksForDay(tasks, dayOfWeek) {
  // Map day number to Spanish letter
  const dayLetterMap = {
    1: 'L',  // Lunes
    2: 'M',  // Martes
    3: 'X',  // Miércoles
    4: 'J',  // Jueves
    5: 'V',  // Viernes
    6: 'S',  // Sábado
    7: 'D'   // Domingo
  };
  
  const dayLetter = dayLetterMap[dayOfWeek];
  const dayNumber = String(dayOfWeek);
  
  return tasks.filter(task => {
    const rec = String(task.recurrence || '0').toUpperCase().trim();
    
    // "daily" or "0" means every day
    if (rec === 'DAILY' || rec === '0' || rec === '') return true;
    
    // Check if it contains the day number (1-7)
    if (rec.includes(dayNumber)) return true;
    
    // Check if it contains the Spanish day letter (L,M,X,J,V,S,D)
    if (rec.includes(dayLetter)) return true;
    
    return false;
  });
}

/**
 * Get category badge color
 * @param {string} category - Task category
 * @returns {Object} Style object for badge
 */
export function getCategoryStyle(category) {
  switch (category) {
    case 'Mañana':
      return { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' };
    case 'Dia':
      return { background: '#dbeafe', color: '#1e40af', border: '1px solid #3b82f6' };
    case 'A fondo':
      return { background: '#fce7f3', color: '#9d174d', border: '1px solid #ec4899' };
    default:
      return { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
  }
}
