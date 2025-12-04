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
  getWeekKey,
  isDayClosed,
  saveDailyClose,
  unlockDay
} from '../services/weekService';
import { isApiConfigured, saveTask } from '../services/api';
import { useConfig, getTasksForDay, getCategoryStyle } from '../contexts/ConfigContext';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MAX_CHANGES = 4;

// Task Card Component - Industrial Style with Category Badge
function TaskCard({ task, date, dayIndex, taskState, onTaskClick, isCustom, isSelected, onShowInfo, dayClosed }) {
  const isDone = taskState?.status === 'DONE';
  const isPast = isPastDate(date);
  const isTodayDate = isToday(date);
  const isFuture = isFutureDate(date);
  const isLocked = (taskState?.history?.length || 0) >= MAX_CHANGES;
  const isReadOnly = (isPast && !isDone) || dayClosed;

  // Estado y colores según lógica de semáforo
  let borderColor = '#d1d5db';  // Gris default
  let bgColor = '#f9fafb';
  let statusText = 'Pendiente';
  let statusIcon = '';

  if (isDone) {
    // ✅ COMPLETADA - Verde
    borderColor = '#16a34a';
    bgColor = '#dcfce7';
    statusIcon = '✓';
    statusText = taskState.employee;
  } else if (isPast) {
    // 🔴 RETRASADA - Día pasado sin completar - Rojo
    borderColor = '#dc2626';
    bgColor = '#fee2e2';
    statusIcon = '⚠️';
    statusText = 'RETRASADA';
  } else if (isTodayDate) {
    // 🟠 PENDIENTE HOY - Naranja (urgencia moderada)
    borderColor = '#f97316';
    bgColor = '#fff7ed';
    statusIcon = '';
    statusText = 'Pendiente';
  } else {
    // ⚪ PENDIENTE FUTURO - Gris
    borderColor = '#d1d5db';
    bgColor = '#f9fafb';
    statusIcon = '';
    statusText = 'Pendiente';
  }

  const handleClick = () => {
    if (dayClosed) {
      alert('Este día ya está cerrado. No se pueden modificar las tareas.');
      return;
    }
    if (isReadOnly) return;
    if (isLocked) {
      alert('Esta tarea ha alcanzado el límite de 4 cambios.');
      return;
    }
    onTaskClick(task, dayIndex + 1, date);
  };

  const handleInfoClick = (e) => {
    e.stopPropagation();
    onShowInfo(task);
  };

  const categoryStyle = getCategoryStyle(task.category);

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
        fontSize: '12px',
        boxSizing: 'border-box',
        position: 'relative',
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '-2px'
      }}
    >
      {/* Category Badge */}
      {task.category && !isCustom && (
        <span style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          fontSize: '9px',
          padding: '1px 4px',
          borderRadius: '2px',
          ...categoryStyle
        }}>
          {task.category}
        </span>
      )}
      
      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px', lineHeight: '1.2', paddingRight: '45px' }}>
        {isCustom ? '📋 ' : ''}{task.label}
      </div>
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px', 
        color: isDone ? '#166534' : isPast ? '#b91c1c' : isTodayDate ? '#c2410c' : '#6b7280'
      }}>
        <span>{statusIcon} {statusText}</span>
        {/* Info icon */}
        {task.description && (
          <button
            onClick={handleInfoClick}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 2px',
              cursor: 'pointer',
              fontSize: '11px',
              color: '#6b7280'
            }}
            title="Ver descripción"
          >ℹ️</button>
        )}
      </div>
      {isLocked && (
        <span style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '11px' }}>🔒</span>
      )}
      {task.requiresPhoto && !isDone && (
        <span style={{ position: 'absolute', bottom: '4px', right: isLocked ? '20px' : '4px', fontSize: '11px' }}>📷</span>
      )}
    </div>
  );
}

