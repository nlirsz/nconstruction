
import React, { ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface Props {
  // Made children optional to satisfy JSX expectations
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Simple Error Boundary to catch crashers
// Fix: Explicitly extending React.Component ensures 'props' and 'state' are correctly visible to TypeScript
class ErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false, error: null };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#dc2626', backgroundColor: '#fef2f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem'}}>Algo deu errado na inicialização.</h1>
          <p style={{marginBottom: '1rem', color: '#374151'}}>Tente recarregar a página. Se o erro persistir, verifique o console.</p>
          <pre style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fca5a5', overflow: 'auto', maxWidth: '80%', fontSize: '0.8rem', textAlign: 'left' }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()} style={{marginTop: '2rem', padding: '0.75rem 1.5rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold'}}>
            Recarregar Página
          </button>
        </div>
      );
    }

    // Fix: Using type casting to bypass property 'props' access error if inheritance is not correctly recognized by TS
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
