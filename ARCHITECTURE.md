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

## 2. Stack scelto

Lo stack è stato fissato in T0.1 e **non si cambia** a metà progetto (vedi `TASKS.md` sezione "Stack scelto"):

- **Framework**: **Vue 3** (Composition API + `<script setup>`). Vue era già presente nel progetto iniziale con tutta la toolchain configurata.
- **Lingua**: **TypeScript** (strict mode). Tipi rigorosi, no `any` non motivato.
- **Build tool**: **Vite** + `vite-plugin-pwa`.
- **Styling**: **CSS scoped** con CSS custom properties globali. Niente CSS-in-JS.
- **State management**: **Pinia** (sostituto ufficiale di Vuex, API più semplice).
- **Routing**: **Vue Router 4** con hash history (compatibile con static hosting senza config server-side).
- **Persistenza**: **Dexie** (wrapper Dexie.js su IndexedDB). `idb` o Dexie sono entrambi accettabili; Dexie è già installato.

## 3. Struttura di progetto (reale)

```
/
├── public/
│   ├── icons/              # icone PWA (192×192, 512×512, 180×180 apple-touch)
│   └── favicon.svg
├── src/
│   ├── domain/             # logica di business pura, zero dipendenze da Vue/Dexie/DOM
│   │   ├── types.ts        # Element, Dish, MealSlot, Week, MealType (nuovo modello — ✅ T1.1)
│   │   ├── week.ts         # getCurrentWeekId(), nextWeek(), weekIdToMonday(), ecc. — ✅ T1.2
│   │   ├── frequency.ts    # computeWeeklyFrequencies() — ✅ T1.3
│   │   ├── ranker.ts       # rankSuggestions() — ordinamento suggerimenti
│   │   ├── validator.ts    # validateWeek() — verifica vincoli
│   │   └── __tests__/      # test unitari Vitest
│   ├── storage/            # CRUD IndexedDB (nuovo layer — T1.4–T1.6)
│   │   ├── db.ts           # AppDB (Dexie), DB name MenuPlannerV2, schema v1 — ✅ T1.4
│   │   ├── elements.ts     # CRUD Elementi
│   │   ├── weeks.ts        # CRUD Settimane/Slot/Piatti
│   │   └── backup.ts       # export/import JSON
│   ├── data/               # repository Dexie esistenti (schema precedente)
│   │   ├── db.ts
│   │   ├── dishRepository.ts
│   │   ├── menuRepository.ts
│   │   └── settingsRepository.ts
│   ├── stores/             # Pinia stores (bridge UI ↔ data)
│   ├── views/              # pagine Vue: WeekView, DishesView, SettingsView, ImportExportView
│   ├── components/         # componenti riutilizzabili (IosInstallBanner, ecc.)
│   ├── io/                 # schema Zod per import/export JSON
│   ├── router/             # Vue Router (hash history)
│   ├── __tests__/          # test cross-cutting (sanity, ecc.)
│   ├── App.vue
│   ├── main.ts             # entry point
│   └── style.css
├── index.html
├── vite.config.ts
├── vitest.config.ts
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
