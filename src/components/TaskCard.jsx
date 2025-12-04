import { isToday, isPastDay } from '../services/taskService';
import './TaskCard.css';

const MAX_CHANGES = 3;

function TaskCard({ task, dayOfWeek, taskState, onClick, isCustom = false }) {
  const isDone = taskState?.status === 'DONE';
  const isPending = taskState?.status === 'PENDING' || !taskState?.status;
  const isLate = isPending && isPastDay(dayOfWeek);
  const isTodayPending = isPending && isToday(dayOfWeek);
  const historyCount = taskState?.history?.length || 0;
  const isLocked = historyCount >= MAX_CHANGES;

  // Determine card style
  let cardClass = 'task-card';
  if (isCustom) {
    cardClass += ' task-custom';
  }
  if (isDone) {
    cardClass += ' task-done';
  } else if (isTodayPending) {
    cardClass += ' task-today-pending';
  } else if (isLate) {
    cardClass += ' task-late';
  } else {
    cardClass += ' task-future';
  }
  
  if (isLocked) {
    cardClass += ' task-locked';
  }

  const handleClick = () => {
    if (isLocked) {
      alert(`Esta tarea ha alcanzado el límite de ${MAX_CHANGES} cambios. No se puede modificar más.`);
      return;
    }
    onClick();
  };

  const displayLabel = isCustom ? `🔧 ${task.label}` : task.label;

  return (
    <div className={cardClass} onClick={handleClick}>
      <div className="task-card-content">
        <h4 className="task-card-title">{displayLabel}</h4>
        
        {isDone ? (
          <div className="task-card-status done">
            <span className="status-icon">✓</span>
            <span className="employee-name">{taskState.employee}</span>
          </div>
        ) : (
          <div className="task-card-status pending">
            <span className="status-text">
              {isCustom && task.responsible ? `👤 ${task.responsible}` : 'No realizada'}
            </span>
          </div>
        )}
        
        {task.requiresPhoto && (
          <span className="photo-badge">📷</span>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
