/**
 * @fileoverview Comprehensive ResizeObserver Error Suppression
 * 
 * Handles ResizeObserver loop errors at multiple levels to prevent them from
 * reaching webpack dev server and other error reporting systems. Implements
 * both prevention (patching ResizeObserver) and suppression (error handlers).
 */

import { useState, useEffect } from 'react';

export class ResizeObserverErrorHandler {
    private static instance: ResizeObserverErrorHandler | null = null;
    private originalErrorHandler: OnErrorEventHandler | null = null;
    private originalUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;
    private originalResizeObserver: typeof ResizeObserver | null = null;
    private suppressedCount = 0;
    private lastSuppressionTime = 0;

    static getInstance(): ResizeObserverErrorHandler {
        if (!ResizeObserverErrorHandler.instance) {
            ResizeObserverErrorHandler.instance = new ResizeObserverErrorHandler();
        }
        return ResizeObserverErrorHandler.instance;
    }

    private isResizeObserverLoopError(error: Error | string | any): boolean {
        const message = typeof error === 'string' ? error :
            (error?.message || error?.reason?.message || String(error));
        return (
            message.includes('ResizeObserver loop') ||
            message.includes('ResizeObserver loop completed with undelivered notifications') ||
            message.includes('ResizeObserver loop limit exceeded')
        );
    }

    install(): void {
        if (typeof window === 'undefined') return;

        this.installResizeObserverPatch();
        this.installErrorHandlers();
        
        console.log('[ResizeObserverErrorHandler] Comprehensive error handling installed');
    }    private installResizeObserverPatch(): void {
        if (!window.ResizeObserver) return;

        this.originalResizeObserver = window.ResizeObserver;
        const self = this;

        // Patch ResizeObserver to prevent errors at the source
        window.ResizeObserver = class PatchedResizeObserver extends self.originalResizeObserver!{
            constructor(callback: ResizeObserverCallback) {
                const wrappedCallback: ResizeObserverCallback = (entries, observer) => {
                    try {
                        callback(entries, observer);
                    } catch (error) {
                        if (self.isResizeObserverLoopError(error)) {
                            self.suppressedCount++;
                            self.lastSuppressionTime = Date.now();

                            if (self.suppressedCount <= 3 || self.suppressedCount % 10 === 0) {
                                console.info(
                                    `[ResizeObserver] Prevented loop error #${self.suppressedCount} at source`
                                );
                            }
                            return; // Suppress the error
                        }
                        throw error; // Re-throw other errors
                    }
                };

                super(wrappedCallback);
            }
        };

        // Preserve prototype and static properties
        Object.setPrototypeOf(window.ResizeObserver, this.originalResizeObserver);
        Object.defineProperty(window.ResizeObserver, 'name', { value: 'ResizeObserver' });
    }

    private installErrorHandlers(): void {
        // Store original handlers
        this.originalErrorHandler = window.onerror;
        this.originalUnhandledRejection = window.onunhandledrejection;

        // Hook into window.onerror for synchronous errors
        window.onerror = (message, source, lineno, colno, error) => {
            if (this.isResizeObserverLoopError(message as string)) {
                this.suppressedCount++;
                this.lastSuppressionTime = Date.now();

                if (this.suppressedCount <= 3 || this.suppressedCount % 10 === 0) {
                    console.info(
                        `[ResizeObserverErrorHandler] Suppressed error #${this.suppressedCount}`,
                        { message, source, lineno, colno }
                    );
                }

                return true; // Prevent default error handling (webpack overlay)
            }

            // Call original handler for other errors
            if (this.originalErrorHandler) {
                return this.originalErrorHandler(message, source, lineno, colno, error);
            }
            return false;
        };

        // Also hook into addEventListener to catch webpack's error listeners
        const originalAddEventListener = window.addEventListener;
        window.addEventListener = function(type: string, listener: any, options?: any) {
            if (type === 'error' && listener) {
                // Wrap the error listener to filter ResizeObserver errors
                const wrappedListener = (event: Event) => {
                    const errorEvent = event as ErrorEvent;
                    if (errorEvent.message && errorEvent.message.includes('ResizeObserver loop')) {
                        console.info('[ResizeObserverErrorHandler] Blocked ResizeObserver error from event listener');
                        return; // Don't call the original listener
                    }
                    return listener.call(window, event);
                };
                return originalAddEventListener.call(window, type, wrappedListener, options);
            }
            return originalAddEventListener.call(window, type, listener, options);
        };

        // Hook into unhandled promise rejections
        window.onunhandledrejection = (event) => {
            if (this.isResizeObserverLoopError(event.reason)) {
                this.suppressedCount++;
                this.lastSuppressionTime = Date.now();

                if (this.suppressedCount <= 3 || this.suppressedCount % 10 === 0) {
                    console.info(
                        `[ResizeObserverErrorHandler] Suppressed promise rejection #${this.suppressedCount}`,
                        { reason: event.reason }
                    );
                }

                event.preventDefault(); // Prevent default error handling
                return;
            }

            // Call original handler for other rejections
            if (this.originalUnhandledRejection) {
                this.originalUnhandledRejection(event);
            }
        };
    }

    uninstall(): void {
        if (typeof window === 'undefined') return;

        // Restore original handlers
        if (this.originalErrorHandler) {
            window.onerror = this.originalErrorHandler;
            this.originalErrorHandler = null;
        }

        if (this.originalUnhandledRejection) {
            window.onunhandledrejection = this.originalUnhandledRejection;
            this.originalUnhandledRejection = null;
        }

        if (this.originalResizeObserver) {
            window.ResizeObserver = this.originalResizeObserver;
            this.originalResizeObserver = null;
        }

        console.log(`[ResizeObserverErrorHandler] Uninstalled error handler (suppressed ${this.suppressedCount} errors)`);
    }

    getStats() {
        return {
            suppressedCount: this.suppressedCount,
            lastSuppressionTime: this.lastSuppressionTime,
        };
    }
}

/**
 * Hook to automatically install/uninstall the ResizeObserver error handler
 */
export function useResizeObserverErrorHandler() {
    const [handler] = useState(() => ResizeObserverErrorHandler.getInstance());

    useEffect(() => {
        handler.install();
        return () => handler.uninstall();
    }, [handler]);

    return handler.getStats();
}

// Auto-install the error handler as soon as this module is imported
// This ensures ResizeObserver is patched before any components try to use it
if (typeof window !== 'undefined') {
    const autoHandler = ResizeObserverErrorHandler.getInstance();
    autoHandler.install();
    
    console.log('[ResizeObserverErrorHandler] Auto-installed on module import');
}
