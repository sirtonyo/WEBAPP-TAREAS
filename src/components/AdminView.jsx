import { useState, useEffect, useCallback } from 'react';
import { getWeekKey, getMondayOfWeek, formatDateShort } from '../services/weekService';
import { STORES } from './ConfigScreen';
import { getTasksForDay } from '../contexts/ConfigContext';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const API_URL = import.meta.env.VITE_API_URL || '';

// Fetch logs from Sheet for a specific week
const fetchLogsFromSheet = async (weekId) => {
  if (!API_URL) {
    console.error('[Admin] API URL not configured');
    return { logs: [], tasks: [] };
  }
  
  try {
    // Fetch both logs and config in parallel
    const [logsResponse, configResponse] = await Promise.all([
      fetch(`${API_URL}?action=getLogs&weekId=${encodeURIComponent(weekId)}`),
      fetch(`${API_URL}?action=getConfig`)
    ]);
    
    const logsData = await logsResponse.json();
    const configData = await configResponse.json();
    
    console.log('[Admin] Logs count:', logsData.logs?.length || 0);
    console.log('[Admin] Tasks config count:', configData.tasks?.length || 0);
    
    return {
      logs: logsData.logs || [],
      tasks: configData.tasks || [],
      employees: configData.employees || []
    };
  } catch (error) {
    console.error('[Admin] Error fetching data:', error);
    return { logs: [], tasks: [], employees: [] };
  }
};

// Process logs to get current state of each task per store/day
const processLogsToState = (logs, allTasks) => {
  const storeStates = {};
  
  // Initialize stores with ALL tasks for each day
  STORES.forEach(store => {
    storeStates[store.id] = {
      name: store.name,
      days: {},
      closedDays: {}
    };
    
    DAYS.forEach((day, dayIdx) => {
      const dayNumber = dayIdx + 1;
      // Get tasks for this day using recurrence logic
      const dayTasks = getTasksForDay(allTasks, dayNumber);
      // Filter by store
      const storeTasks = dayTasks.filter(t => 
        !t.targetStores || t.targetStores.includes('all') || t.targetStores.includes(store.id)
      );
      
      // Initialize all tasks as PENDING
      const tasksMap = {};
      storeTasks.forEach(task => {
        tasksMap[task.id] = {
          label: task.label,
          status: 'PENDING',
          employee: '-',
          isEncargo: false,
          category: task.category
        };
      });
      
      storeStates[store.id].days[day] = {
        tasks: tasksMap,
        notes: 0,
        notesUnread: 0
      };
    });
  });
  
  // Process logs to UPDATE task states (logs override initial PENDING state)
  logs.forEach(log => {
    const { storeId, dayName, taskId, status, employee, tareaLabel } = log;
    
    if (!storeStates[storeId]) return;
    if (!dayName || !DAYS.includes(dayName)) return;
    
    // Handle special task types
    if (taskId === 'CIERRE') {
      storeStates[storeId].closedDays[dayName] = {
        closed: true,
        employee,
        label: tareaLabel
      };
    } else if (taskId === 'ROLLBACK') {
      storeStates[storeId].closedDays[dayName] = {
        closed: false,
        reopened: true,
        employee
      };
    } else if (taskId === 'NOTA') {
      storeStates[storeId].days[dayName].notes++;
    } else {
      // Regular task or encargo - update existing or add new
      storeStates[storeId].days[dayName].tasks[taskId] = {
        label: tareaLabel || storeStates[storeId].days[dayName].tasks[taskId]?.label || taskId,
        status,
        employee,
        isEncargo: taskId === 'ENCARGO'
      };
    }
  });
  
  return storeStates;
};

// Calculate summary stats for a store
const calculateStoreSummary = (storeData) => {
  let totalTasks = 0;
  let completedTasks = 0;
  let incompleteTasks = 0;
  let pendingTasks = 0;
  let closedDays = 0;
  
  DAYS.forEach(day => {
    const dayData = storeData.days[day];
    Object.values(dayData.tasks).forEach(task => {
      totalTasks++;
      if (task.status === 'DONE') completedTasks++;
      else if (task.status === 'CIERRE_INCOMPLETO') incompleteTasks++;
      else pendingTasks++;
    });
    
    if (storeData.closedDays[day]?.closed) closedDays++;
  });
  
  return { totalTasks, completedTasks, incompleteTasks, pendingTasks, closedDays };
};

