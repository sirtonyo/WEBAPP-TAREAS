import { useState } from 'react';

// Helper to get initial task states from localStorage
const getInitialTaskStates = () => {
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `taskStates_${today}`;
  return JSON.parse(localStorage.getItem(storageKey) || '{}');
};

function TaskSection({ title, tasks }) {
  const [taskStates, setTaskStates] = useState(getInitialTaskStates);

  // Save task states to localStorage whenever they change
  const saveTaskStates = (newStates) => {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `taskStates_${today}`;
    localStorage.setItem(storageKey, JSON.stringify(newStates));
    setTaskStates(newStates);
  };

  const handleCheckboxChange = (taskId) => {
    const newStates = {
      ...taskStates,
      [taskId]: {
        ...taskStates[taskId],
        completed: !taskStates[taskId]?.completed
      }
    };
    saveTaskStates(newStates);
  };

  const handlePhotoUpload = (taskId, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newStates = {
          ...taskStates,
          [taskId]: {
            ...taskStates[taskId],
            photo: reader.result
          }
        };
        saveTaskStates(newStates);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (taskId) => {
    const newStates = {
      ...taskStates,
      [taskId]: {
        ...taskStates[taskId],
        photo: null
      }
    };
    saveTaskStates(newStates);
  };

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="task-section">
      <h2 className="section-title">{title}</h2>
      <ul className="task-list">
        {tasks.map((task) => {
          const taskState = taskStates[task.id] || {};
          const isCompleted = taskState.completed || false;
          const hasPhoto = taskState.photo || null;

          return (
            <li key={task.id} className={`task-item ${isCompleted ? 'completed' : ''}`}>
              <div className="task-content">
                <label className="task-label">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => handleCheckboxChange(task.id)}
                  />
                  <span className="task-text">{task.label}</span>
                </label>
                {task.requiresPhoto && (
                  <div className="photo-section">
                    <span className="photo-required-badge">📷 Foto requerida</span>
                    {!hasPhoto ? (
                      <label className="photo-upload-btn">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload(task.id, e)}
                          style={{ display: 'none' }}
                        />
                        Subir Foto
                      </label>
                    ) : (
                      <div className="photo-preview">
                        <img src={hasPhoto} alt="Foto de tarea" />
                        <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => removePhoto(task.id)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TaskSection;
