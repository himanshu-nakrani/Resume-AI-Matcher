import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

function errorReference(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}`;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: errorReference(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const showDiagnostics = import.meta.env.DEV;
      return (
        <div
          className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-4 py-12 text-center"
          role="alert"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-warning/25 bg-warning/10">
            <AlertTriangle className="h-6 w-6 text-warning" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">
              Workspace recovery
            </p>
            <h2 className="text-2xl font-semibold">
              We hit a recoverable issue
            </h2>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
              Your workspace is still intact. Reload the page to retry, or
              return to Optimize and continue from the last saved state.
            </p>
            {this.state.errorId ? (
              <p className="text-xs text-subtle-foreground">
                Reference {this.state.errorId}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => {
                this.setState({
                  hasError: false,
                  error: null,
                  errorInfo: null,
                  errorId: null,
                });
                window.location.reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button asChild variant="outline">
              <a href="/">
                <Home className="h-4 w-4" />
                Go to Optimize
              </a>
            </Button>
          </div>
          {showDiagnostics && (
            <details className="mt-2 w-full rounded-md border border-border bg-muted/30 p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Developer diagnostics
              </summary>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-muted-foreground">
                {[
                  this.state.error?.message,
                  this.state.errorInfo?.componentStack,
                ]
                  .filter(Boolean)
                  .join("\n\n")}
              </pre>
            </details>
          )}
          {!showDiagnostics && (
            <p className="max-w-sm text-xs leading-5 text-subtle-foreground">
              Technical details are hidden in production to keep candidate and
              company data private.
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
