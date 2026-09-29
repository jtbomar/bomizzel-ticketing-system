import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, any error while a page renders leaves the whole site blank.
 * Shows what broke and a way to reload instead.
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Page crashed:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-sm text-gray-600 mb-4">This page hit an error while loading.</p>
          <pre className="text-xs text-left text-red-700 bg-red-50 rounded p-3 mb-6 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
