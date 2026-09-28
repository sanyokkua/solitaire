/** The descriptor present before any test replaces `navigator.clipboard` (jsdom has none by default). */
const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function install(value: unknown): void {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value });
}

/** Installs a `navigator.clipboard.writeText` that resolves and records every copied string, in order. */
export function stubClipboard(): { readonly copied: string[] } {
    const copied: string[] = [];
    install({
        writeText: (text: string) => {
            copied.push(text);
            return Promise.resolve();
        },
    });
    return { copied };
}

/** Installs a `navigator.clipboard.writeText` that always rejects, as a denied permission would. */
export function stubRejectingClipboard(): void {
    install({ writeText: () => Promise.reject(new Error('clipboard write refused')) });
}

/** Removes `navigator.clipboard`, as on a browser with no Clipboard API. */
export function stubMissingClipboard(): void {
    install(undefined);
}

/** Puts back the `navigator.clipboard` present before the stub, or removes it if there was none; call in `afterEach`. */
export function restoreClipboard(): void {
    if (originalDescriptor) Object.defineProperty(navigator, 'clipboard', originalDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
}
