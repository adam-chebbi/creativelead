import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Worker ErrorBoundary]', error, errorInfo);
    // Here we could also log to Sentry or the main process logger
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[#111c1c] text-white p-6">
          <div className="max-w-md w-full p-8 rounded-2xl border flex flex-col items-center text-center" style={{ background: '#162424', borderColor: '#1e3232' }}>
            <AlertTriangle className="w-12 h-12 mb-4" style={{ color: '#e8806a' }} />
            <h2 className="text-xl font-bold mb-2">Worker UI Error</h2>
            <p className="text-sm mb-6" style={{ color: '#6a9090' }}>
              The application encountered an unexpected error.
              <br />
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: '#4ecdc4', color: '#080f0f' }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
