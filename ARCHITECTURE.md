# ARCHITECTURE — Meal Planner PWA

> Vincoli tecnici e decisioni architetturali. Non contiene requisiti funzionali (vedi `SPEC.md`). Lo stack specifico è lasciato all'agente, ma deve rispettare **tutti** i vincoli qui sotto.

## 1. Vincoli non negoziabili

### 1.1 Deployment

- **Solo file statici**. Nessun backend, nessuna funzione serverless. L'app deve essere deployabile su **GitHub Pages**, Netlify, Cloudflare Pages, o qualsiasi static host.
- **Build output** deve essere una cartella autoconsistente (es. `dist/`) con `index.html`, asset, manifest, service worker.

### 1.2 Compatibilità browser

- **Target primario**: Safari iOS 16.4+ (PWA installabile via "Add to Home Screen").
- **Target secondari**: Chrome desktop/Android, Firefox desktop, Safari macOS — versioni recenti (ultime 2 major).
- **Test obbligatorio prima di considerare un task chiuso**: la build deve aprirsi senza errori in console su Safari (può essere desktop in dev; iOS reale al primo deploy).

### 1.3 PWA (obbligatoria)

- `manifest.json` con: `name`, `short_name`, `icons` (incluso 512×512 e 192×192 e `apple-touch-icon`), `start_url`, `display: standalone`, `theme_color`, `background_color`.
- **Service worker** registrato con strategia `cache-first` per asset statici (app shell). L'app è offline-first (no chiamate di rete in runtime).
- **Meta tag iOS** richiesti: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, multipli `apple-touch-icon` per le varie dimensioni.
- L'app deve mostrare istruzioni manuali per "Add to Home Screen" su iOS (Safari non offre prompt automatico).

### 1.4 Storage

- **IndexedDB obbligatorio** per dati strutturati (Elementi, Piatti, Settimane). NON usare localStorage per questi.
- localStorage ammesso **solo** per: preferenze UI (tema, pasti collassati, ultima settimana visualizzata, data ultimo backup).
- Chiamare `navigator.storage.persist()` al primo avvio (best effort, non garantito su Safari ma da provare).
- **Wrapper consigliato**: `idb` (di Jake Archibald) o equivalente con API Promise. Evitare l'API IndexedDB raw che è verbosa e error-prone.
- **Schema versionato**: ogni schema IndexedDB ha una `version`. Migrazioni gestite esplicitamente in `onupgradeneeded`.

### 1.5 Lingua e accessibilità

- UI in **italiano**.
- Contrasti AA (WCAG 2.1) minimo.
- Tutte le azioni eseguibili da tastiera.
- Touch target ≥ 44×44px su mobile.

## 2. Stack: linee guida (l'agente sceglie il dettaglio)

L'agente può scegliere lo stack ma deve preferire:

- **Framework**: React, Svelte, o vanilla TS. **No Angular** (overkill). **No Vue** se non c'è motivo specifico (preferire React per ecosistema PWA/idb più maturo, o Svelte per bundle size).
- **Lingua**: **TypeScript obbligatorio**. Tipi rigorosi (no `any` se non motivato in commento).
- **Build tool**: **Vite** consigliato (PWA plugin maturo: `vite-plugin-pwa`). Webpack accettato solo se motivato.
- **Styling**: a scelta tra CSS modules, Tailwind, o vanilla CSS con custom properties. Evitare CSS-in-JS pesanti (styled-components ecc.) che gonfiano il bundle.
- **State management**: per la dimensione del progetto, basta context React + useReducer, oppure Zustand. **Niente Redux**.
- **Routing**: React Router o equivalente, oppure routing custom semplice (sono poche viste).

> L'agente deve **scrivere in cima a `TASKS.md` lo stack scelto** prima del task 0, motivando in 2-3 righe.

## 3. Struttura di progetto consigliata

