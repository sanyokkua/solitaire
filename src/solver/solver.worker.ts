import { handleRequest, type SolverRequest } from './protocol';

self.onmessage = (e: MessageEvent<SolverRequest>) => {
    handleRequest(e.data, (m) => {
        self.postMessage(m);
    });
};
