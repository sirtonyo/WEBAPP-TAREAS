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
function TaskCard({ task, date, dayIndex, taskState, onTaskClick, isCustom, isSelected, onShowInfo, dayClosed, cardRef }) {
  const isDone = taskState?.status === 'DONE';
  const isCierreIncompleto = taskState?.status === 'CIERRE_INCOMPLETO';
  // carriedOver can come from taskState (regular tasks) or task.carriedFrom (assignments)
  const isCarriedOver = taskState?.carriedOver || task.carriedFrom;
  const carriedFromDay = taskState?.originalDay || task.carriedFrom || 'ayer';
  const isPast = isPastDate(date);
  const isTodayDate = isToday(date);
  const isFuture = isFutureDate(date);
  // Count only changes by real employees (not SISTEMA) for the lock
  const realChangesCount = (taskState?.history || []).filter(h => h.employee !== 'SISTEMA').length;
  const isLocked = realChangesCount >= MAX_CHANGES;
  const isReadOnly = (isPast && !isDone) || dayClosed || isCierreIncompleto;
  const isAssignment = task.isCustom || task.category === 'Encargo';

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
  } else if (isCierreIncompleto) {
    // 🔴 CIERRE_INCOMPLETO - Rojo con etiqueta especial
    borderColor = '#dc2626';
    bgColor = '#fee2e2';
    statusIcon = '⚠️';
    statusText = 'RETRASADA (Cierre)';
  } else if (isCarriedOver) {
    // 🟡 Tarea arrastrada del día anterior - Amarillo/Naranja
    borderColor = '#f59e0b';
    bgColor = '#fef3c7';
    statusIcon = '↩️';
    statusText = `Arrastre de ${carriedFromDay}`;
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
  
  // Encargos: borde azul distintivo (solo si NO están arrastrados, completados o con cierre incompleto)
  if (isAssignment && !isDone && !isCierreIncompleto && !isCarriedOver) {
    borderColor = '#3b82f6';
    bgColor = '#eff6ff';
  }

  const handleClick = () => {
    if (dayClosed) {
      alert('Este día ya está cerrado. No se pueden modificar las tareas.');
      return;
    }
    if (isCierreIncompleto) {
      alert('Esta tarea ya fue cerrada como incompleta.');
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
      ref={cardRef}
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
      {/* Category Badge - Encargo badge is blue */}
      {isAssignment ? (
        <span style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          fontSize: '9px',
          padding: '1px 4px',
          borderRadius: '2px',
          background: '#dbeafe',
          color: '#1d4ed8'
        }}>
          📋 Encargo
        </span>
      ) : task.category && !isCustom && (
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
      
      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px', lineHeight: '1.2', paddingRight: '50px' }}>
        {task.label}
      </div>
      
      {/* Show responsible and helper for assignments */}
      {isAssignment && task.responsible && (
        <div style={{ fontSize: '10px', color: '#3b82f6', marginBottom: '2px' }}>
          👤 {task.responsible}
          {task.helper && <span style={{ marginLeft: '4px', color: '#6b7280' }}>+ {task.helper}</span>}
        </div>
      )}
      
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px', 
        color: isDone ? '#166534' : isCierreIncompleto ? '#b91c1c' : isPast ? '#b91c1c' : isTodayDate ? '#c2410c' : '#6b7280'
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
  // Count only changes by real employees (not SISTEMA) for display
  const realChangesCount = history.filter(h => h.employee !== 'SISTEMA').length;
  const changesLeft = MAX_CHANGES - realChangesCount;

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

// Notes Summary Card - Single card showing note count for the day
function NotesSummaryCard({ notes, onClick, isSelected, cardRef }) {
  const unreadCount = notes.filter(n => !n.readBy || n.readBy.length === 0).length;
  const totalCount = notes.length;
  
  if (totalCount === 0) return null;
  
  return (
    <div
      ref={cardRef}
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px',
        marginBottom: '6px',
        background: unreadCount > 0 ? '#fde047' : '#fef9c3',
        borderLeft: '4px solid #eab308',
        borderRadius: '2px',
        cursor: 'pointer',
        fontSize: '13px',
        boxSizing: 'border-box',
        position: 'relative',
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '-2px',
        fontWeight: unreadCount > 0 ? '600' : 'normal',
        boxShadow: unreadCount > 0 ? '0 2px 4px rgba(234, 179, 8, 0.3)' : 'none'
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between'
      }}>
        <span style={{ color: '#78350f' }}>
          📝 {totalCount} nota{totalCount > 1 ? 's' : ''}
          {unreadCount > 0 && (
            <span style={{ 
              marginLeft: '6px',
              background: '#dc2626',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px'
            }}>
              {unreadCount} sin leer
            </span>
          )}
        </span>
        <span style={{ fontSize: '11px', color: '#a16207' }}>▶</span>
      </div>
    </div>
  );
}

// Create Note Modal - Always for current day, strict keyboard nav
function CreateNoteModal({ employees, currentDay, onSubmit, onCancel }) {
  const [message, setMessage] = useState('');
  const [author, setAuthor] = useState('');
  const msgRef = useRef(null);
  const authorRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    // Auto-focus textarea on mount
    setTimeout(() => msgRef.current?.focus(), 50);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!message.trim() || !author) {
      alert('Escribe un mensaje y selecciona quién lo escribe');
      return;
    }
    // Just submit - parent handles closing the modal
    onSubmit({ message, author, dayOfWeek: currentDay });
  };

  const handleMsgKeyDown = (e) => {
    // ArrowDown or Tab moves to employee selector
    if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault();
      authorRef.current?.focus();
    }
  };

  const handleAuthorKeyDown = (e) => {
    if (e.key === 'Enter' && author) {
      e.preventDefault();
      submitRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      msgRef.current?.focus();
    } else if (e.key === 'ArrowDown' && author) {
      e.preventDefault();
      submitRef.current?.focus();
    }
  };

  const handleSubmitKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Prevent Enter from bubbling to global keyboard handler
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      authorRef.current?.focus();
    }
  };

  const dayName = DAYS[currentDay - 1];

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
        background: '#fef9c3',
        padding: '24px',
        borderRadius: '4px',
        width: '400px',
        border: '2px solid #eab308'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#78350f' }}>📝 Nueva Nota</h3>
          <span style={{ 
            background: '#fbbf24', 
            color: '#78350f', 
            padding: '4px 10px', 
            borderRadius: '4px', 
            fontSize: '12px',
            fontWeight: '600'
          }}>{dayName}</span>
        </div>
        <form onSubmit={handleSubmit}>
          <textarea
            ref={msgRef}
            placeholder="Escribe tu mensaje para el relevo... *"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleMsgKeyDown}
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #eab308', 
              borderRadius: '4px', 
              marginBottom: '12px', 
              boxSizing: 'border-box',
              minHeight: '100px',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: '14px'
            }}
          />
          <select
            ref={authorRef}
            value={author}
            onChange={e => setAuthor(e.target.value)}
            onKeyDown={handleAuthorKeyDown}
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #eab308', 
              borderRadius: '4px', 
              marginBottom: '16px', 
              boxSizing: 'border-box',
              background: 'white',
              fontSize: '14px'
            }}
          >
            <option value="">-- ¿Quién escribe? --</option>
            {employees.map(emp => (
              <option key={emp.id} value={`${emp.id} - ${emp.name}`}>
                {emp.id} - {emp.name}
              </option>
            ))}
          </select>
          <button 
            ref={submitRef}
            type="submit"
            disabled={!message.trim() || !author}
            onKeyDown={handleSubmitKeyDown}
            style={{
              width: '100%',
              padding: '12px',
              background: message.trim() && author ? '#eab308' : '#d1d5db',
              color: message.trim() && author ? '#78350f' : '#6b7280',
              border: 'none',
              borderRadius: '4px',
              cursor: message.trim() && author ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '14px'
          }}>📤 Publicar Nota</button>
        </form>
        <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#a16207', textAlign: 'center' }}>
          ↓ Empleado → Enter → Publicar | Esc cancelar
        </p>
      </div>
    </div>
  );
}

