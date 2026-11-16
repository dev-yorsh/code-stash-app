import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
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
    console.error("[ErrorBoundary] Uncaught error captured:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#1c1e2b] text-[#fff0f5] p-6 font-sans select-none">
          <div className="max-w-md w-full bg-[#202330] border border-[#3e4157] rounded-xl p-6 shadow-xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#007aff]/15 flex items-center justify-center mb-4 text-[#007aff]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold mb-2">Algo salió mal</h2>
            <p className="text-xs text-[#d0b6c6] mb-4 leading-relaxed">
              Ocurrió un error inesperado al actualizar la vista. Puedes recargar la aplicación para continuar.
            </p>
            {this.state.error && (
              <pre className="w-full text-[11px] font-mono bg-[#1c1e2b] border border-[#3e4157] text-[#007aff] p-3 rounded-lg overflow-x-auto text-left mb-5 max-h-32">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#007aff] hover:bg-[#0062cc] text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
