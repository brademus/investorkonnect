import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-xl p-8 max-w-2xl w-full shadow-lg">
            <h2 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-red-700 mb-4">
              An unexpected error occurred.
            </p>
            
            <div className="bg-red-50 p-4 rounded-lg overflow-auto max-h-[500px] border border-red-100 text-left">
              <p className="font-bold text-red-800 text-sm mb-2">Error:</p>
              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono mb-4">
                {this.state.error ? this.state.error.toString() : "Unknown Error"}
              </pre>

              {this.state.errorInfo && (
                <>
                  <p className="font-bold text-red-800 text-sm mb-2">Component Stack:</p>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
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