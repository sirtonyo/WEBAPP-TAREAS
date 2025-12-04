import './ErrorScreen.css';

function ErrorScreen({ message }) {
  return (
    <div className="error-screen">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <h1>Error de Acceso</h1>
        <p className="error-message">{message}</p>
        <p className="error-hint">
          {message.includes('store') && 
            'La URL debe incluir el parámetro ?store=TX (donde X es el ID de tienda)'}
        </p>
        <p className="error-contact">
          Contacte con Dirección para obtener el enlace correcto.
        </p>
      </div>
    </div>
  );
}

export default ErrorScreen;