// Task Edit Modal with employee selector
function TaskModal({ task, dayIndex, date, taskState, onClose, onUpdate, employees }) {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const selectRef = useRef(null);
  const submitBtnRef = useRef(null);
  const pendingBtnRef = useRef(null);
  
  const isDone = taskState?.status === 'DONE';
  const history = taskState?.history || [];
  const changesLeft = MAX_CHANGES - history.length;

  // Focus select on mount - always focus select since we now need employee for both actions
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.focus();
    }
  }, []);

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
    if (!selectedEmployee) {
      alert('Selecciona un empleado');
      return;
    }
    onUpdate({ status: 'DONE', employee: selectedEmployee });
    // Close modal immediately after update
    setTimeout(() => onClose(), 0);
  };

  const handleMarkPending = () => {
    if (!selectedEmployee) {
      alert('Selecciona un empleado');
      return;
    }
    onUpdate({ status: 'PENDING', employee: selectedEmployee });
    // Close modal immediately after update
    setTimeout(() => onClose(), 0);
  };

  const handleSelectKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedEmployee) {
        if (isDone) {
          handleMarkPending();
        } else {
          handleMarkDone();
        }
      } else {
        submitBtnRef.current?.focus();
      }
    } else if (e.key === 'ArrowDown' && e.altKey) {
      // Let default behavior open dropdown
    }
  };

  const handleSubmitKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMarkDone();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectRef.current?.focus();
    }
  };

  const handlePendingKeyDown = (e) => {
    if (e.key === 'Enter' && selectedEmployee) {
      e.preventDefault();
      handleMarkPending();
    }
  };

  const canSubmit = !!selectedEmployee;

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
        <h3 style={{ margin: '0 0 8px 0', fontSize: '17px' }}>{task.label}</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
          {DAYS[dayIndex]} - {formatDateShort(date)}
        </p>
        
        <div style={{
          background: changesLeft <= 1 ? '#fee2e2' : '#f3f4f6',
          padding: '8px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          Cambios restantes: <strong>{changesLeft}</strong> de {MAX_CHANGES}
        </div>

        {history.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', margin: '0 0 8px 0', color: '#374151' }}>Historial:</h4>
            {history.map((h, i) => (
              <div key={i} style={{
                fontSize: '12px',
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

        {/* Employee selector - always shown */}
        <select
          ref={selectRef}
          value={selectedEmployee}
          onChange={e => setSelectedEmployee(e.target.value)}
          onKeyDown={handleSelectKeyDown}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '15px',
            boxSizing: 'border-box',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="">-- Selecciona empleado --</option>
          {employees.map(emp => (
            <option key={emp.id} value={`${emp.id} - ${emp.name}`}>
              {emp.id} - {emp.name}
            </option>
          ))}
        </select>
        
        {!isDone ? (
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
              fontSize: '15px',
              fontWeight: '600',
              cursor: canSubmit ? 'pointer' : 'not-allowed'
            }}
          >
            ✓ Marcar como HECHA (Enter)
          </button>
        ) : (
          <button
            ref={pendingBtnRef}
            onClick={handleMarkPending}
            onKeyDown={handlePendingKeyDown}
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '10px',
              background: canSubmit ? '#dc2626' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: canSubmit ? 'pointer' : 'not-allowed'
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

// Confirmation Modal for daily close
function ConfirmCloseModal({ onConfirm, onCancel, isProcessing }) {
  const confirmBtnRef = useRef(null);
  const [ready, setReady] = useState(false);
  
  // Small delay to prevent the Enter key that opened this modal from triggering confirm
  useEffect(() => {
    confirmBtnRef.current?.focus();
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    if (!ready || isProcessing) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel, ready, isProcessing]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }} onClick={isProcessing ? undefined : onCancel}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '4px',
        width: '350px',
        textAlign: 'center'
      }} onClick={e => e.stopPropagation()}>
        {isProcessing ? (
          <>
            <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <h3 style={{ margin: '0 0 12px 0', color: '#6b7280' }}>Procesando cierre...</h3>
            <p style={{ margin: '0', fontSize: '14px', color: '#9ca3af' }}>
              Por favor espere, esto puede tardar unos segundos.
            </p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 12px 0', color: '#dc2626' }}>Confirmar cierre</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#4b5563' }}>
              Va a cerrar las tareas del día.<br/>
              <strong>Esta acción no se puede deshacer.</strong><br/>
              ¿Está seguro?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onCancel} style={{
                flex: 1,
                padding: '10px',
                background: '#e5e7eb',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>No (Esc)</button>
              <button ref={confirmBtnRef} onClick={onConfirm} style={{
                flex: 1,
                padding: '10px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}>Sí (Enter)</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Daily Close Modal - Cierre diario de tareas
function DailyCloseModal({ incompleteTasks, employees, onClose, onConfirm }) {
  const [reasons, setReasons] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const selectRef = useRef(null);
  const inputRefs = useRef([]);
  
  const allTasksComplete = incompleteTasks.length === 0;
  const hasIncomplete = incompleteTasks.length > 0;
  
  // Focus on first element
  useEffect(() => {
    if (allTasksComplete && selectRef.current) {
      selectRef.current.focus();
    } else if (hasIncomplete && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [allTasksComplete, hasIncomplete]);

  // Handle global Escape (only if confirm modal not showing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !showConfirm) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showConfirm]);

  const handleReasonChange = (taskId, reason) => {
    setReasons(prev => ({ ...prev, [taskId]: reason }));
  };

  const handleInputKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Go to next input or to employee select
      if (index < incompleteTasks.length - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        selectRef.current?.focus();
      }
    }
  };

  const handleSelectKeyDown = (e) => {
    if (e.key === 'Enter' && selectedEmployee) {
      e.preventDefault();
      trySubmit();
    }
  };

  const trySubmit = () => {
    if (hasIncomplete) {
      const allReasonsFilled = incompleteTasks.every(t => reasons[t.id]?.trim());
      if (!allReasonsFilled) {
        alert('Por favor, indica el motivo de cada tarea no completada');
        return;
      }
      if (!selectedEmployee) {
        alert('Selecciona quién firma el cierre');
        return;
      }
    } else if (!selectedEmployee) {
      alert('Selecciona quién firma el cierre');
      return;
    }
    // Show confirmation modal
    setShowConfirm(true);
  };

  const handleFinalConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm({ 
        reasons, 
        employee: selectedEmployee,
        incompleteTasks 
      });
    } catch (error) {
      console.error('[DailyCloseModal] Error:', error);
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
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
          width: '500px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }} onClick={e => e.stopPropagation()}>
          
          {allTasksComplete ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#166534' }}>¡Todas las tareas completadas!</h3>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
                  ¿Desea cerrar las tareas por el día de hoy?
                </p>
                <p style={{ margin: '8px 0 0 0', color: '#dc2626', fontSize: '12px', fontWeight: '600' }}>
                  ⚠️ Recuerde que no podrá modificar ninguna tarea a partir de ese momento
                </p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Firma del cierre:
                </label>
                <select
                  ref={selectRef}
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  onKeyDown={handleSelectKeyDown}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Selecciona empleado --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={`${emp.id} - ${emp.name}`}>
                      {emp.id} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onClose} style={{
                  flex: 1,
                  padding: '10px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>Cancelar (Esc)</button>
                <button 
                  onClick={trySubmit}
                  disabled={!selectedEmployee}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: selectedEmployee ? '#16a34a' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: selectedEmployee ? 'pointer' : 'not-allowed',
                    fontWeight: '600'
                  }}
                >Confirmar Cierre (Enter)</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>⚠️ Tareas sin completar</h3>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '13px' }}>
                  Indica el motivo por el que no se finalizó cada tarea:
                </p>
              </div>
              
              <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                {incompleteTasks.map((task, index) => (
                  <div key={task.id} style={{
                    padding: '12px',
                    background: '#fef2f2',
                    borderLeft: '3px solid #dc2626',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#991b1b' }}>
                      {task.label}
                    </div>
                    <input
                      ref={el => inputRefs.current[index] = el}
                      type="text"
                      placeholder="¿Por qué no se finalizó?"
                      value={reasons[task.id] || ''}
                      onChange={e => handleReasonChange(task.id, e.target.value)}
                      onKeyDown={e => handleInputKeyDown(e, index)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #fca5a5',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Firma del cierre:
                </label>
                <select
                  ref={selectRef}
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  onKeyDown={handleSelectKeyDown}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Selecciona empleado --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={`${emp.id} - ${emp.name}`}>
                      {emp.id} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onClose} style={{
                  flex: 1,
                  padding: '10px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>Cancelar (Esc)</button>
                <button 
                  onClick={trySubmit}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >Cerrar con incidencias (Enter)</button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Confirmation sub-modal */}
      {showConfirm && (
        <ConfirmCloseModal
          onConfirm={handleFinalConfirm}
          onCancel={() => setShowConfirm(false)}
          isProcessing={isProcessing}
        />
      )}
    </>
  );
}

// Main Kanban Board with keyboard navigation
function KanbanBoard({ storeId }) {
  const { tasks, employees, loading: configLoading } = useConfig();
  const [taskStates, setTaskStates] = useState(() => getWeeklyTaskStates(storeId));
  const [assignments, setAssignments] = useState(() => getWeeklyAssignments(storeId));
  const [closedDays, setClosedDays] = useState(() => {
    // Initialize closed days state
    const closed = {};
    for (let i = 1; i <= 7; i++) {
      closed[i] = isDayClosed(storeId, i);
    }
    return closed;
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showDailyCloseModal, setShowDailyCloseModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [infoTask, setInfoTask] = useState(null); // For info modal
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

  // Filter tasks for store AND day using imported getTasksForDay
  const getDayTasks = useCallback((dayIndex) => {
    // Use ConfigContext's getTasksForDay to filter by recurrence, then filter by store
    const dayNumber = dayIndex + 1; // 1-7
    const tasksForDay = getTasksForDay(tasks, dayNumber);
    const storeTasks = tasksForDay.filter(t => 
      !t.targetStores || t.targetStores.includes('all') || t.targetStores.includes(storeId)
    );
    
    // Add assignments for this day
    const dayAssignments = assignments.filter(a => a.dayOfWeek === dayNumber).map(a => ({
      id: a.id,
      label: a.description,
      responsible: a.responsible,
      isCustom: true
    }));
    return [...storeTasks, ...dayAssignments];
  }, [tasks, storeId, assignments]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes info modal or daily close modal
      if (e.key === 'Escape') {
        if (infoTask) {
          setInfoTask(null);
          return;
        }
        if (showDailyCloseModal) {
          setShowDailyCloseModal(false);
          return;
        }
      }

      // Ctrl+C opens daily close modal (only if today is not already closed)
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (closedDays[todayIndex + 1]) {
          alert('El día de hoy ya está cerrado.');
          return;
        }
        setShowDailyCloseModal(true);
        return;
      }

      // Ctrl+Shift+U unlocks today (requires PIN)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        if (!closedDays[todayIndex + 1]) {
          alert('El día de hoy no está cerrado.');
          return;
        }
        const pin = prompt('Introduce el PIN del manager para desbloquear el día:');
        if (pin === '1983') {
          unlockDay(storeId, todayIndex + 1);
          setClosedDays(prev => ({ ...prev, [todayIndex + 1]: false }));
          alert('✅ Día desbloqueado. Ya puede modificar las tareas.');
        } else if (pin !== null) {
          alert('❌ PIN incorrecto');
        }
        return;
      }

      // Alt+R opens assignment modal
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setShowPinModal(true);
        return;
      }

      // Don't handle if a modal is open
      if (selectedTask || showPinModal || showAssignmentModal || pendingAction || infoTask || showDailyCloseModal) return;

      const currentDayTasks = getDayTasks(focusedDay);
      
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
        case 'i':
        case 'I':
          // Show info for focused task
          e.preventDefault();
          if (currentDayTasks.length > 0 && focusedTaskIndex < currentDayTasks.length) {
            const task = currentDayTasks[focusedTaskIndex];
            setInfoTask(task);
          }
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
            const dayIsClosed = closedDays[focusedDay + 1];
            const isReadOnly = (isPast && !isDone) || dayIsClosed;

            if (dayIsClosed) {
              alert('Este día ya está cerrado. No se pueden modificar las tareas.');
              return;
            }
            if (isReadOnly) return;
            if (isLocked) {
              alert('Esta tarea ha alcanzado el límite de 4 cambios.');
              return;
            }
            handleTaskClick(task, focusedDay + 1, date);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedDay, focusedTaskIndex, selectedTask, showPinModal, showAssignmentModal, showDailyCloseModal, pendingAction, infoTask, getDayTasks, weekDates, taskStates, closedDays]);

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

  // Ref for preventing duplicate assignment submissions
  const addingAssignmentRef = useRef(false);
  const handleAddAssignment = (form) => {
    // Prevent duplicate submissions
    if (addingAssignmentRef.current) {
      console.log('[Assignment] Already processing, ignoring duplicate call');
      return;
    }
    addingAssignmentRef.current = true;
    
    try {
      const newAssignment = addWeeklyAssignment(storeId, form);
      setAssignments(prev => [...prev, newAssignment]);
      setShowAssignmentModal(false);
      // Note: Logging is handled by addWeeklyAssignment in weekService.js
    } finally {
      // Reset after a short delay to allow UI to update
      setTimeout(() => {
        addingAssignmentRef.current = false;
      }, 500);
    }
  };

  // Get incomplete tasks for today
  const getTodayIncompleteTasks = useCallback(() => {
    const todayTasks = getDayTasks(todayIndex);
    return todayTasks.filter(task => {
      const taskKey = `${task.id}_D${todayIndex + 1}`;
      const state = taskStates[taskKey];
      return state?.status !== 'DONE';
    });
  }, [getDayTasks, todayIndex, taskStates]);

  // Handle daily close - with duplicate protection
  const closingRef = useRef(false);
  const handleDailyClose = async (closeData) => {
    // Prevent duplicate calls (e.g., from React StrictMode or double-click)
    if (closingRef.current) {
      console.log('[DailyClose] Already processing, ignoring duplicate call');
      return;
    }
    closingRef.current = true;
    
    const { reasons, employee, incompleteTasks } = closeData;
    const weekId = getWeekKey();
    const dayName = DAYS[todayIndex];
    
    try {
      // If there are incomplete tasks, log each with its reason
      if (incompleteTasks && incompleteTasks.length > 0) {
        for (const task of incompleteTasks) {
          await saveTask({
            action: 'saveTask',
            weekId,
            dayName,
            storeId,
            employee,
            taskId: task.id,
            tareaLabel: task.label,
            prevStatus: 'PENDING',
            status: 'CIERRE_INCOMPLETO',
            editCount: 1,
            obs: reasons[task.id] || ''
          });
        }
      }
      
      // Log the daily close action
      await saveTask({
        action: 'saveTask',
        weekId,
        dayName,
        storeId,
        employee,
        taskId: 'CIERRE',
        tareaLabel: incompleteTasks?.length > 0 ? `Cierre con ${incompleteTasks.length} incidencias` : 'Cierre completo',
        prevStatus: '',
        status: 'CIERRE',
        editCount: 1,
        obs: ''
      });
      
      // Save close status to localStorage and update state
      saveDailyClose(storeId, todayIndex + 1, employee);
      setClosedDays(prev => ({ ...prev, [todayIndex + 1]: true }));
      
      setShowDailyCloseModal(false);
      alert('✅ Cierre diario registrado correctamente. Las tareas de hoy ya no se pueden modificar.');
    } catch (error) {
      console.error('[DailyClose] Error:', error);
      alert('Error al registrar el cierre. Por favor, inténtalo de nuevo.');
    } finally {
      closingRef.current = false;
    }
  };

  // Show loading state while config loads
  if (configLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: '#f3f4f6'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
          <div>Cargando configuración...</div>
        </div>
      </div>
    );
  }

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
        const dayTasks = getDayTasks(dayIndex);

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
                fontSize: '13px',
                color: '#111827',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {day}
                {isTodayCol && !closedDays[dayIndex + 1] && <span style={{ background: '#dc2626', color: 'white', padding: '1px 6px', borderRadius: '2px', fontSize: '10px' }}>HOY</span>}
                {closedDays[dayIndex + 1] && <span style={{ background: '#6b7280', color: 'white', padding: '1px 6px', borderRadius: '2px', fontSize: '10px' }}>🔒 CERRADO</span>}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
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
                    onShowInfo={(t) => setInfoTask(t)}
                    isCustom={task.isCustom}
                    isSelected={isSelected}
                    dayClosed={closedDays[dayIndex + 1]}
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
          ←→↑↓ Navegar | Enter Abrir | i Info | Ctrl+C Cierre | Esc Cerrar
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
          employees={employees}
        />
      )}

      {/* Info Modal for task description */}
      {infoTask && (
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
        }} onClick={() => setInfoTask(null)}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '4px',
            width: '400px',
            maxWidth: '90vw'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{infoTask.label}</h3>
            {infoTask.category && (
              <span style={{
                ...getCategoryStyle(infoTask.category),
                display: 'inline-block',
                marginBottom: '12px'
              }}>{infoTask.category}</span>
            )}
            <p style={{ 
              margin: '0 0 16px 0', 
              fontSize: '14px', 
              color: '#374151',
              lineHeight: '1.5'
            }}>
              {infoTask.description || 'Sin descripción disponible'}
            </p>
            <button
              onClick={() => setInfoTask(null)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#e5e7eb',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >Cerrar (Esc)</button>
          </div>
        </div>
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

      {showDailyCloseModal && (
        <DailyCloseModal
          incompleteTasks={getTodayIncompleteTasks()}
          employees={employees}
          onClose={() => setShowDailyCloseModal(false)}
          onConfirm={handleDailyClose}
        />
      )}
    </div>
  );
}

export default KanbanBoard;
