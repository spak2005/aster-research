import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneBoundaryProps {
  children: ReactNode;
  fallback: (reason: string) => ReactNode;
}

interface SceneBoundaryState {
  reason: string | null;
}

/**
 * Isolates the 3D view.
 *
 * The scene is a separately owned module and may be absent, fail to load, or
 * fail to acquire a WebGL context. None of those should take down the rest of
 * the workspace: the evidence, charts and transport are the substance, and the
 * fallback says plainly which view is missing.
 */
export default class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { reason: null };

  static getDerivedStateFromError(error: unknown): SceneBoundaryState {
    return { reason: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Plasma view unavailable:', error.message, info.componentStack);
  }

  render() {
    if (this.state.reason !== null) return this.props.fallback(this.state.reason);
    return this.props.children;
  }
}
