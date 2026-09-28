import { registerSW } from 'virtual:pwa-register';
import { createPwaGateway, type PwaGateway } from './pwaGateway';

/** Registers the service worker and returns the update gateway. The only importer of `virtual:pwa-register`. */
export function registerPwa(): PwaGateway {
    return createPwaGateway(registerSW);
}
