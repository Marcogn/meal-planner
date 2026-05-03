# MenuPlanner

PWA offline-first per la pianificazione di menù settimanali. Mono-utente, senza backend, senza autenticazione.

## Setup

```bash
pnpm install
pnpm dev
```

Apri [http://localhost:5173](http://localhost:5173) nel browser.

## Script disponibili

| Comando          | Descrizione                    |
|------------------|-------------------------------|
| `pnpm dev`       | Avvia il server di sviluppo    |
| `pnpm build`     | Build di produzione            |
| `pnpm preview`   | Anteprima del build            |
| `pnpm test`      | Esegui i test (una volta)      |
| `pnpm test:watch`| Test in modalità watch         |
| `pnpm lint`      | Esegui ESLint                  |

## Installazione PWA su Chrome Android

1. Apri l'URL dell'app in Chrome.
2. Tocca il menu ⋮ in alto a destra.
3. Seleziona **"Aggiungi a schermata Home"** (o "Installa app").
4. Conferma. L'app apparirà nella schermata home come applicazione nativa.

## Installazione PWA su Safari iOS (16.4+)

1. Apri l'URL dell'app in Safari.
2. Tocca l'icona **Condividi** (il rettangolo con la freccia in su).
3. Scorri e seleziona **"Aggiungi a schermata Home"**.
4. Dai un nome all'app e conferma con **"Aggiungi"**.

> **Nota sulla persistenza su iOS:** Apple può svuotare l'archiviazione IndexedDB delle web app non installate dopo 7 giorni di inattività. Dopo l'installazione sulla schermata home, la persistenza è garantita purché l'app venga aperta periodicamente.

## Architettura

```
src/
├── domain/          # Logica pura, zero dipendenze da Vue/Dexie/DOM
│   ├── types.ts     # Definizioni TypeScript del modello di dominio
│   ├── validator.ts # validateWeek() — funzione pura per verificare i vincoli
│   ├── ranker.ts    # rankSuggestions() — ordinamento suggerimenti slot-per-slot
│   └── __tests__/   # Test unitari (Vitest)
├── data/            # Repository pattern su Dexie (IndexedDB)
│   ├── db.ts        # Schema Dexie + istanza singleton
│   ├── dishRepository.ts
│   ├── menuRepository.ts
│   └── settingsRepository.ts
├── stores/          # Pinia stores (bridging UI ↔ data)
├── views/           # Pagine Vue (WeekView, DishesView, SettingsView, ImportExportView)
├── components/      # Componenti riutilizzabili
├── io/              # Schema Zod per import/export JSON
├── router/          # Vue Router (hash history)
├── App.vue
└── main.ts
```

### Separazione domain / data / UI

- **`domain/`** contiene solo logica pura TypeScript. Non dipende da Vue, Dexie, né dal DOM. È testabile senza mock.
- **`data/`** incapsula tutta la persistenza. I repository traducono le operazioni di dominio in query Dexie.
- **`stores/`** (Pinia) fanno da ponte tra la UI e i repository: caricano dati, gestiscono lo stato reattivo, espongono azioni.
- **`views/`** e **`components/`** gestiscono solo la presentazione. Non parlano direttamente con Dexie.

### Scelte non specificate nelle istruzioni

- **Vue Router con hash history** (`createWebHashHistory`): compatibile con deployment su server statici senza configurazione server-side.
- **Import/Export**: la strategia di default è *skip-on-conflict* (ignora elementi con la stessa `id`). L'opzione *overwrite* è disponibile tramite checkbox.
- **Icone PWA**: placeholder monocromatici 1×1 px (verde `#2c6e49`). Sostituire con icone reali prima del rilascio.
