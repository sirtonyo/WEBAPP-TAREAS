import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getWeekDates,
  formatDateShort,
  getDayOfWeek,
  isToday,
  isPastDate,
  isFutureDate,
  getWeeklyTaskStates,
  updateWeeklyTaskState,
  getWeeklyAssignments,
  addWeeklyAssignment,
  syncFromApi,
  getWeekKey
} from '../services/weekService';
import { isApiConfigured } from '../services/api';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MAX_CHANGES = 4;

// Task Card Component - Industrial Style
function TaskCard({ task, date, dayIndex, taskState, onTaskClick, isCustom, isSelected }) {
  const isDone = taskState?.status === 'DONE';
  const isPast = isPastDate(date);
  const isTodayDate = isToday(date);
  const isFuture = isFutureDate(date);
  const isLocked = (taskState?.history?.length || 0) >= MAX_CHANGES;
  const isReadOnly = isPast && !isDone;

  let borderColor = '#d1d5db';
  let bgColor = '#f9fafb';
  let statusText = 'Pendiente';

  if (isDone) {
    borderColor = '#16a34a';
    bgColor = '#dcfce7';
    statusText = taskState.employee;
  } else if (isPast) {
    borderColor = '#f97316';
    bgColor = '#ffedd5';
    statusText = '⚠️ RETRASADA';
  } else if (isTodayDate) {
    borderColor = '#dc2626';
    bgColor = '#fee2e2';
    statusText = '🔴 URGENTE';
  }

  const handleClick = () => {
    if (isReadOnly) return;
    if (isLocked) {
      alert('Esta tarea ha alcanzado el límite de 3 cambios.');
      return;
    }
    onTaskClick(task, dayIndex + 1, date);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        width: '100%',
        padding: '6px 8px',
        marginBottom: '4px',
        background: bgColor,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '2px',
        cursor: isReadOnly ? 'not-allowed' : 'pointer',
        opacity: isReadOnly ? 0.6 : 1,
        fontSize: '11px',
        boxSizing: 'border-box',
        position: 'relative',
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '-2px'
      }}
    >
      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px', lineHeight: '1.2' }}>
        {isCustom ? '📋 ' : ''}{task.label}
      </div>
      <div style={{ 
        fontSize: '10px', 
        color: isDone ? '#166534' : isPast ? '#c2410c' : isTodayDate ? '#b91c1c' : '#6b7280'
      }}>
        {isDone ? `✓ ${statusText}` : statusText}
      </div>
      {isLocked && (
        <span style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '10px' }}>🔒</span>
      )}
      {task.requiresPhoto && !isDone && (
        <span style={{ position: 'absolute', top: '4px', right: isLocked ? '20px' : '4px', fontSize: '10px' }}>📷</span>
      )}
    </div>
  );
}

