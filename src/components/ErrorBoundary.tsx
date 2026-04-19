import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Top-level error boundary to catch unhandled errors from child components.
 * Prevents entire app crash and provides recovery path.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorCount: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md space-y-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground max-h-32 overflow-auto bg-muted p-3 rounded font-mono">
              <pre>{this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}</pre>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" size="sm" onClick={this.handleReset} className="flex-1 gap-2">
                <RotateCcw className="w-4 h-4" />
                Try again
              </Button>
              <Button size="sm" onClick={this.handleReload} className="flex-1 gap-2">
                <RotateCcw className="w-4 h-4" />
                Reload page
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              If the problem persists, please refresh the page or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
