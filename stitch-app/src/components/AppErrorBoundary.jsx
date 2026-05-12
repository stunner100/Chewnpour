import { Component } from 'react';
import {
    attemptChunkRecoveryReload,
    redirectForStaleTopicRoute,
    isChunkLoadError,
    isStaleConvexClientError,
    isStaleTopicRouteLookupError,
} from '../lib/chunkLoadRecovery.js';
import { captureSentryException } from '../lib/sentry.js';

class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error instanceof Error ? error.message : String(error || ''),
        };
    }

    componentDidCatch(error, errorInfo) {
        if (import.meta.env.DEV) {
            console.error('[AppErrorBoundary]', error, errorInfo);
        }

        if (isChunkLoadError(error) && attemptChunkRecoveryReload('chunk-load')) {
            return;
        }

        if (isStaleTopicRouteLookupError(error) && redirectForStaleTopicRoute()) {
            return;
        }

        if (isStaleConvexClientError(error) && attemptChunkRecoveryReload('stale-convex-client')) {
            return;
        }

        captureSentryException(error, {
            tags: {
                area: 'react_error_boundary',
            },
            extras: {
                componentStack: errorInfo?.componentStack,
            },
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark px-6 text-center">
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Something went wrong</h1>
                        <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-300">
                            We captured this issue. Please refresh and try again.
                        </p>
                        {import.meta.env.DEV && this.state.errorMessage && (
                            <pre className="mt-4 max-w-xl whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 text-left text-xs text-zinc-700">
                                {this.state.errorMessage}
                            </pre>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;
