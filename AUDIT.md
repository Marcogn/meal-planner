# Audit MenuPlanner

## Sintesi esecutiva

Il progetto è strutturato con cura: la separazione a strati (domain / data / stores / views) è rispettata, il modello di dominio è corretto e tutti i 9 test passano. Le funzioni di validazione e ranking sono pure e corrette. Tuttavia, ci sono **due bug bloccanti**: le icone PNG per il PWA sono placeholder 1×1 px (l'installazione su home screen non funzionerà) e ESLint è completamente rotto perché usa il formato legacy `.eslintrc.cjs` con ESLint v10 che richiede il nuovo flat config. Qualità del codice generale: buona, con alcune deviazioni di spec minori.

---

## Risultati per sezione

### A. Modello di dominio

- ✅ **ProteinCategory**: contiene esattamente gli 8 valori richiesti: `CARNE_ROSSA`, `CARNE_BIANCA`, `PESCE`, `LEGUMI`, `UOVA`, `FORMAGGIO`, `CEREALI`, `ALTRO`. (`src/domain/types.ts:1-9`)
- ✅ **MealSlot**: contiene esattamente `PRANZO` e `CENA`. (`src/domain/types.ts:11`)
- ✅ **Dish.proteinCategories**: è `ProteinCategory[]` (array). (`src/domain/types.ts:16`)
- ⚠️ **Meal.date**: dichiarato come `string` senza validazione runtime del formato `YYYY-MM-DD`. Generato con `d.toISOString().slice(0, 10)` in `WeekView.vue:31` — corretto in pratica ma non verificato nel tipo o nello schema Zod (`src/io/schemas.ts:29`: `z.string()` senza `.regex`).
- ⚠️ **WeeklyMenu.isoWeek**: formato `YYYY-Www` non è validato con regex. Lo schema Zod usa solo `z.string()` (`src/io/schemas.ts:33`). Non c'è runtime guard contro valori malformati.
- ✅ **FrequencyConstraint**: ha `minPerWeek?: number` e `maxPerWeek?: number`, entrambi opzionali. (`src/domain/types.ts:34-38`)
- ✅ **Settings.constraints**: default inizializzato a `[]` (array vuoto), mai pre-popolato. (`src/data/settingsRepository.ts:7`)

---

### B. Validator

- ✅ **Funzione pura**: `src/domain/validator.ts` importa solo da `./types` — nessun import da Dexie, Vue, Pinia, DOM.
- ✅ **Firma corretta**: `validateWeek(menu: WeeklyMenu, dishes: Dish[], constraints: FrequencyConstraint[]): ConstraintViolation[]`. (`src/domain/validator.ts:9-13`)
- ✅ **Multi-categoria**: il loop interno `for (const cat of dish.proteinCategories)` conta il piatto per ciascuna categoria. (`src/domain/validator.ts:20-22`)
- ✅ **UNDER_MIN solo se definito**: generato solo quando `constraint.minPerWeek !== undefined`. (`src/domain/validator.ts:37`)
- ✅ **OVER_MAX solo se definito e superato**: generato solo quando `constraint.maxPerWeek !== undefined && count > constraint.maxPerWeek`. (`src/domain/validator.ts:29`)
- ✅ **dishId sconosciuto non causa crash**: `if (!dish) continue` su riga 19 gestisce correttamente i pasti con dishId assente.

---

### C. Ranker

- ✅ **Funzione pura**: `src/domain/ranker.ts` importa solo da `./types` — nessun import da Dexie, Vue, Pinia, DOM.
- ✅ **Piatti oltre maxPerWeek filtrati**: la condizione `if (wouldViolateMax) continue` esclude completamente i piatti dalla lista di output. (`src/domain/ranker.ts:56`)
- ✅ **Bonus per min non soddisfatto**: `score += 10` quando il piatto copre una categoria con `minPerWeek` non ancora raggiunto. (`src/domain/ranker.ts:64-66`)
- ✅ **Penalità recente è LINEARE**: formula `maxPenalty * (1 - (weeksAgo - 1) / Math.max(recencyWindowWeeks - 1, 1))`. Produce: weeksAgo=1 → -5, weeksAgo=2 → -3.33, weeksAgo=3 → -1.67, weeksAgo=4 → 0. Confermata lineare. (`src/domain/ranker.ts:75-76`)
- ✅ **Lookback rispetta recencyWindowWeeks**: la condizione `weeksAgo <= recencyWindowWeeks` è verificata. (`src/domain/ranker.ts:73`)
- ✅ **Output ordinato per score decrescente**: `results.sort((a, b) => b.score - a.score)`. (`src/domain/ranker.ts:84`)
- ⚠️ **weekOrdinal ha un bug di confine d'anno per anni con 52 settimane**: la funzione usa `year * 53 + weekNumber`. Per anni con 52 settimane ISO (es. 2025), `2025-W52` e `2026-W01` hanno ordinali che differiscono di 2 anziché 1. Questo causa una lieve sovrastima della recenza in quell'unica settimana di transizione. (`src/domain/ranker.ts:17-20`)

---

### D. Test di dominio

#### validator.test.ts (`src/domain/__tests__/validator.test.ts`)
- ✅ **Chiama la funzione reale** `validateWeek`, non è tautologico.
- ✅ **Settimana vuota con vincoli min → tutti UNDER_MIN**: test presente, verifica `length === 2` e `type === 'UNDER_MIN'`. (riga 28-37)
- ✅ **Categoria oltre maxPerWeek → OVER_MAX**: test presente, verifica tipo, valore corrente e soglia. (riga 39-48)
- ✅ **Vincolo soddisfatto → nessuna violazione**: test presente. (riga 50-56)
- ✅ **Piatto multi-categoria conta per ciascuna categoria**: test presente, usa `UOVA`+`FORMAGGIO` con `maxPerWeek: 0`, verifica 2 violazioni. (riga 58-68)

#### ranker.test.ts (`src/domain/__tests__/ranker.test.ts`)
- ✅ **Piatto che copre min mancante > piatto generico**: test presente e verifica `scoreD1 > scoreD2`. (riga 25-41)
- ✅ **Piatto che violerebbe max non è nei risultati**: test presente con `expect(...).toBeUndefined()`. (riga 43-58)
- ✅ **Recenza: usato 1 settimana fa ha score < usato 4 settimane fa**: test presente. (riga 60-78)

#### io.test.ts (`src/domain/__tests__/io.test.ts`)
- ✅ **Import con schemaVersion sconosciuta → throw con messaggio**: verifica il throw e il pattern `/versione/i`. (riga 36-38)
- ✅ **Round-trip export → import preserva i dati**: serializza e ri-parsa, verifica dishes, menus e settings. (riga 40-48)
- ✅ **Tutti i test non sono tautologici** — le asserzioni verificano comportamento reale.

#### Esecuzione `pnpm test`
```
 RUN  v4.1.5 /home/runner/work/menu-planner/menu-planner

 ✓ src/domain/__tests__/ranker.test.ts (3 tests) 6ms
 ✓ src/domain/__tests__/validator.test.ts (4 tests) 10ms
 ✓ src/domain/__tests__/io.test.ts (2 tests) 7ms

 Test Files  3 passed (3)
      Tests  9 passed (9)
   Start at  20:14:49
   Duration  1.47s (transform 128ms, setup 0ms, import 256ms, tests 23ms, environment 3.23s)
```

---

### E. Data layer

- ✅ **db.ts definisce 3 store Dexie**: `dishes`, `meals`, `settings`. (`src/data/db.ts:15-19`)
- ⚠️ **Migrazioni**: presente solo `db.version(1)`. La struttura supporta future versioni aggiuntive, ma attualmente non c'è storico di migrazione. (`src/data/db.ts:15`)
- ✅ **No type leakage**: i repository espongono `Promise<Dish[]>`, `Promise<WeeklyMenu>`, `Promise<Settings>` — nessun `Table<T>` esposto all'esterno. (`src/data/dishRepository.ts`, `src/data/menuRepository.ts`, `src/data/settingsRepository.ts`)
- ✅ **Primary key `id`**: ogni store usa `id` come chiave primaria. (`src/data/db.ts:16-18`)
- ✅ **`put` per create e update**: tutti i repository usano `put` o `bulkPut`, non `add`. (`src/data/dishRepository.ts:9`, `src/data/menuRepository.ts:35`, `src/data/settingsRepository.ts:19`)
- ⚠️ **Funzione `getIsoWeek` duplicata**: identica implementazione presente sia in `src/data/menuRepository.ts:4-12` sia in `src/views/WeekView.vue:10-17`. Non è estratta in un modulo utilitario condiviso.

---

### F. Import/Export

- ✅ **Schema Zod presente**: `ExportSchema` completo in `src/io/schemas.ts:50-56`.
- ✅ **`schemaVersion: 1` validato esplicitamente**: `z.literal(SUPPORTED_SCHEMA_VERSION)` con `SUPPORTED_SCHEMA_VERSION = 1`. (`src/io/schemas.ts:48-51`)
- ✅ **Messaggio di errore chiaro per versione non supportata**: `"Versione schema non supportata: ${version}. Versione attesa: ${SUPPORTED_SCHEMA_VERSION}."` (`src/io/schemas.ts:64-66`)
- ✅ **Strategia skip-on-conflict implementata di default**: filtra per `existingDishIds` e `existingMealIds`. (`src/views/ImportExportView.vue:50-62`)
- ✅ **Opzione overwrite presente e funzionale**: checkbox `v-model="overwrite"` che condiziona `bulkPut` su tutti i dati. (`src/views/ImportExportView.vue:14`, `src/views/ImportExportView.vue:45-48`)

---

### G. PWA

- ✅ **vite.config.ts configura `vite-plugin-pwa`**: `VitePWA({ registerType: 'autoUpdate', ... })`. (`vite.config.ts:8`)
- ✅ **Manifest completo**: `name`, `short_name`, `display: 'standalone'`, `theme_color`, `background_color`, `start_url` tutti presenti. (`vite.config.ts:11-22`)
- ❌ **ICONE PNG PLACEHOLDER 1×1 px** — BUG BLOCCANTE:
  - `public/icons/icon-192.png`: dimensioni reali `(1, 1)` — dovrebbe essere 192×192
  - `public/icons/icon-512.png`: dimensioni reali `(1, 1)` — dovrebbe essere 512×512
  - Verifica: `python3 -c "import struct,sys; d=open(sys.argv[1],'rb').read(); print(struct.unpack('>II',d[16:24]))" public/icons/icon-192.png` → `(1, 1)`
  - L'installazione PWA su home screen genererà un'icona invisibile/corrotta.
- ⚠️ **Service worker non registrato esplicitamente in `main.ts`**: con `registerType: 'autoUpdate'`, VitePWA inietta automaticamente la registrazione nel bundle (si vede `dist/registerSW.js` nel build). Non è tecnicamente assente ma non è visibile nel codice sorgente dell'applicazione.

---

### H. Architettura e separazione dei layer

- ✅ **Domain non importa da Dexie/Vue/Pinia**: comando `grep -rE "from ['\"](dexie|vue|pinia|@/data|@/stores|@/views)" src/domain/` → nessun risultato.
- ✅ **Views non importano direttamente da `src/data/`**: comando `grep -rE "from ['\"](@/data|\.\./data)" src/views/ src/components/` → nessun risultato. Tutte le viste accedono ai dati tramite store Pinia.

---

### I. Funzionalità UI (analisi statica)

- ✅ **WeekView con griglia 7×2**: due righe (`v-for="slot in SLOTS"` dove `SLOTS=['PRANZO','CENA']`) × sette colonne (`v-for="date in dates"` dove `dates` è un array di 7 date). (`src/views/WeekView.vue:180-194`)
- ✅ **DishesView con ricerca testuale e filtro categoria**: `<input v-model="search">` e `<select v-model="filterCat">` presenti. (`src/views/DishesView.vue:104-108`)
- ✅ **SettingsView con editor FrequencyConstraint[] e recencyWindowWeeks**: tabella editabile per i vincoli (`src/views/SettingsView.vue:78-107`) e campo numerico per la finestra di recenza (`src/views/SettingsView.vue:64-71`).
- ✅ **ImportExportView con pulsante export, input file import e checkbox overwrite**: tutti presenti. (`src/views/ImportExportView.vue:80-93`)
- ✅ **Status panel in WeekView con indicatori verde/giallo/rosso**: sezione presente (`src/views/WeekView.vue:198-215`) con classi CSS `status-ok` (verde `#1a7a1a`), `status-warn` (giallo `#b87a00`), `status-error` (rosso `#cc0000`) definite in `src/style.css:34-36`.
- ⚠️ **WeekView status panel usa logica propria** invece di chiamare `validateWeek()` dal dominio. La logica è equivalente ma aggiunge uno stato "incompleto" (warn) non previsto dal validator. Duplicazione di logica di business. (`src/views/WeekView.vue:139-161`)

---

### J. Build e qualità

- ✅ **`pnpm install` completato senza errori**: 564 pacchetti installati.
- ✅ **`pnpm build` completato senza errori**: vue-tsc + vite build, nessun warning. Service worker generato (`dist/sw.js`), 24 entry precachiate. (`pnpm build` output sopra)
- ❌ **`pnpm lint` FALLISCE**: il progetto usa `.eslintrc.cjs` (formato legacy) ma dipende da ESLint v10 (`"eslint": "^10.3.0"`) che richiede il nuovo formato `eslint.config.(js|mjs|cjs)`. Errore: `"ESLint couldn't find an eslint.config.(js|mjs|cjs) file"`.
- ✅ **`strict: true` abilitato**: tramite ereditarietà da `@vue/tsconfig/tsconfig.json` che imposta `"strict": true`. Confermato presente nella chain di estensione.
- ⚠️ **Dipendenza extra `uuid`** (`"uuid": "^14.0.0"`) come runtime dependency non necessaria: i browser moderni espongono `crypto.randomUUID()` nativamente. Aumenta il bundle senza necessità.
- ⚠️ **File residuo dallo scaffolding Vite**: `src/components/HelloWorld.vue` non è utilizzato da nessun componente o view. È un artefatto di `npm create vue`.

---

## Test eseguiti

Output di `pnpm test`:
```
> meal-planner@0.0.0 test /home/runner/work/menu-planner/menu-planner
> vitest run


 RUN  v4.1.5 /home/runner/work/menu-planner/menu-planner

 ✓ src/domain/__tests__/ranker.test.ts (3 tests) 6ms
 ✓ src/domain/__tests__/validator.test.ts (4 tests) 10ms
 ✓ src/domain/__tests__/io.test.ts (2 tests) 7ms

 Test Files  3 passed (3)
      Tests  9 passed (9)
   Start at  20:14:49
   Duration  1.47s (transform 128ms, setup 0ms, import 256ms, tests 23ms, environment 3.23s)
```

---

## Bug bloccanti

1. **Icone PWA 1×1 px** (`public/icons/icon-192.png`, `public/icons/icon-512.png`): entrambe le icone sono placeholder 1×1 pixel. Qualsiasi utente che installa la PWA sulla home screen vedrà un'icona invisibile/corrotta. Il manifest è corretto ma le immagini non lo sono.

2. **ESLint non funzionante** (`.eslintrc.cjs` + ESLint v10): il comando `pnpm lint` fallisce con errore fatale. Non è possibile eseguire il linter, il che blocca qualsiasi pipeline CI/CD che lo includa.

---

## Bug non bloccanti

1. **`weekOrdinal` inaccurato al confine d'anno per anni con 52 settimane ISO** (`src/domain/ranker.ts:17-20`): la formula `year * 53 + weekNum` produce una differenza di 2 tra l'ultima settimana di un anno a 52 settimane e la prima dell'anno successivo (es. `2025-W52` → `2026-W01` = diff 2 anziché 1). Causa una lieve sottostima della recenza in quella transizione specifica.

2. **`isoWeek` e `Meal.date` non validati con regex** negli schemi Zod: `WeeklyMenuSchema.isoWeek` (`src/io/schemas.ts:33`) e `MealSchema.date` (`src/io/schemas.ts:29`) sono `z.string()` senza pattern. Valori malformati come `"2026-W1"` o `"27-04-2026"` passano la validazione silenziosamente.

3. **`getIsoWeek` duplicata** tra `src/data/menuRepository.ts:4-12` e `src/views/WeekView.vue:10-17`: stessa logica non estratta in un modulo utilitario condiviso. Modifiche future rischiano disallineamento.

4. **WeekView status panel non usa `validateWeek()`** (`src/views/WeekView.vue:139-161`): la logica di stato è reimplementata localmente anziché delegare al validatore di dominio. Duplicazione di logica di business.

5. **Dipendenza runtime `uuid` non necessaria** (`package.json:17`): `crypto.randomUUID()` è disponibile in tutti i browser target supportati da Vue 3. La dipendenza `uuid@14` aggiunge ~3 KB al bundle.

6. **`src/components/HelloWorld.vue` inutilizzato**: residuo dello scaffolding Vite, non importato da nessuna parte.

7. **Titolo HTML non aggiornato** (`index.html:6`): `<title>meal-planner</title>` invece di `MenuPlanner`.

8. **Nessun test di integrazione store/data** né test per i componenti Vue: la coverage è limitata al solo layer di dominio.

---

## Punti di forza

- **Separazione dei layer esemplare**: il dominio non conosce Dexie, Vue o Pinia; le view non accedono direttamente al database. La pipeline `view → store → repository → db` è rispettata ovunque.
- **Funzioni di dominio pure e ben testate**: `validator.ts` e `ranker.ts` sono privi di side effects, facilmente testabili e già coperti da test significativi (non tautologici).
- **Schema Zod robusto con versioning**: `parseExport` gestisce schemaVersion incompatibili con messaggio localizzato in italiano, e lo schema valida UUID, enum e tipi numerici correttamente.
- **Build pulita e veloce**: `pnpm build` completa senza warning in ~300ms, il PWA con workbox è configurato correttamente (eccetto le icone).
- **UI completa e funzionale staticamente**: tutte e 4 le view richieste sono presenti con le funzionalità previste dalla spec (griglia 7×2, filtri, editor vincoli, import/export con overwrite).

---

## Raccomandazioni prioritizzate

1. **[CRITICO] Sostituire le icone PNG placeholder** con immagini reali 192×192 e 512×512. Usare strumenti come `sharp`, `Inkscape` o servizi online per esportare dal file `public/icons.svg` già presente. Senza questo il PWA non è installabile correttamente.

2. **[CRITICO] Migrare la configurazione ESLint al flat config format** (`eslint.config.js`) compatibile con ESLint v10. Il file `.eslintrc.cjs` deve essere convertito seguendo la migration guide ufficiale, oppure fare downgrade a ESLint v8 (non raccomandato).

3. **[MEDIO] Aggiungere validazione regex agli schemi Zod** per `isoWeek` (`/^\d{4}-W\d{2}$/`) e `Meal.date` (`/^\d{4}-\d{2}-\d{2}$/`) in `src/io/schemas.ts`. Questo migliora la robustezza dell'import e previene stati inconsistenti nel database.

4. **[MEDIO] Estrarre `getIsoWeek` in un modulo utilitario** (es. `src/utils/isoWeek.ts`) e usarlo in `menuRepository.ts` e `WeekView.vue`. Eliminare la duplicazione.

5. **[BASSO] Sostituire `uuid` con `crypto.randomUUID()`** nelle view (`WeekView.vue` e `DishesView.vue`) e rimuovere la dipendenza da `package.json`. Riduce il bundle e rimuove una dependency.

6. **[BASSO] Correggere `weekOrdinal`** in `ranker.ts` usando il calcolo corretto (es. conversioneiso week → timestamp UNIX e divisione per 7 giorni) per evitare il bug al confine d'anno per anni con 52 settimane ISO.

7. **[BASSO] Eliminare `src/components/HelloWorld.vue`** e aggiornare il `<title>` in `index.html` a `MenuPlanner`.
