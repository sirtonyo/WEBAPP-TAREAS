import { useState } from 'react';
import './TaskModal.css';

const MAX_CHANGES = 3;

function TaskModal({ task, dayOfWeek, taskState, onClose, onUpdate }) {
  const [employeeName, setEmployeeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const history = taskState?.history || [];
  const changesLeft = MAX_CHANGES - history.length;
  const isDone = taskState?.status === 'DONE';

  const handleMarkAsDone = () => {
    if (!employeeName.trim()) {
      alert('Por favor, introduce el número de empleado o nombre');
      return;
    }

    setIsSubmitting(true);
    onUpdate({
      status: 'DONE',
      employee: employeeName.trim()
    });
    setIsSubmitting(false);
    onClose();
  };

  const handleMarkAsPending = () => {
    setIsSubmitting(true);
    onUpdate({
      status: 'PENDING',
      employee: null
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2 className="modal-title">{task.label}</h2>
        
        <div className="changes-counter">
          <span className={changesLeft <= 1 ? 'warning' : ''}>
            Cambios restantes: <strong>{changesLeft}</strong> de {MAX_CHANGES}
          </span>
        </div>
        
        <div className="modal-section">
          <h3>Historial de Cambios</h3>
          {history.length > 0 ? (
            <ul className="history-list">
              {history.map((entry, index) => (
                <li key={index} className="history-item">
                  <span className="history-timestamp">{entry.timestamp}</span>
                  <span className="history-employee">{entry.employee}</span>
                  <span className={`history-status status-${entry.status.toLowerCase()}`}>
                    {entry.status === 'DONE' ? '✓ Completada' : '○ Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-history">Sin cambios registrados</p>
          )}
        </div>

        <div className="modal-section">
          <h3>Actualizar Estado</h3>
          {!isDone && (
            <div className="form-group">
              <label htmlFor="employee-input">Nº Empleado / Nombre:</label>
              <input
                id="employee-input"
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Introduce identificación"
                disabled={isSubmitting}
              />
            </div>
          )}
          
          <div className="modal-actions">
            {!isDone ? (
              <button
                className="btn-done"
                onClick={handleMarkAsDone}
                disabled={isSubmitting || !employeeName.trim()}
              >
                ✓ Marcar como Hecha
              </button>
            ) : (
              <button
                className="btn-pending"
                onClick={handleMarkAsPending}
                disabled={isSubmitting}
              >
                ○ Marcar como Pendiente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskModal;
