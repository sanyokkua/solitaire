import { startApp } from './app/lifecycle';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

startApp(rootElement);