// Daily Notes Modal - Lists all notes for a day with reading functionality
function DailyNotesModal({ notes, dayName, employees, onMarkRead, onClose, isReadOnly = false }) {
  const [selectedNote, setSelectedNote] = useState(null);
  const [reader, setReader] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectRef = useRef(null);
  const markReadRef = useRef(null);
  const noteRefs = useRef({});
  const listContainerRef = useRef(null);
  
  // Sort: unread first, then by date (newest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const aRead = a.readBy && a.readBy.length > 0;
    const bRead = b.readBy && b.readBy.length > 0;
    if (aRead !== bRead) return aRead ? 1 : -1; // Unread first
    // Newest first (by id which includes timestamp)
    return b.id.localeCompare(a.id);
  });
  
  // Count unread notes for mandatory read logic
  const unreadCount = notes.filter(n => !n.readBy || n.readBy.length === 0).length;
  const canClose = unreadCount === 0 || isReadOnly;

  // When a note is selected for reading, focus the employee selector
  useEffect(() => {
    if (selectedNote && !selectedNote.readBy?.length && !isReadOnly) {
      setTimeout(() => selectRef.current?.focus(), 50);
    }
  }, [selectedNote, isReadOnly]);
  
  // Auto-scroll to selected note in list
  useEffect(() => {
    if (!selectedNote && noteRefs.current[selectedIndex]) {
      noteRefs.current[selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex, selectedNote]);

  // Keyboard navigation for list and close blocking
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Block ESC if unread notes exist (unless in read-only mode)
      if (e.key === 'Escape') {
        if (selectedNote) {
          // In detail view - go back to list
          e.preventDefault();
          setSelectedNote(null);
          setReader('');
        } else if (canClose) {
          onClose();
        } else {
          e.preventDefault();
          // Optional: show feedback
        }
        return;
      }
      
      // List navigation when not viewing a specific note
      if (!selectedNote && sortedNotes.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => Math.min(sortedNotes.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleSelectNote(sortedNotes[selectedIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedNote, sortedNotes, selectedIndex, canClose]);

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setReader('');
  };

  const handleMarkRead = () => {
    if (!reader) {
      alert('Selecciona quién ha leído la nota');
      selectRef.current?.focus();
      return;
    }
    onMarkRead(selectedNote.id, reader);
    setSelectedNote(null);
    setReader('');
  };

  const handleSelectKeyDown = (e) => {
    if (e.key === 'Enter' && reader) {
      e.preventDefault();
      markReadRef.current?.focus();
    }
  };

  const handleMarkReadKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMarkRead();
    }
  };

  const handleBackToList = () => {
    setSelectedNote(null);
    setReader('');
  };
  
  const handleCloseClick = () => {
    if (canClose) {
      onClose();
    }
  };
  
  // Block backdrop click if unread notes
  const handleBackdropClick = () => {
    if (canClose) {
      onClose();
    }
  };

  const isNoteRead = (note) => note.readBy && note.readBy.length > 0;

  // Render individual note view
  if (selectedNote) {
    const alreadyRead = isNoteRead(selectedNote);
    
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
      }}>
        <div style={{
          background: '#fef9c3',
          padding: '24px',
          borderRadius: '4px',
          width: '450px',
          maxWidth: '95vw',
          border: '2px solid #eab308'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>📝</span>
            <h3 style={{ margin: 0, color: '#78350f', flex: 1 }}>Nota de {dayName}</h3>
            {alreadyRead && <span style={{ fontSize: '20px' }}>✅</span>}
          </div>
          
          <div style={{ 
            background: alreadyRead ? '#fef9c3' : '#fde047', 
            padding: '16px', 
            borderRadius: '4px',
            marginBottom: '16px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            color: '#78350f',
            fontSize: '14px',
            border: alreadyRead ? 'none' : '2px solid #fbbf24',
            fontWeight: alreadyRead ? 'normal' : '500'
          }}>
            {selectedNote.message}
          </div>
          
          <div style={{ fontSize: '12px', color: '#a16207', marginBottom: '16px' }}>
            <div>✍️ <strong>{selectedNote.author}</strong></div>
            <div>📅 {selectedNote.createdAt}</div>
            {alreadyRead && (
              <div style={{ marginTop: '8px', padding: '8px', background: '#dcfce7', borderRadius: '4px' }}>
                {selectedNote.readBy.map((read, idx) => (
                  <div key={idx} style={{ color: '#166534', fontSize: '11px', marginBottom: idx < selectedNote.readBy.length - 1 ? '4px' : 0 }}>
                    ✅ <strong>{typeof read === 'string' ? read : read.employee}</strong>
                    {typeof read === 'object' && read.readAt && (
                      <span style={{ color: '#6b7280', marginLeft: '8px' }}>({read.readAt})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!alreadyRead && !isReadOnly ? (
            <>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#78350f', fontWeight: '600' }}>
                ¿Quién ha leído esta nota?
              </label>
              <select
                ref={selectRef}
                value={reader}
                onChange={e => setReader(e.target.value)}
                onKeyDown={handleSelectKeyDown}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid #eab308', 
                  borderRadius: '4px', 
                  marginBottom: '12px', 
                  boxSizing: 'border-box',
                  background: 'white',
                  fontSize: '14px'
                }}
              >
                <option value="">-- Seleccionar empleado --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={`${emp.id} - ${emp.name}`}>
                    {emp.id} - {emp.name}
                  </option>
                ))}
              </select>
              <button 
                ref={markReadRef}
                onClick={handleMarkRead}
                onKeyDown={handleMarkReadKeyDown}
                disabled={!reader}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: reader ? '#16a34a' : '#d1d5db',
                  color: reader ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: reader ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '14px'
              }}>✓ Marcar como Leído</button>
              <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#a16207', textAlign: 'center' }}>
                Selecciona empleado → Enter → Marcar Leído
              </p>
            </>
          ) : !alreadyRead && isReadOnly ? (
            <>
              <div style={{ 
                background: '#fef3c7', 
                border: '1px solid #f59e0b', 
                borderRadius: '4px', 
                padding: '10px', 
                marginBottom: '12px',
                fontSize: '12px',
                color: '#92400e',
                textAlign: 'center'
              }}>
                🔒 Día cerrado - Solo lectura
              </div>
              <button 
                onClick={handleBackToList}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
              }}>← Volver a la lista</button>
            </>
          ) : (
            <button 
              onClick={handleBackToList}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
            }}>← Volver a la lista</button>
          )}
        </div>
      </div>
    );
  }

  // Render notes list
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
    }} onClick={handleBackdropClick}>
      <div style={{
        background: '#fef9c3',
        padding: '24px',
        borderRadius: '4px',
        width: '500px',
        maxWidth: '95vw',
        maxHeight: '80vh',
        border: '2px solid #eab308',
        display: 'flex',
        flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>📝</span>
          <h3 style={{ margin: 0, color: '#78350f', flex: 1 }}>Notas de {dayName}</h3>
          {unreadCount > 0 && (
            <span style={{ 
              background: '#dc2626', 
              color: 'white', 
              padding: '4px 10px', 
              borderRadius: '4px', 
              fontSize: '11px',
              fontWeight: '600'
            }}>
              {unreadCount} sin leer
            </span>
          )}
          <span style={{ 
            background: '#fbbf24', 
            color: '#78350f', 
            padding: '4px 10px', 
            borderRadius: '4px', 
            fontSize: '12px' 
          }}>
            {notes.length} nota{notes.length > 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Mandatory read warning */}
        {!canClose && (
          <div style={{ 
            background: '#fef3c7', 
            border: '1px solid #f59e0b', 
            borderRadius: '4px', 
            padding: '8px 12px', 
            marginBottom: '12px',
            fontSize: '12px',
            color: '#92400e',
            textAlign: 'center'
          }}>
            ⚠️ Debes leer todas las notas para cerrar
          </div>
        )}
        
        {/* Read-only indicator */}
        {isReadOnly && (
          <div style={{ 
            background: '#e5e7eb', 
            border: '1px solid #9ca3af', 
            borderRadius: '4px', 
            padding: '8px 12px', 
            marginBottom: '12px',
            fontSize: '12px',
            color: '#4b5563',
            textAlign: 'center'
          }}>
            🔒 Día cerrado - Solo lectura
          </div>
        )}
        
        <div 
          ref={listContainerRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {sortedNotes.map((note, index) => {
            const read = isNoteRead(note);
            const isSelected = index === selectedIndex;
            return (
              <div
                key={note.id}
                ref={el => { noteRefs.current[index] = el; }}
                onClick={() => handleSelectNote(note)}
                style={{
                  padding: '12px',
                  background: read ? '#fef9c3' : '#fde047',
                  borderLeft: `4px solid ${read ? '#a3a3a3' : '#eab308'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  opacity: read ? 0.7 : 1,
                  fontWeight: read ? 'normal' : '600',
                  outline: isSelected ? '2px solid #3b82f6' : 'none',
                  outlineOffset: '-2px',
                  transform: isSelected ? 'translateX(4px)' : 'none',
                  transition: 'transform 0.1s, outline 0.1s'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '4px'
                }}>
                  <span style={{ fontSize: '10px', color: '#a16207' }}>
                    {note.author} - {note.createdAt}
                  </span>
                  {read ? (
                    <span style={{ fontSize: '10px', color: '#16a34a' }}>
                      ✅ {typeof note.readBy[0] === 'string' 
                        ? note.readBy[0].split(' - ')[0] 
                        : note.readBy[0]?.employee?.split(' - ')[0] || 'Leído'}
                    </span>
                  ) : (
                    <span style={{ 
                      fontSize: '9px', 
                      background: '#dc2626', 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '4px' 
                    }}>NUEVO</span>
                  )}
                </div>
                <div style={{ 
                  color: '#78350f', 
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {note.message}
                </div>
              </div>
            );
          })}
        </div>
        
        <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#a16207', textAlign: 'center' }}>
          ↑↓ Navegar | Enter Abrir nota
        </p>
        
        <button 
          onClick={handleCloseClick}
          disabled={!canClose}
          style={{
            width: '100%',
            padding: '12px',
            background: canClose ? '#e5e7eb' : '#f3f4f6',
            color: canClose ? '#374151' : '#9ca3af',
            border: 'none',
            borderRadius: '4px',
            cursor: canClose ? 'pointer' : 'not-allowed',
            fontSize: '14px'
        }}>{canClose ? 'Cerrar (Esc)' : '🔒 Lee todas las notas'}</button>
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
function DailyCloseModal({ incompleteTasks, employees, onClose, onConfirm, dayIndex, dayName }) {
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
        incompleteTasks,
        dayIndex // Pass the day index to close
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
                  ¿Desea cerrar el {dayName}?
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
                <h3 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>⚠️ Cierre del {dayName} - Tareas sin completar</h3>
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
  const [notes, setNotes] = useState(() => {
    // Load notes from localStorage
    const weekKey = getWeekKey();
    const storageKey = `notes_${storeId}_${weekKey}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : [];
  });
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
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [viewingDayNotes, setViewingDayNotes] = useState(null); // day index (0-6) to view notes modal
  const [pendingAction, setPendingAction] = useState(null);
  const [infoTask, setInfoTask] = useState(null); // For info modal
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading', 'synced', 'offline'
  
  // Keyboard navigation state
  const [focusedDay, setFocusedDay] = useState(getDayOfWeek() - 1);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(0);
  
  // Refs for auto-scroll
  const taskRefs = useRef({});

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
  
  // Save notes to localStorage when they change (skip if empty array on mount)
  const notesInitialized = useRef(false);
  useEffect(() => {
    // Skip first render if notes array is empty (prevents overwriting existing data)
    if (!notesInitialized.current && notes.length === 0) {
      notesInitialized.current = true;
      return;
    }
    notesInitialized.current = true;
    const weekKey = getWeekKey();
    const storageKey = `notes_${storeId}_${weekKey}`;
    localStorage.setItem(storageKey, JSON.stringify(notes));
  }, [notes, storeId]);

  // Save taskStates to localStorage when they change (skip if empty object on mount)
  const taskStatesInitialized = useRef(false);
  useEffect(() => {
    // Skip first render if taskStates is empty (prevents overwriting existing data)
    if (!taskStatesInitialized.current && Object.keys(taskStates).length === 0) {
      taskStatesInitialized.current = true;
      return;
    }
    taskStatesInitialized.current = true;
    const weekKey = getWeekKey();
    const storageKey = `tasks_${storeId}_${weekKey}`;
    localStorage.setItem(storageKey, JSON.stringify(taskStates));
  }, [taskStates, storeId]);

  // Save assignments to localStorage when they change (skip if empty array on mount)
  const assignmentsInitialized = useRef(false);
  useEffect(() => {
    // Skip first render if assignments is empty (prevents overwriting existing data)
    if (!assignmentsInitialized.current && assignments.length === 0) {
      assignmentsInitialized.current = true;
      return;
    }
    assignmentsInitialized.current = true;
    const weekKey = getWeekKey();
    const storageKey = `assignments_${storeId}_${weekKey}`;
    localStorage.setItem(storageKey, JSON.stringify(assignments));
  }, [assignments, storeId]);

  // Auto-scroll to focused item
  useEffect(() => {
    const refKey = `${focusedDay}_${focusedTaskIndex}`;
    const element = taskRefs.current[refKey];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedDay, focusedTaskIndex]);

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
      helper: a.helper,
      isCustom: true,
      isAssignment: true, // Mark as assignment for daily close logic
      category: 'Encargo',
      carriedFrom: a.carriedFrom // Preserve carried-over info for display
    }));
    
    // Combine and sort by category priority with Arqueo exception
    const allTasks = [...storeTasks, ...dayAssignments];
    const categoryOrder = { 'Mañana': 1, 'Dia': 2, 'A fondo': 3, 'Cierre': 4, 'Encargo': 5 };
    
    return allTasks.sort((a, b) => {
      const orderA = categoryOrder[a.category] || 99;
      const orderB = categoryOrder[b.category] || 99;
      
      // Same category - check for Arqueo priority within "Mañana"
      if (orderA === orderB && a.category === 'Mañana') {
        const aIsArqueo = a.label?.toLowerCase().includes('arqueo de caja m');
        const bIsArqueo = b.label?.toLowerCase().includes('arqueo de caja m');
        if (aIsArqueo && !bIsArqueo) return -1;
        if (!aIsArqueo && bIsArqueo) return 1;
      }
      
      return orderA - orderB;
    });
  }, [tasks, storeId, assignments]);
  
  // Get notes for a specific day
  const getDayNotes = useCallback((dayIndex) => {
    const dayNumber = dayIndex + 1;
    return notes.filter(n => n.dayOfWeek === dayNumber);
  }, [notes]);

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

      // Ctrl+C opens daily close modal for the FOCUSED day (not necessarily today)
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const focusedDayNumber = focusedDay + 1;
        const focusedDayName = DAYS[focusedDay];
        if (closedDays[focusedDayNumber]) {
          alert(`El ${focusedDayName} ya está cerrado.`);
          return;
        }
        setShowDailyCloseModal(true);
        return;
      }

      // Ctrl+Shift+U unlocks the focused day (requires PIN) - with full rollback
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        const dayToUnlock = focusedDay + 1; // focusedDay is 0-indexed, dayOfWeek is 1-indexed
        const dayName = DAYS[focusedDay];
        
        if (!closedDays[dayToUnlock]) {
          alert(`El ${dayName} no está cerrado.`);
          return;
        }
        const pin = prompt(`Introduce el PIN del manager para desbloquear el ${dayName}:`);
        if (pin === '1983') {
          // === ROLLBACK: Reverse the daily close effects ===
          
          // 1. Calculate tomorrow's day number (where carried items went)
          const tomorrowDayIndex = focusedDay === 6 ? 0 : focusedDay + 1;
          const tomorrowDayNumber = tomorrowDayIndex + 1;
          
          // 2. Remove carried-over assignments (encargos) from tomorrow
          setAssignments(prev => prev.filter(a => a.carriedFrom !== dayName));
          
          // 3. Remove carried-over notes from tomorrow
          // Notes carried from this day have format: "[Nota de {dayName}] ..."
          const notePrefix = `[Nota de ${dayName}]`;
          setNotes(prev => prev.filter(n => 
            n.dayOfWeek !== tomorrowDayNumber || !n.message.startsWith(notePrefix)
          ));
          
          // 4. Remove carried-over taskStates from tomorrow and reset CIERRE_INCOMPLETO in today
          let resetCount = 0;
          setTaskStates(prev => {
            const newStates = { ...prev };
            const tomorrowSuffix = `_D${tomorrowDayNumber}`;
            const todaySuffix = `_D${dayToUnlock}`;
            
            // Find and remove carried tasks from tomorrow
            Object.keys(newStates).forEach(key => {
              // Remove tomorrow's entries that were carried from this day
              if (key.endsWith(tomorrowSuffix) && newStates[key]?.carriedOver && newStates[key]?.originalDay === dayName) {
                delete newStates[key];
              }
              // Reset CIERRE_INCOMPLETO status to PENDING for today's tasks
              if (key.endsWith(todaySuffix) && newStates[key]?.status === 'CIERRE_INCOMPLETO') {
                resetCount++;
                newStates[key] = {
                  ...newStates[key],
                  status: 'PENDING',
                  history: [{
                    timestamp: new Date().toLocaleString('es-ES'),
                    employee: 'SISTEMA',
                    status: 'PENDING (desbloqueado)'
                  }, ...(newStates[key]?.history || [])].slice(0, 5)
                };
              }
            });
            
            return newStates;
          });
          
          // 5. Log the rollback action to the Sheet
          const weekId = getWeekKey();
          saveTask({
            action: 'saveTask',
            weekId,
            dayName,
            storeId,
            employee: 'MANAGER',
            taskId: 'ROLLBACK',
            tareaLabel: 'Desbloqueo de ' + dayName,
            prevStatus: 'CIERRE',
            status: 'ROLLBACK',
            editCount: 1,
            obs: 'Dia reabierto por manager'
          });
          
          // 6. Unlock the day in localStorage
          unlockDay(storeId, dayToUnlock);
          setClosedDays(prev => ({ ...prev, [dayToUnlock]: false }));
          
          console.log(`[Unlock] Day ${dayName} unlocked with full rollback`);
          alert(`✅ ${dayName} desbloqueado. Se han eliminado las tareas/notas arrastradas al día siguiente.`);
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
      
      // Alt+N opens note modal (only for today if not closed)
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const todayIsClosed = closedDays[todayIndex + 1];
        if (todayIsClosed) {
          alert('No puedes crear notas: el día de hoy ya está cerrado.');
          return;
        }
        setShowNoteModal(true);
        return;
      }

      // Don't handle if a modal is open
      if (selectedTask || showPinModal || showAssignmentModal || pendingAction || infoTask || showDailyCloseModal || showNoteModal || viewingDayNotes !== null) return;

      const currentDayTasks = getDayTasks(focusedDay);
      const currentDayNotes = getDayNotes(focusedDay);
      // Notes summary is a single item (if notes exist), then tasks
      const hasNotes = currentDayNotes.length > 0;
      const totalItems = (hasNotes ? 1 : 0) + currentDayTasks.length;
      
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
          setFocusedTaskIndex(i => Math.min(totalItems - 1, i + 1));
          break;
        case 'i':
        case 'I':
          // Show info for focused task (only if not on a note)
          e.preventDefault();
          // Show info for focused task (only if on a task, not notes summary)
          e.preventDefault();
          if (hasNotes && focusedTaskIndex === 0) {
            // On notes summary - do nothing for 'i'
          } else {
            const taskIdx = hasNotes ? focusedTaskIndex - 1 : focusedTaskIndex;
            if (taskIdx >= 0 && taskIdx < currentDayTasks.length) {
              const task = currentDayTasks[taskIdx];
              setInfoTask(task);
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          // If on notes summary, open daily notes modal
          if (hasNotes && focusedTaskIndex === 0) {
            setViewingDayNotes(focusedDay);
          } else {
            // On a task
            const taskIdx = hasNotes ? focusedTaskIndex - 1 : focusedTaskIndex;
            if (taskIdx >= 0 && taskIdx < currentDayTasks.length) {
              const task = currentDayTasks[taskIdx];
              const date = weekDates[focusedDay];
              const taskKey = `${task.id}_D${focusedDay + 1}`;
              const state = taskStates[taskKey];
              // Count only changes by real employees (not SISTEMA) for the lock
              const realChangesCount = (state?.history || []).filter(h => h.employee !== 'SISTEMA').length;
              const isLocked = realChangesCount >= MAX_CHANGES;
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
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedDay, focusedTaskIndex, selectedTask, showPinModal, showAssignmentModal, showDailyCloseModal, pendingAction, infoTask, getDayTasks, getDayNotes, weekDates, taskStates, closedDays, showNoteModal, viewingDayNotes]);

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
  
  // Handle adding a new note
  const handleAddNote = (noteData) => {
    const newNote = {
      id: `NOTE-${Date.now()}`,
      message: noteData.message,
      author: noteData.author,
      dayOfWeek: noteData.dayOfWeek,
      createdAt: new Date().toLocaleString('es-ES'),
      readBy: []
    };
    setNotes(prev => [...prev, newNote]);
    setShowNoteModal(false);
  };
  
  // Handle marking a note as read
  const handleMarkNoteRead = (noteId, reader) => {
    const readTimestamp = new Date().toLocaleString('es-ES');
    setNotes(prev => prev.map(n => 
      n.id === noteId 
        ? { 
            ...n, 
            readBy: [...(n.readBy || []), { employee: reader, readAt: readTimestamp }] 
          }
        : n
    ));
    // Don't close the modal - let the DailyNotesModal handle navigation
  };

  // Get incomplete tasks for the FOCUSED day (includes both regular tasks AND assignments)
  const getFocusedDayIncompleteTasks = useCallback(() => {
    const focusedTasks = getDayTasks(focusedDay);
    return focusedTasks.filter(task => {
      const taskKey = `${task.id}_D${focusedDay + 1}`;
      const state = taskStates[taskKey];
      // Include both regular tasks and assignments that are not DONE
      return state?.status !== 'DONE';
    });
  }, [getDayTasks, focusedDay, taskStates]);

  // Handle daily close - with duplicate protection
  // Uses focusedDay to allow closing any day, not just today
  const closingRef = useRef(false);
  const handleDailyClose = async (closeData) => {
    // Prevent duplicate calls (e.g., from React StrictMode or double-click)
    if (closingRef.current) {
      console.log('[DailyClose] Already processing, ignoring duplicate call');
      return;
    }
    closingRef.current = true;
    
    const { reasons, employee, incompleteTasks, dayIndex: closeDayIndex } = closeData;
    const weekId = getWeekKey();
    const dayName = DAYS[closeDayIndex];
    const isNotSunday = closeDayIndex < 6; // 0=Lunes, 6=Domingo
    const dayNumber = closeDayIndex + 1;
    
    try {
      // If there are incomplete tasks, log each with its reason AND create carry-over for tomorrow
      if (incompleteTasks && incompleteTasks.length > 0) {
        for (const task of incompleteTasks) {
          // Determine if this is an assignment (encargo) for better logging
          const isEncargo = task.isAssignment || task.isCustom || task.category === 'Encargo';
          const logTaskId = isEncargo ? 'ENCARGO' : task.id;
          const logLabel = isEncargo ? `[Encargo] ${task.label}` : task.label;
          
          // 1. Mark original task as CIERRE_INCOMPLETO
          await saveTask({
            action: 'saveTask',
            weekId,
            dayName,
            storeId,
            employee,
            taskId: logTaskId,
            tareaLabel: logLabel,
            prevStatus: 'PENDING',
            status: 'CIERRE_INCOMPLETO',
            editCount: 1,
            obs: reasons[task.id] || ''
          });
          
          // 2. Create carry-over for tomorrow
          // - Regular tasks: DO NOT carry from Sunday to Monday (weekly reset)
          // - Encargos (Assignments): ALWAYS carry over, even Sunday to Monday
          const shouldCarryOver = isEncargo || isNotSunday;
          
          if (shouldCarryOver) {
            const tomorrowDayIndex = closeDayIndex === 6 ? 0 : closeDayIndex + 1; // Sunday wraps to Monday (0)
            const tomorrowDayNumber = tomorrowDayIndex + 1; // 1-7
            const tomorrowDayName = DAYS[tomorrowDayIndex];
            
            await saveTask({
              action: 'saveTask',
              weekId,
              dayName: tomorrowDayName,
              storeId,
              employee: 'SISTEMA',
              taskId: logTaskId,
              tareaLabel: logLabel,
              prevStatus: '',
              status: 'PENDING',
              editCount: 0,
              obs: `Tarea retrasada de ${dayName}`
            });
            
            // For encargos, also clone the assignment to the next day so it appears in the UI
            if (isEncargo) {
              // Preserve the ORIGINAL day if this encargo was already carried over
              const originalCarriedFrom = task.carriedFrom || dayName;
              const newAssignment = {
                id: `custom_${Date.now()}`,
                description: task.label,
                responsible: task.responsible || '',
                helper: task.helper || '',
                dayOfWeek: tomorrowDayNumber,
                createdAt: new Date().toLocaleString('es-ES'),
                carriedFrom: originalCarriedFrom // Keep original day, not current day
              };
              setAssignments(prev => [...prev, newAssignment]);
              console.log(`[DailyClose] Cloned encargo "${task.label}" to day ${tomorrowDayNumber}, originally from ${originalCarriedFrom}`);
            }
            
            // Also update local state to show the task as pending tomorrow
            const tomorrowTaskKey = `${task.id}_D${tomorrowDayNumber}`;
            // Get current task state to check if it was already carried over
            const currentTaskKey = `${task.id}_D${dayNumber}`;
            const currentState = taskStates[currentTaskKey];
            // Preserve the ORIGINAL day if this task was already carried over
            const originalDay = currentState?.originalDay || dayName;
            
            setTaskStates(prev => ({
              ...prev,
              [tomorrowTaskKey]: {
                status: 'PENDING',
                employee: 'SISTEMA',
                carriedOver: true,
                originalDay: originalDay, // Keep original day, not current day
                history: [{
                  timestamp: new Date().toLocaleString('es-ES'),
                  employee: 'SISTEMA',
                  status: 'PENDING'
                }]
              }
            }));
          }
          
          // Update local state for the original task
          const taskKey = `${task.id}_D${dayNumber}`;
          setTaskStates(prev => ({
            ...prev,
            [taskKey]: {
              ...prev[taskKey],
              status: 'CIERRE_INCOMPLETO',
              employee: employee,
              history: [{
                timestamp: new Date().toLocaleString('es-ES'),
                employee: employee,
                status: 'CIERRE_INCOMPLETO'
              }, ...(prev[taskKey]?.history || [])].slice(0, 4)
            }
          }));
        }
      }
      
      // Rolling for unread notes - ALWAYS carries over (even Sunday -> Monday)
      const todayNotes = notes.filter(n => n.dayOfWeek === dayNumber);
      const unreadNotes = todayNotes.filter(n => !n.readBy || n.readBy.length === 0);
      
      if (unreadNotes.length > 0) {
        // Determine tomorrow's day number (for notes, Sunday rolls to Monday which would be next week day 1)
        const tomorrowDayNumber = closeDayIndex === 6 ? 1 : closeDayIndex + 2;
        
        // Clone unread notes to tomorrow
        const clonedNotes = unreadNotes.map(note => ({
          ...note,
          id: `NOTE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          dayOfWeek: tomorrowDayNumber,
          createdAt: note.createdAt, // Keep original creation time
          message: `[Nota de ${dayName}] ${note.message}`,
          readBy: [] // Reset read status
        }));
        
        setNotes(prev => [...prev, ...clonedNotes]);
        console.log(`[DailyClose] Cloned ${unreadNotes.length} unread notes to day ${tomorrowDayNumber}`);
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
        obs: unreadNotes.length > 0 ? `${unreadNotes.length} notas sin leer arrastradas` : ''
      });
      
      // Save close status to localStorage and update state
      saveDailyClose(storeId, dayNumber, employee);
      setClosedDays(prev => ({ ...prev, [dayNumber]: true }));
      
      setShowDailyCloseModal(false);
      const notesMsg = unreadNotes.length > 0 ? ` ${unreadNotes.length} nota(s) sin leer pasadas al día siguiente.` : '';
      alert(`✅ Cierre de ${dayName} registrado correctamente.${notesMsg} Las tareas de ese día ya no se pueden modificar.`);
      
      // Close PWA window after successful daily close
      // This works in standalone PWA mode
      if (window.matchMedia('(display-mode: standalone)').matches) {
        window.close();
      }
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
              {/* Notes Summary Card - pinned to top (single card for all notes) */}
              {getDayNotes(dayIndex).length > 0 && (
                <NotesSummaryCard
                  notes={getDayNotes(dayIndex)}
                  onClick={() => setViewingDayNotes(dayIndex)}
                  isSelected={focusedDay === dayIndex && focusedTaskIndex === 0}
                  cardRef={el => { taskRefs.current[`${dayIndex}_0`] = el; }}
                />
              )}
              
              {/* Tasks sorted by category */}
              {dayTasks.map((task, taskIndex) => {
                const taskKey = `${task.id}_D${dayIndex + 1}`;
                const hasNotes = getDayNotes(dayIndex).length > 0;
                const isSelected = focusedDay === dayIndex && focusedTaskIndex === (hasNotes ? taskIndex + 1 : taskIndex);
                
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
                    cardRef={el => { taskRefs.current[`${dayIndex}_${hasNotes ? taskIndex + 1 : taskIndex}`] = el; }}
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
          incompleteTasks={getFocusedDayIncompleteTasks()}
          employees={employees}
          onClose={() => setShowDailyCloseModal(false)}
          onConfirm={handleDailyClose}
          dayIndex={focusedDay}
          dayName={DAYS[focusedDay]}
        />
      )}
      
      {showNoteModal && (
        <CreateNoteModal
          employees={employees}
          currentDay={todayIndex + 1}
          onSubmit={handleAddNote}
          onCancel={() => setShowNoteModal(false)}
        />
      )}
      
      {viewingDayNotes !== null && (
        <DailyNotesModal
          notes={getDayNotes(viewingDayNotes)}
          dayName={DAYS[viewingDayNotes]}
          employees={employees}
          onMarkRead={handleMarkNoteRead}
          onClose={() => setViewingDayNotes(null)}
          isReadOnly={closedDays[viewingDayNotes + 1] || isPastDate(weekDates[viewingDayNotes])}
        />
      )}
    </div>
  );
}

export default KanbanBoard;
