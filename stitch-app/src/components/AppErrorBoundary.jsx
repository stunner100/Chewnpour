import { Component } from 'react';
import {
    attemptChunkRecoveryReload,
    isChunkLoadError,
    isStaleConvexClientError,
} from '../lib/chunkLoadRecovery.js';
import { captureSentryException } from '../lib/sentry.js';

class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        if (isChunkLoadError(error) && attemptChunkRecoveryReload('chunk-load')) {
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
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
                        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                            We captured this issue. Please refresh and try again.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;
