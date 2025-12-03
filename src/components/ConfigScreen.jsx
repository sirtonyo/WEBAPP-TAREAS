import { useState } from 'react';

const STORES = [
  { id: 'T1', name: 'Tienda Colón' },
  { id: 'T2', name: 'Tienda Ruzafa' },
  { id: 'T3', name: 'Tienda 3' },
  { id: 'T4', name: 'Tienda 4' }
];

// Helper to get initial values from localStorage
const getInitialValues = () => ({
  employeeName: localStorage.getItem('employeeName') || '',
  storeId: localStorage.getItem('storeId') || ''
});

function ConfigScreen({ onComplete }) {
  const [formData, setFormData] = useState(getInitialValues);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.employeeName.trim() && formData.storeId) {
      localStorage.setItem('employeeName', formData.employeeName.trim());
      localStorage.setItem('storeId', formData.storeId);
      onComplete();
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = formData.employeeName.trim() !== '' && formData.storeId !== '';

  return (
    <div className="config-screen">
      <h1>Configuración</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="employeeName">Nombre del Empleado:</label>
          <input
            type="text"
            id="employeeName"
            value={formData.employeeName}
            onChange={(e) => handleChange('employeeName', e.target.value)}
            placeholder="Introduce tu nombre"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="store">Tienda:</label>
          <select
            id="store"
            value={formData.storeId}
            onChange={(e) => handleChange('storeId', e.target.value)}
            required
          >
            <option value="">Selecciona una tienda</option>
            {STORES.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={!isFormValid}>
          Continuar
        </button>
      </form>
    </div>
  );
}

export { STORES };
export default ConfigScreen;
