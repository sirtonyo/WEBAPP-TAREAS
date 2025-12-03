import { useState } from 'react';
import './App.css';
import ConfigScreen, { STORES } from './components/ConfigScreen';
import TaskSection from './components/TaskSection';
import tasksData from './data/tasks.json';

// Helper function to get store name from ID
const getStoreName = (storeId) => {
  const store = STORES.find(s => s.id === storeId);
  return store ? store.name : storeId;
};

// Filter tasks based on store ID
const filterTasksByStore = (storeId) => {
  return tasksData.filter(task => 
    task.targetStores.includes('all') || task.targetStores.includes(storeId)
  );
};

// Group tasks by category
const groupTasksByCategory = (tasks) => {
  const categories = ['Apertura', 'Mantenimiento', 'Cierre'];
  const grouped = {};
  
  categories.forEach(category => {
    grouped[category] = tasks.filter(task => task.category === category);
  });
  
  return grouped;
};

// Helper to get initial config from localStorage
const getInitialConfig = () => {
  const savedName = localStorage.getItem('employeeName');
  const savedStoreId = localStorage.getItem('storeId');
  return {
    isConfigured: !!(savedName && savedStoreId),
    employeeName: savedName || '',
    storeId: savedStoreId || ''
  };
};

function App() {
  const [config, setConfig] = useState(getInitialConfig);

  const handleConfigComplete = () => {
    setConfig(getInitialConfig());
  };

  const handleChangeConfig = () => {
    setConfig(prev => ({ ...prev, isConfigured: false }));
  };

  if (!config.isConfigured) {
    return <ConfigScreen onComplete={handleConfigComplete} />;
  }

  // Get filtered and grouped tasks
  const filteredTasks = filterTasksByStore(config.storeId);
  const groupedTasks = groupTasksByCategory(filteredTasks);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-info">
          <h1>Tareas del Día</h1>
          <p className="header-details">
            <span className="employee-name">{config.employeeName}</span>
            <span className="separator">|</span>
            <span className="store-name">{getStoreName(config.storeId)}</span>
          </p>
        </div>
        <button className="config-btn" onClick={handleChangeConfig}>
          ⚙️ Configurar
        </button>
      </header>
      
      <main className="main-content">
        <TaskSection 
          title="Apertura" 
          tasks={groupedTasks['Apertura']} 
        />
        <TaskSection 
          title="Mantenimiento" 
          tasks={groupedTasks['Mantenimiento']} 
        />
        <TaskSection 
          title="Cierre" 
          tasks={groupedTasks['Cierre']} 
        />
      </main>
    </div>
  );
}

export default App;
