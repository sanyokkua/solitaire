import { startApp } from './app/lifecycle';
import { createInstallGateway } from './pwa/installGateway';
import { createDeferredPwaGateway } from './pwa/deferredGateway';
import { registerPwa } from './pwa/registerPwa';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

// The real gateways live only here: the install gateway listens from the start so an early `beforeinstallprompt` is
// not missed; the service worker registers after `load`, so it never delays the first render.
startApp(rootElement, {
    pwa: {
        update: createDeferredPwaGateway(window, document, registerPwa),
        install: createInstallGateway(window),
    },
});