function AdminView({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storeStates, setStoreStates] = useState({});
  const [selectedStore, setSelectedStore] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const weekKey = getWeekKey();
  const monday = getMondayOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { logs, tasks } = await fetchLogsFromSheet(weekKey);
      const states = processLogsToState(logs, tasks);
      setStoreStates(states);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Error al cargar datos del servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Status color helper
  const getStatusStyle = (status) => {
    switch (status) {
      case 'DONE':
        return { bg: '#dcfce7', border: '#16a34a', text: '#166534' };
      case 'CIERRE_INCOMPLETO':
        return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
      case 'PENDING':
      default:
        return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
    }
  };

  if (loading && Object.keys(storeStates).length === 0) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1f2937',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div>Cargando datos de todas las tiendas...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#111827',
      color: 'white'
    }}>
      {/* Header */}
      <header style={{
        background: '#7c3aed',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ← Salir
          </button>
          <span style={{ fontWeight: '700', fontSize: '18px' }}>🔐 PANEL ADMIN</span>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>
            Semana {weekKey} | {formatDateShort(monday)} - {formatDateShort(sunday)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdate && (
            <span style={{ fontSize: '11px', opacity: 0.7 }}>
              Actualizado: {lastUpdate.toLocaleTimeString('es-ES')}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: loading ? '#6b7280' : 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{
          background: '#dc2626',
          color: 'white',
          padding: '8px 16px',
          fontSize: '13px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {!selectedStore ? (
          // Store Overview Grid
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {STORES.map(store => {
              const storeData = storeStates[store.id];
              const summary = storeData ? calculateStoreSummary(storeData) : null;
              
              return (
                <div
                  key={store.id}
                  onClick={() => setSelectedStore(store.id)}
                  style={{
                    background: '#1f2937',
                    borderRadius: '8px',
                    padding: '20px',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#f3f4f6' }}>
                    📋 {store.name}
                  </h3>
                  
                  {summary ? (
                    <>
                      {/* Progress bar */}
                      <div style={{
                        background: '#374151',
                        borderRadius: '4px',
                        height: '8px',
                        marginBottom: '12px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          background: '#16a34a',
                          height: '100%',
                          width: `${summary.totalTasks > 0 ? (summary.completedTasks / summary.totalTasks) * 100 : 0}%`,
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#9ca3af' }}>✓ Completadas:</span>
                          <span style={{ color: '#16a34a', marginLeft: '8px', fontWeight: '600' }}>
                            {summary.completedTasks}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#9ca3af' }}>○ Pendientes:</span>
                          <span style={{ color: '#f59e0b', marginLeft: '8px', fontWeight: '600' }}>
                            {summary.pendingTasks}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#9ca3af' }}>⚠️ Incompletas:</span>
                          <span style={{ color: '#dc2626', marginLeft: '8px', fontWeight: '600' }}>
                            {summary.incompleteTasks}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#9ca3af' }}>Días cerrados:</span>
                          <span style={{ color: '#7c3aed', marginLeft: '8px', fontWeight: '600' }}>
                            {summary.closedDays}/7
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#6b7280', fontSize: '13px' }}>
                      Sin datos para esta semana
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Store Detail View
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setSelectedStore(null)}
                style={{
                  background: '#374151',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ← Volver a tiendas
              </button>
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {STORES.find(s => s.id === selectedStore)?.name}
              </h2>
            </div>
            
            {/* Days grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px'
            }}>
              {DAYS.map((day, dayIdx) => {
                const dayData = storeStates[selectedStore]?.days[day];
                const isClosed = storeStates[selectedStore]?.closedDays[day]?.closed;
                const tasks = dayData ? Object.entries(dayData.tasks) : [];
                
                return (
                  <div
                    key={day}
                    style={{
                      background: isClosed ? '#1e3a2e' : '#1f2937',
                      borderRadius: '8px',
                      padding: '12px',
                      minHeight: '200px'
                    }}
                  >
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{day}</span>
                      {isClosed && (
                        <span style={{
                          background: '#16a34a',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          CERRADO
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {tasks.length === 0 ? (
                        <div style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>
                          Sin registros
                        </div>
                      ) : (
                        tasks.map(([taskId, task]) => {
                          const style = getStatusStyle(task.status);
                          return (
                            <div
                              key={taskId}
                              style={{
                                background: style.bg,
                                borderLeft: `3px solid ${style.border}`,
                                padding: '4px 6px',
                                borderRadius: '2px',
                                fontSize: '10px'
                              }}
                            >
                              <div style={{ color: style.text, fontWeight: '600' }}>
                                {task.isEncargo ? '📋 ' : ''}{task.label?.substring(0, 30) || taskId}
                              </div>
                              {task.status !== 'PENDING' && (
                                <div style={{ color: '#6b7280', fontSize: '9px' }}>
                                  {task.status === 'DONE' ? '✓' : '⚠️'} {task.employee}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer style={{
        background: '#1f2937',
        padding: '8px 16px',
        fontSize: '11px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Panel de Administración - Solo lectura | Auto-actualización cada 30s
      </footer>
    </div>
  );
}

export default AdminView;