// Task Edit Modal with keyboard navigation
function TaskModal({ task, dayIndex, date, taskState, onClose, onUpdate }) {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const numberInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const submitBtnRef = useRef(null);
  const pendingBtnRef = useRef(null);
  
  const isDone = taskState?.status === 'DONE';
  const history = taskState?.history || [];
  const changesLeft = MAX_CHANGES - history.length;

  // Focus first input on mount
  useEffect(() => {
    if (!isDone && numberInputRef.current) {
      numberInputRef.current.focus();
    } else if (isDone && pendingBtnRef.current) {
      pendingBtnRef.current.focus();
    }
  }, [isDone]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleMarkDone = () => {
    const fullName = [employeeNumber, employeeName].filter(Boolean).join(' - ');
    if (!fullName.trim()) {
      alert('Introduce al menos el número o nombre del empleado');
      return;
    }
    onUpdate({ status: 'DONE', employee: fullName.trim() });
    onClose();
  };

  const handleMarkPending = () => {
    onUpdate({ status: 'PENDING', employee: null });
    onClose();
  };

  const handleNumberKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      nameInputRef.current?.focus();
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      submitBtnRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      numberInputRef.current?.focus();
    }
  };

  const handleSubmitKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMarkDone();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nameInputRef.current?.focus();
    }
  };

  const handlePendingKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMarkPending();
    }
  };

  const canSubmit = employeeNumber.trim() || employeeName.trim();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '4px',
        width: '400px',
        maxWidth: '90vw'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{task.label}</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#6b7280' }}>
          {DAYS[dayIndex]} - {formatDateShort(date)}
        </p>
        
        <div style={{
          background: changesLeft <= 1 ? '#fee2e2' : '#f3f4f6',
          padding: '8px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          Cambios restantes: <strong>{changesLeft}</strong> de {MAX_CHANGES}
        </div>

        {history.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '12px', margin: '0 0 8px 0', color: '#374151' }}>Historial:</h4>
            {history.map((h, i) => (
              <div key={i} style={{
                fontSize: '11px',
                padding: '4px 8px',
                background: '#f9fafb',
                borderLeft: `3px solid ${h.status === 'DONE' ? '#16a34a' : '#ef4444'}`,
                marginBottom: '4px'
              }}>
                {h.timestamp} - {h.employee} - {h.status === 'DONE' ? '✓ Hecha' : '○ Pendiente'}
              </div>
            ))}
          </div>
        )}

        {!isDone ? (
          <>
            <input
              ref={numberInputRef}
              type="text"
              placeholder="Nº Empleado"
              value={employeeNumber}
              onChange={e => setEmployeeNumber(e.target.value)}
              onKeyDown={handleNumberKeyDown}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                marginBottom: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Nombre"
              value={employeeName}
              onChange={e => setEmployeeName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <button
              ref={submitBtnRef}
              onClick={handleMarkDone}
              onKeyDown={handleSubmitKeyDown}
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '10px',
                background: canSubmit ? '#16a34a' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: canSubmit ? 'pointer' : 'not-allowed'
              }}
            >
              ✓ Marcar como HECHA (Enter)
            </button>
          </>
        ) : (
          <button
            ref={pendingBtnRef}
            onClick={handleMarkPending}
            onKeyDown={handlePendingKeyDown}
            style={{
              width: '100%',
              padding: '10px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ○ Marcar como PENDIENTE (Enter)
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '8px',
            background: 'transparent',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '12px',
            marginTop: '8px',
            cursor: 'pointer'
          }}
        >
          Cancelar (Esc)
        </button>
      </div>
    </div>
  );
}

// Warning Modal with keyboard support
function DayWarningModal({ targetDay, targetDate, onConfirm, onCancel }) {
  const todayName = DAYS[getDayOfWeek() - 1];
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onCancel}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '4px',
        width: '350px',
        textAlign: 'center'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ margin: '0 0 12px 0', color: '#f59e0b' }}>Atención</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#4b5563' }}>
          Estás modificando una tarea de <strong>{targetDay}</strong>,
          pero hoy es <strong>{todayName}</strong>.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{
            flex: 1,
            padding: '10px',
            background: '#e5e7eb',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>Cancelar (Esc)</button>
          <button ref={confirmBtnRef} onClick={onConfirm} style={{
            flex: 1,
            padding: '10px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}>Continuar (Enter)</button>
        </div>
      </div>
    </div>
  );
}

// PIN Modal with keyboard support
function PinModal({ onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);
  
  const handleSubmit = () => {
    if (pin === '1983') {
      onSuccess();
    } else {
      alert('PIN incorrecto');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onCancel}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '4px',
        width: '300px',
        textAlign: 'center'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0' }}>Acceso Manager</h3>
        <input
          ref={inputRef}
          type="password"
          placeholder="Introduce PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '16px',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}
        />
        <button onClick={handleSubmit} style={{
          width: '100%',
          padding: '10px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '600'
        }}>Confirmar (Enter)</button>
        <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>Pulsa Esc para cancelar</p>
      </div>
    </div>
  );
}

// Assignment Form Modal with keyboard navigation
function AssignmentModal({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ description: '', responsible: '', helper: '', dayOfWeek: getDayOfWeek() });
  const descRef = useRef(null);
  const respRef = useRef(null);
  const helperRef = useRef(null);
  const dayRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    descRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!form.description.trim() || !form.responsible.trim()) {
      alert('Completa descripción y responsable');
      return;
    }
    onSubmit(form);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onCancel}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '4px',
        width: '400px'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0' }}>Nuevo Encargo</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={descRef}
            type="text"
            placeholder="Descripción *"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            onKeyDown={e => (e.key === 'Enter' || e.key === 'ArrowDown') && (e.preventDefault(), respRef.current?.focus())}
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box' }}
          />
          <input
            ref={respRef}
            type="text"
            placeholder="Responsable *"
            value={form.responsible}
            onChange={e => setForm({ ...form, responsible: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); helperRef.current?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); descRef.current?.focus(); } }}
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box' }}
          />
          <input
            ref={helperRef}
            type="text"
            placeholder="Ayudante (opcional)"
            value={form.helper}
            onChange={e => setForm({ ...form, helper: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); dayRef.current?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); respRef.current?.focus(); } }}
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box' }}
          />
          <select
            ref={dayRef}
            value={form.dayOfWeek}
            onChange={e => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); submitRef.current?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); helperRef.current?.focus(); } }}
            style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', marginBottom: '16px', boxSizing: 'border-box' }}
          >
            {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
          </select>
          <button 
            ref={submitRef} 
            type="submit" 
            onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); dayRef.current?.focus(); } }}
            style={{
              width: '100%',
              padding: '10px',
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600'
          }}>Crear Encargo (Enter)</button>
        </form>
        <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>Pulsa Esc para cancelar</p>
      </div>
    </div>
  );
}

