# MenuPlanner

PWA offline-first per la pianificazione di menù settimanali. Mono-utente, senza backend, senza autenticazione.

## Setup

```bash
npm install
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173) nel browser.

## Script disponibili

| Comando              | Descrizione                    |
|----------------------|-------------------------------|
| `npm run dev`        | Avvia il server di sviluppo    |
| `npm run build`      | Build di produzione            |
| `npm run preview`    | Anteprima del build            |
| `npm test`           | Esegui i test (una volta)      |
| `npm run test:watch` | Test in modalità watch         |
| `npm run lint`       | Esegui ESLint                  |

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
│   ├── types.ts     # Modello di dominio nuovo (Element, Dish, Week, MealSlot — T1.1)
│   ├── frequency.ts # computeWeeklyFrequencies() — T1.3
│   ├── week.ts      # getCurrentWeekId(), nextWeek(), ecc. — T1.2
│   ├── validator.ts # validateWeek() — verifica vincoli
│   ├── ranker.ts    # rankSuggestions() — ordinamento suggerimenti slot-per-slot
│   └── __tests__/   # Test unitari (Vitest)
├── storage/         # CRUD IndexedDB nuovo layer (T1.4–T1.6)
│   ├── db.ts        # Apertura DB, schema v1, migrazioni
│   ├── elements.ts  # CRUD Elementi
│   ├── weeks.ts     # CRUD Settimane/Slot/Piatti
│   └── backup.ts    # Export/import JSON
├── data/            # Repository Dexie esistenti
│   ├── db.ts        # Schema Dexie + istanza singleton
│   ├── dishRepository.ts
│   ├── menuRepository.ts
│   └── settingsRepository.ts
├── stores/          # Pinia stores (bridge UI ↔ data)
├── views/           # Pagine Vue (WeekView, DishesView, SettingsView, ImportExportView)
├── components/      # Componenti riutilizzabili (IosInstallBanner, ecc.)
├── io/              # Schema Zod per import/export JSON
├── router/          # Vue Router (hash history)
├── App.vue
└── main.ts
```

### Separazione domain / storage / UI

- **`domain/`** contiene solo logica pura TypeScript. Non dipende da Vue, Dexie, né dal DOM. È testabile senza mock.
- **`storage/`** incapsula tutta la persistenza IndexedDB per il nuovo modello dati (implementato nelle Fasi 1–6).
- **`data/`** contiene i repository Dexie del modello precedente (mantenuto durante la transizione).
- **`stores/`** (Pinia) fanno da ponte tra la UI e i repository: caricano dati, gestiscono lo stato reattivo, espongono azioni.
- **`views/`** e **`components/`** gestiscono solo la presentazione. Non parlano direttamente con Dexie o IndexedDB.

### Scelte tecniche

- **Vue Router con hash history** (`createWebHashHistory`): compatibile con deployment su server statici senza configurazione server-side.
- **Import/Export**: la strategia di default è *skip-on-conflict* (ignora elementi con la stessa `id`). L'opzione *overwrite* è disponibile tramite checkbox.
- **Icone PWA**: PNG placeholder 192×192, 512×512, 180×180 in verde `#2c6e49`. Verranno sostituite con icone definitive in T7.6.
