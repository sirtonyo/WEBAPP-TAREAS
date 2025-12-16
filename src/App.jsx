import { useState, useEffect } from 'react';
import KanbanBoard from './components/KanbanBoard';
import AdminView from './components/AdminView';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { STORES } from './components/ConfigScreen';
import { getWeekKey, getMondayOfWeek, formatDateShort } from './services/weekService';

// Admin password
const ADMIN_PASSWORD = '1983ant';

// Get store from URL
const getStoreFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('store');
};

// Get store name
const getStoreName = (storeId) => {
  const store = STORES.find(s => s.id === storeId);
  return store ? store.name : storeId;
};

// Store Selector
function StoreSelector({ onAdminAccess }) {
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      onAdminAccess();
    } else {
      setAdminError('Contraseña incorrecta');
      setAdminPassword('');
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1f2937'
    }}>
      <div style={{
        background: 'white',
        padding: '32px',
        borderRadius: '4px',
        textAlign: 'center',
        minWidth: '300px'
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#111' }}>Sistema de Tareas</h1>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px' }}>Selecciona tienda:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STORES.map(store => (
            <button
              key={store.id}
              onClick={() => window.location.href = `?store=${store.id}`}
              style={{
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: '#f9fafb',
                cursor: 'pointer'
              }}
            >
              {store.name}
            </button>
          ))}
          
          {/* Admin Option */}
          <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
            {!showAdminPrompt ? (
              <button
                onClick={() => setShowAdminPrompt(true)}
                style={{
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid #7c3aed',
                  borderRadius: '4px',
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                🔐 ADMIN
              </button>
            ) : (
              <form onSubmit={handleAdminSubmit}>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setAdminError('');
                  }}
                  placeholder="Contraseña admin"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '14px',
                    border: adminError ? '1px solid #dc2626' : '1px solid #7c3aed',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    boxSizing: 'border-box'
                  }}
                />
                {adminError && (
                  <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>
                    {adminError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminPrompt(false);
                      setAdminPassword('');
                      setAdminError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '13px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      background: '#f9fafb',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '4px',
                      background: '#7c3aed',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Entrar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [storeId, setStoreId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const urlStore = getStoreFromURL();
    if (urlStore === 'admin') {
      // Direct URL access to admin (still needs password in UI)
      return;
    }
    if (urlStore && STORES.some(s => s.id === urlStore)) {
      setStoreId(urlStore);
    }
  }, []);

  // Admin View
  if (isAdmin) {
    return <AdminView onBack={() => setIsAdmin(false)} />;
  }

  if (!storeId) {
    return <StoreSelector onAdminAccess={() => setIsAdmin(true)} />;
  }

  const monday = getMondayOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#e5e7eb',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      {/* Header - Compact */}
      <header style={{
        background: '#1f2937',
        color: 'white',
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <span style={{ fontWeight: '700', fontSize: '16px' }}>📋 {getStoreName(storeId)}</span>
          <span style={{ marginLeft: '16px', fontSize: '12px', color: '#9ca3af' }}>
            Semana {getWeekKey()} | {formatDateShort(monday)} - {formatDateShort(sunday)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          Hoy: {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
      </header>

      {/* Main Content - Full Screen */}
      <main style={{ flex: 1, overflow: 'hidden', padding: '4px' }}>
        <ConfigProvider storeId={storeId}>
          <KanbanBoard storeId={storeId} />
        </ConfigProvider>
      </main>
    </div>
  );
}

export default App;