// Main Kanban Board with keyboard navigation
function KanbanBoard({ storeId, tasks }) {
  const [taskStates, setTaskStates] = useState(() => getWeeklyTaskStates(storeId));
  const [assignments, setAssignments] = useState(() => getWeeklyAssignments(storeId));
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading', 'synced', 'offline'
  
  // Keyboard navigation state
  const [focusedDay, setFocusedDay] = useState(getDayOfWeek() - 1);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(0);

  const weekDates = getWeekDates();
  const todayIndex = getDayOfWeek() - 1;

  // Sync from API on mount
  useEffect(() => {
    const loadFromApi = async () => {
      setSyncStatus('loading');
      const result = await syncFromApi(storeId);
      setTaskStates(result.taskStates);
      setAssignments(result.assignments);
      setSyncStatus(result.synced ? 'synced' : 'offline');
    };
    loadFromApi();
  }, [storeId]);

  // Filter tasks for store
  const filteredTasks = tasks.filter(t => 
    t.targetStores.includes('all') || t.targetStores.includes(storeId)
  );

  // Get all tasks for a specific day (including assignments)
  const getTasksForDay = useCallback((dayIndex) => {
    const dayTasks = filteredTasks.filter(t => t.days.includes(dayIndex + 1));
    const dayAssignments = assignments.filter(a => a.dayOfWeek === dayIndex + 1).map(a => ({
      id: a.id,
      label: a.description,
      responsible: a.responsible,
      isCustom: true
    }));
    return [...dayTasks, ...dayAssignments];
  }, [filteredTasks, assignments]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+R opens assignment modal
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setShowPinModal(true);
        return;
      }

      // Don't handle if a modal is open
      if (selectedTask || showPinModal || showAssignmentModal || pendingAction) return;

      const currentDayTasks = getTasksForDay(focusedDay);
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedDay(d => Math.max(0, d - 1));
          setFocusedTaskIndex(0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusedDay(d => Math.min(6, d + 1));
          setFocusedTaskIndex(0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedTaskIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedTaskIndex(i => Math.min(currentDayTasks.length - 1, i + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (currentDayTasks.length > 0 && focusedTaskIndex < currentDayTasks.length) {
            const task = currentDayTasks[focusedTaskIndex];
            const date = weekDates[focusedDay];
            const taskKey = `${task.id}_D${focusedDay + 1}`;
            const state = taskStates[taskKey];
            const isLocked = (state?.history?.length || 0) >= MAX_CHANGES;
            const isPast = isPastDate(date);
            const isDone = state?.status === 'DONE';
            const isReadOnly = isPast && !isDone;

            if (isReadOnly) return;
            if (isLocked) {
              alert('Esta tarea ha alcanzado el límite de 3 cambios.');
              return;
            }
            handleTaskClick(task, focusedDay + 1, date);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedDay, focusedTaskIndex, selectedTask, showPinModal, showAssignmentModal, pendingAction, getTasksForDay, weekDates, taskStates]);

  const handleTaskClick = (task, dayOfWeek, date) => {
    const dayIndex = dayOfWeek - 1;
    
    if (dayIndex !== todayIndex) {
      setPendingAction({ task, dayIndex, date });
    } else {
      setSelectedTask(task);
      setSelectedDayIndex(dayIndex);
      setSelectedDate(date);
    }
  };

  const handleWarningConfirm = () => {
    if (pendingAction) {
      setSelectedTask(pendingAction.task);
      setSelectedDayIndex(pendingAction.dayIndex);
      setSelectedDate(pendingAction.date);
      setPendingAction(null);
    }
  };

  const handleTaskUpdate = (updates) => {
    if (!selectedTask || selectedDayIndex === null) return;
    
    const taskKey = `${selectedTask.id}_D${selectedDayIndex + 1}`;
    const currentState = taskStates[taskKey] || { status: 'PENDING', history: [] };
    
    // Datos enriquecidos para logging forense
    const enrichedData = {
      ...updates,
      tareaLabel: selectedTask.label,
      dayName: DAYS[selectedDayIndex],
      prevStatus: currentState.status,
      editCount: (currentState.history?.length || 0) + 1
    };
    
    const updatedState = updateWeeklyTaskState(storeId, selectedTask.id, selectedDayIndex + 1, enrichedData);
    setTaskStates(prev => ({
      ...prev,
      [taskKey]: updatedState
    }));
  };

  const handleAddAssignment = (form) => {
    const newAssignment = addWeeklyAssignment(storeId, form);
    setAssignments(prev => [...prev, newAssignment]);
    setShowAssignmentModal(false);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2px',
      height: '100%',
      width: '100%',
      background: '#9ca3af'
    }}>
      {DAYS.map((day, dayIndex) => {
        const date = weekDates[dayIndex];
        const isTodayCol = dayIndex === todayIndex;
        const dayTasks = getTasksForDay(dayIndex);

        return (
          <div key={day} style={{
            display: 'flex',
            flexDirection: 'column',
            background: isTodayCol ? '#fefce8' : 'white',
            overflow: 'hidden'
          }}>
            {/* Column Header */}
            <div style={{
              padding: '8px',
              borderBottom: isTodayCol ? '3px solid #eab308' : '1px solid #e5e7eb',
              background: isTodayCol ? '#fef08a' : '#f9fafb',
              flexShrink: 0
            }}>
              <div style={{
                fontWeight: '700',
                fontSize: '12px',
                color: '#111827',
                textTransform: 'uppercase'
              }}>
                {day}
                {isTodayCol && <span style={{ marginLeft: '6px', background: '#dc2626', color: 'white', padding: '1px 6px', borderRadius: '2px', fontSize: '9px' }}>HOY</span>}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>
                {formatDateShort(date)}
              </div>
            </div>

            {/* Tasks */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px'
            }}>
              {dayTasks.map((task, taskIndex) => {
                const taskKey = `${task.id}_D${dayIndex + 1}`;
                const isSelected = focusedDay === dayIndex && focusedTaskIndex === taskIndex;
                
                return (
                  <TaskCard
                    key={taskKey}
                    task={task}
                    date={date}
                    dayIndex={dayIndex}
                    taskState={taskStates[taskKey]}
                    onTaskClick={handleTaskClick}
                    isCustom={task.isCustom}
                    isSelected={isSelected}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* FAB Button - Square */}
      <button
        onClick={() => setShowPinModal(true)}
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          width: '48px',
          height: '48px',
          borderRadius: '4px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 100
        }}
        title="Nuevo Encargo (Manager)"
      >+</button>

      {/* Sync status indicator */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        fontSize: '10px',
        color: '#6b7280',
        background: 'rgba(255,255,255,0.95)',
        padding: '6px 10px',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: syncStatus === 'synced' ? '#16a34a' : syncStatus === 'loading' ? '#f59e0b' : '#ef4444'
          }}></span>
          <span>
            {syncStatus === 'synced' ? 'Sincronizado' : syncStatus === 'loading' ? 'Cargando...' : 'Sin conexión'}
          </span>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
          ↑↓←→ Navegar | Enter Abrir | Alt+R Encargo | Esc Cerrar
        </div>
      </div>

      {/* Modals */}
      {pendingAction && (
        <DayWarningModal
          targetDay={DAYS[pendingAction.dayIndex]}
          targetDate={pendingAction.date}
          onConfirm={handleWarningConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {selectedTask && selectedDate && (
        <TaskModal
          task={selectedTask}
          dayIndex={selectedDayIndex}
          date={selectedDate}
          taskState={taskStates[`${selectedTask.id}_D${selectedDayIndex + 1}`]}
          onClose={() => { setSelectedTask(null); setSelectedDayIndex(null); setSelectedDate(null); }}
          onUpdate={handleTaskUpdate}
        />
      )}

      {showPinModal && (
        <PinModal
          onSuccess={() => { setShowPinModal(false); setShowAssignmentModal(true); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}

      {showAssignmentModal && (
        <AssignmentModal
          onSubmit={handleAddAssignment}
          onCancel={() => setShowAssignmentModal(false)}
        />
      )}
    </div>
  );
}

export default KanbanBoard;
