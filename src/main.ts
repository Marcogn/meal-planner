import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { router } from './router';
import App from './App.vue';
import './style.css';

// Richiede la persistenza dello storage al primo avvio (T1.7).
// Previene l'eviction automatica dei dati IndexedDB da parte del browser
// (es. Safari iOS svuota i dati dopo 7 giorni se non si usa "Aggiungi a Home").
if (navigator.storage?.persist) {
  navigator.storage.persist().then((granted) => {
    console.log(`[storage.persist] granted: ${granted}`);
  });
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
