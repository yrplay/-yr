import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.warn('Caught UI error safely in ErrorBoundary:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-center space-y-2 my-2"
          dir="rtl"
        >
          <p className="text-xs font-bold text-amber-900">
            {this.props.fallbackTitle || 'تم استعادة استقرار العرض تلقائياً'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-3 py-1.5 rounded-xl bg-[#2D5A43] text-white text-xs font-bold shadow-2xs hover:bg-[#234735] transition cursor-pointer"
          >
            إعادة تنشيط اللوحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
