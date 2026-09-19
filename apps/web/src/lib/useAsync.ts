import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: string };

/**
 * Runs an abortable async factory and reports a discriminated state.
 * Errors surface as readable text rather than being swallowed: a missing or
 * malformed recording is something the operator needs to see.
 */
export function useAsync<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });

    factory(controller.signal)
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, deps);

  return state;
}
