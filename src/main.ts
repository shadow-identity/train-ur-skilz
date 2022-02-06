import App from './App/App.svelte';
import { storeDefaultSymbols } from './App/db';

const app = new App({
	target: document.body,
	props: {
		// name: 'world'
	}
});

storeDefaultSymbols()
// if ('serviceWorker' in navigator) {
// 	navigator.serviceWorker.register('build/sw.js');
// }

export default app;