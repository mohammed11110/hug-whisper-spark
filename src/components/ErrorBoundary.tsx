import { Component, ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { captureError } from "@/lib/sentry";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    captureError(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <Logo size={64} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              حدث خطأ ما
            </h1>
            <p className="text-base text-muted-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground pt-2">
              نعتذر عن هذا الإزعاج. حاول مرة أخرى أو عُد للرئيسية.
              <br />
              We're sorry for the inconvenience. Please try again.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={this.reset} className="h-11 px-6 rounded-xl">
              إعادة المحاولة · Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                this.reset();
                window.location.href = "/";
              }}
              className="h-11 px-6 rounded-xl"
            >
              العودة للرئيسية · Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