```
/
├── public/
│   ├── icons/              # icone PWA (192, 512, apple-touch)
│   └── manifest.json       # generato o statico
├── src/
│   ├── domain/             # tipi e logica di business pura, no UI
│   │   ├── types.ts        # Element, Dish, MealSlot, Week, MealType
│   │   ├── frequency.ts    # calcolo frequenze settimanali
│   │   └── week.ts         # utility lun-dom, navigazione
│   ├── storage/            # accesso IndexedDB
│   │   ├── db.ts           # apertura DB, schema, migrazioni
│   │   ├── elements.ts     # CRUD Elementi
│   │   ├── weeks.ts        # CRUD Settimane/Slot/Piatti
│   │   └── backup.ts       # export/import JSON
│   ├── ui/
│   │   ├── components/     # componenti riutilizzabili
│   │   ├── pages/          # ElementsPage, WeekPage, ImportPage
│   │   └── App.tsx
│   ├── sw.ts               # service worker
│   └── main.tsx            # entry point
├── tests/                  # Vitest
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 4. Modello dati (riferimento)

> Prima bozza. L'agente può raffinarla, ma le **identità** e le **relazioni** devono restare queste.

```ts
type ID = string; // UUID v4

type FrequencyLimit = 1 | 2 | 3 | 4 | 5 | 'unlimited';

interface Element {
  id: ID;
  name: string;            // "formaggio", "carne rossa", "verdura"
  maxFrequencyPerWeek: FrequencyLimit;
  createdAt: number;
  updatedAt: number;
}

type MealType = 'colazione' | 'merenda_mattina' | 'pranzo' | 'merenda_pomeriggio' | 'cena';
type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=lun, 7=dom

interface Dish {
  id: ID;
  name: string;            // "mozzarella e insalata con pane" (testo libero, qui vive il dettaglio specifico)
  elementIds: ID[];        // riferimenti agli Elementi (categorie): ["formaggio_id", "verdura_id", "pane_id"]
}

interface MealSlot {
  day: DayOfWeek;
  meal: MealType;
  dishes: Dish[];          // tipicamente uno
}

interface Week {
  id: ID;                  // formato "YYYY-Www" (ISO week)
  isoWeekStart: string;    // "2026-05-04" (lunedì)
  slots: MealSlot[];
  updatedAt: number;
}
```

> **Nota importante**: NON esiste un'entità `Category` separata. L'Elemento (`formaggio`, `carne rossa`, ecc.) È la categoria. Il dettaglio dell'ingrediente specifico (mozzarella, primosale, parmigiano) vive solo come testo libero in `Dish.name`.

### Formato file export

```json
{
  "format": "meal-planner-export",
  "version": 1,
  "exportedAt": "2026-05-04T10:00:00Z",
  "elements": [...],
  "weeks": [...]
}
```

- **Versioning obbligatorio**: il campo `version` permette retrocompatibilità futura. L'import valida la versione e rifiuta formati ignoti con messaggio chiaro.
- **JSON puro**, niente compressione. La dimensione è trascurabile (decine di KB).

## 5. Testing

- **Unit test** obbligatori per `domain/` e `storage/` (logica frequenze, parsing settimana, validazione import).
- **Component test** consigliati per componenti complessi (form inserimento piatto, vista settimanale).
- **No E2E** per la v1 (overhead non giustificato per single-dev).
- Framework: **Vitest** (allineato a Vite).

## 6. Qualità del codice

- **ESLint + Prettier** configurati.
- **Pre-commit hook** opzionale (Husky + lint-staged) — l'agente può saltarlo se appesantisce.
- **Conventional commits** consigliati ma non obbligatori.
- Ogni PR/task chiusa: build + test passano.

## 7. Cosa NON fare

- ❌ Non aggiungere autenticazione.
- ❌ Non aggiungere chiamate di rete a terze parti (analytics, font CDN runtime, ecc.). I font vanno bundlati o self-hosted per lavorare offline.
- ❌ Non usare localStorage per i dati di dominio.
- ❌ Non aggiungere dipendenze "grasse" (lodash intero, moment.js → usare date-fns o native Intl).
- ❌ Non implementare feature out-of-scope (sezione 6 di SPEC.md) anche se sembrano facili.
- ❌ Non introdurre un'entità `Category` separata dall'Elemento. L'Elemento È la categoria.
