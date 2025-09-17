/**
 * Lightweight category-based logger to reduce console noise.
 * Enable categories via (window as any).__HYDRO_LOGS = 'layout,lock,op,retry'; (comma separated)
 * or process.env.HYDRO_LOGS at build time. Unknown categories are ignored.
 */
export type HydroLogCategory = 'layout' | 'lock' | 'op' | 'retry' | 'toggle' | 'fit' | 'metrics' | 'ro' | 'orchestrator' | 'pack';

function getEnabled(): Set<string> {
    if (typeof window !== 'undefined' && (window as any).__HYDRO_LOGS) {
        return new Set(String((window as any).__HYDRO_LOGS).split(',').map(s => s.trim()).filter(Boolean));
    }
    if (typeof process !== 'undefined' && process.env.HYDRO_LOGS) {
        return new Set(process.env.HYDRO_LOGS.split(',').map(s => s.trim()).filter(Boolean));
    }
    // Default minimal categories useful for current debugging focus (noise trimmed)
    return new Set(['layout', 'lock', 'retry']);
}

let enabled = getEnabled();

export function refreshLoggerConfig() {
    enabled = getEnabled();
}

function base(category: HydroLogCategory, level: 'log' | 'warn' | 'error' | 'info', args: any[]) {
    if (!enabled.has(category)) return;
    // eslint-disable-next-line no-console
    (console as any)[level](`[${category}]`, ...args);
}

export const hscopeLogger = {
    log: (cat: HydroLogCategory, ...args: any[]) => base(cat, 'log', args),
    info: (cat: HydroLogCategory, ...args: any[]) => base(cat, 'info', args),
    warn: (cat: HydroLogCategory, ...args: any[]) => base(cat, 'warn', args),
    error: (cat: HydroLogCategory, ...args: any[]) => base(cat, 'error', args),
};
