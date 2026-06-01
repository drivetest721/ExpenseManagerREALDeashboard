/**
 * ErrorBoundary — catches uncaught render errors anywhere in the React tree
 * and shows a recoverable fallback instead of a blank screen.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleHome = (): void => {
    window.location.assign('/expense');
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const strMessage = this.state.error?.message ?? 'An unexpected error occurred.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white border border-red-200 rounded-lg shadow-sm max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
              <p className="text-sm text-gray-600 mt-1">{strMessage}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[#00703C] text-white rounded hover:bg-[#005a30] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reload Page
            </button>
            <button
              onClick={this.handleHome}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700 cursor-pointer"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
