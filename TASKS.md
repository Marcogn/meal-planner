# TASKS — Meal Planner PWA

> File operativo. L'agente lavora **un task alla volta**, in ordine, e aggiorna le checkbox a fine task. Ogni task è chiuso quando: codice scritto, test (se previsti) passano, build non rompe.
>
> **Regola d'oro**: prima di ogni task, l'agente rilegge `SPEC.md` (sezione/i pertinenti) e `ARCHITECTURE.md` (vincoli pertinenti). Se trova un'ambiguità non risolvibile, **chiede all'utente** invece di indovinare.

---

## Stack scelto

- Framework: **Vue 3** (Composition API + `<script setup>`)
- Linguaggio: **TypeScript** (strict mode)
- Build tool: **Vite** + `vite-plugin-pwa`
- Styling: **CSS scoped** (CSS modules per componenti, CSS custom properties globali)
- State management: **Pinia**
- Routing: **Vue Router 4** (hash history per compatibilità GitHub Pages)
- Motivazione: Vue era già presente nel progetto iniziale con tutta la toolchain configurata (Vite, Pinia, Vue Router, vite-plugin-pwa). Pinia è il sostituto ufficiale di Vuex e ha un'API più semplice di Zustand per Vue. Hash history evita problemi di 404 su static host senza configurazione server-side.

---

## Fase 0 — Setup

- [x] **T0.1** Inizializzare progetto Vite + TS + framework scelto. Configurare ESLint + Prettier. Verificare che `npm run dev` apra una pagina vuota e `npm run build` produca `dist/`.
  - Stack: Vue 3 + Vite + TS + Pinia + Vue Router. ESLint migrato a flat config (v10). Build e test passano.
- [x] **T0.2** Configurare PWA: `vite-plugin-pwa` (o equivalente), `manifest.json`, icone placeholder (512, 192, apple-touch 180). Aggiungere meta tag iOS in `index.html`. Verificare che Lighthouse o equivalente confermi "Installable".
  - Icone PNG valide generate (192, 512, 180). Manifest aggiornato (name, short_name, lang, icons). Meta tag iOS in `index.html`. Banner "Aggiungi a schermata Home" per Safari iOS in `IosInstallBanner.vue`.
- [x] **T0.3** Configurare Vitest. Scrivere un test sentinella `describe('sanity', () => it('runs', () => expect(1).toBe(1)))` e farlo passare.
  - vitest.config.ts già presente. Sentinella in `src/__tests__/sanity.test.ts`. 10 test passano.
- [x] **T0.4** Creare struttura cartelle come da `ARCHITECTURE.md` sezione 3. File vuoti o stub.
  - Creati stub: `src/storage/{db,elements,weeks,backup}.ts`, `src/domain/{week,frequency}.ts`.

## Fase 1 — Dominio e storage

- [x] **T1.1** Definire tipi in `src/domain/types.ts` come da `ARCHITECTURE.md` sezione 4. Esportare tutti. **Nota: NO entità `Category` separata.**
  - Nuovo modello: `ID`, `FrequencyLimit`, `Element`, `MealType`, `DayOfWeek`, `Dish`, `MealSlot`, `Week`. Vecchi tipi spostati in `types-legacy.ts` per compatibilità con code base preesistente.
- [x] **T1.2** Implementare `src/domain/week.ts`: funzioni `getCurrentWeekId()`, `getWeekStart(date)`, `nextWeek(weekId)`, `prevWeek(weekId)`, `formatWeekLabel(weekId)`. **Test obbligatori** (casi: cambio anno, settimana ISO 53, ecc.).
  - Implementate tutte le funzioni con logica ISO 8601 corretta. Aggiunta `weekIdToMonday()` come inversa di `getCurrentWeekId()`. 24 test passano (cambio anno, W53, round-trip, padding, ecc.).
- [x] **T1.3** Implementare `src/domain/frequency.ts`: funzione `computeWeeklyFrequencies(week, elements)` che ritorna `Map<elementId, { used: number, max: FrequencyLimit, exceeded: boolean }>`. **Test obbligatori**:
  - caso vuoto → tutti gli Elementi a `used: 0`
  - caso sforato → `exceeded: true` quando `used > max` (e `max != 'unlimited'`)
  - caso unlimited → mai `exceeded: true`
  - stesso Elemento in più piatti diversi → conta `n`
  - stesso Elemento ripetuto nello stesso piatto → conta `1`
  - 11 test passano. Gestito anche il caso limite: Elemento referenziato ma non più in archivio → voce con `max:'unlimited', exceeded:false`.
- [x] **T1.4** Implementare `src/storage/db.ts`: apertura IndexedDB con **Dexie**, schema v1 (2 store: `elements`, `weeks`), migrazione iniziale.
  - Classe `AppDB extends Dexie`, DB name `MenuPlannerV2` (separato dal legacy). Singleton `appDb` esportato. Build passa.
- [x] **T1.5** Implementare CRUD `src/storage/elements.ts`. **Test** (creazione, lettura, update, delete, validazione: nome non vuoto, no duplicati di nome).
  - `createElement`, `getAllElements`, `getElementById`, `updateElement`, `deleteElement`. `ElementValidationError` per nome vuoto/duplicato. 20 test passano (fake-indexeddb).
- [x] **T1.6** Implementare CRUD `src/storage/weeks.ts`: get/put settimana, aggiungi/rimuovi piatto da slot, gestione cleanup quando si elimina un Elemento referenziato. **Test**.
  - `getWeek`, `getOrCreateWeek`, `addDishToSlot`, `removeDishFromSlot`, `removeElementFromAllWeeks`. 16 test passano (fake-indexeddb).
- [x] **T1.7** Implementare `navigator.storage.persist()` al primo avvio in `main.ts`. Loggare il risultato.
  - Chiamata con optional chaining (`navigator.storage?.persist`). Log via `console.log`.

## Fase 2 — UI: Elementi (tab "Elementi")

- [x] **T2.1** Layout base App: header, navigazione tra tab (Settimana / Elementi / Backup), routing.
  - App.vue: header con titolo "Menu Planner" + 3 tab (Settimana /week, Elementi /elementi, Backup /backup). Stub views per Elementi e Backup. Rotte legacy /dishes, /settings, /import-export mantenute ma non in nav. 81 test, build e lint passano.
- [x] **T2.2** Pagina Elementi: lista degli Elementi definiti, ordinata alfabeticamente. Empty state ("Nessun elemento ancora — aggiungine uno").
  - `ElementiView.vue` mostra lista alfabetica con nome e frequenza max. Empty state se lista vuota.
- [x] **T2.3** Form creazione Elemento: nome, frequenza (1-5 + ∞). Validazione: nome non vuoto, no duplicati (case-insensitive).
  - Modal form con input nome + select frequenza (1,2,3,4,5,∞). Errori di validazione da `ElementValidationError` mostrati inline. Nuovo store `elementiStore.ts`.
- [x] **T2.4** Edit/Delete Elemento. Conferma su delete se l'Elemento è usato in qualche piatto (mostrare quanti piatti). Su conferma: rimuovere l'Elemento da tutti i piatti che lo referenziano (i piatti restano, perdono solo quel componente).
  - `countDishesUsingElement` aggiunto a `weeks.ts`. `update`/`remove`/`countUsage` aggiunti a `elementiStore.ts`. `ElementiView.vue`: pulsanti ✏️/🗑️ per riga, modal edit con prefill, dialog conferma delete con conteggio piatti interessati.
- [x] **T2.5** Seed iniziale al primo avvio: alcuni Elementi predefiniti (`pasta` 3, `riso` 2, `pane` ∞, `formaggio` 1, `carne rossa` 2, `carne bianca` 3, `pesce` 3, `verdura` ∞, `frutta` ∞, `legumi` 3). L'utente può modificarli/eliminarli liberamente.
  - `src/storage/seed.ts`: `seedElementsIfEmpty()` controlla se il DB è vuoto e inserisce i 10 elementi. Chiamata da `main.ts` con gestione errore.

## Fase 3 — UI: Vista settimanale

- [x] **T3.1** Layout vista settimanale: griglia 7 giorni × N pasti. Pranzo e cena sempre visibili. Toggle per mostrare colazione/merende (stato persistito in localStorage).
  - `settimanaStore.ts` (Pinia): week corrente, toggle `showOptionalMeals` in localStorage. `WeekView.vue` riscritto con nuova architettura: griglia CSS Grid 7×N, pasti opzionali collassabili. Build e 81 test passano.
- [x] **T3.2** Navigazione settimane: pulsanti `<` e `>`, label "Settimana del lun gg/mm". Pulsante "oggi" per tornare alla settimana corrente.
  - `formatWeekLabel()` usato in `WeekView.vue`. Pulsante "Oggi" visibile solo quando non si è sulla settimana corrente.
- [x] **T3.3** Slot vuoto: pulsante "+". Slot occupato: nome piatto + chip degli Elementi.
  - Slot vuoto centrato con "+" cliccabile. Slot occupato mostra dish card con nome + chip.
- [x] **T3.4** Form aggiunta piatto: nome libero + multi-select Elementi con autocomplete. Salvataggio in IndexedDB + refresh vista.
  - Nuovo componente `FormAggiuntaPiatto.vue`: input nome, lista elementi con filtro testo, checkbox multipla. `addDishToSlot` + `settimanaStore.refresh()` al salvataggio.
- [x] **T3.5** Edit/Delete piatto da uno slot.
  - Pulsante ✏️ riapre `FormAggiuntaPiatto` in edit mode (rimuove vecchio + inserisce aggiornato). Pulsante 🗑️ chiama `removeDishFromSlot` + refresh.
- [x] **T3.6** Chip Elemento dentro lo slot: mostra `nome (n/max)` o solo `nome` se unlimited. Colore rosso se sforato.
  - `computeWeeklyFrequencies` calcolato come `computed` reattivo. `getChipData()` ritorna label e flag `exceeded`. CSS `.chip--exceeded` → rosso.

## Fase 4 — Reminder frequenze

- [ ] **T4.1** Pannello reminder (drawer laterale o sezione fissa, a scelta): lista degli Elementi della settimana corrente con conteggio `used/max`. Rosso se sforato. Mostra `∞` per unlimited.
- [ ] **T4.2** Filtro/toggle: mostra solo sforati / mostra tutti.
- [ ] **T4.3** Aggiornamento reattivo quando si aggiunge/rimuove un piatto (no reload manuale).

## Fase 5 — Backup completo

- [ ] **T5.1** `src/storage/backup.ts`: `exportAll()` ritorna blob JSON con format/version/elements/weeks.
- [ ] **T5.2** `importAll(file)`: parsing, validazione versione e schema, sovrascrittura totale (con conferma). In caso di errore di parsing, messaggio chiaro all'utente.
- [ ] **T5.3** UI Pagina Backup: pulsante "Esporta backup" (download file), pulsante "Importa backup" (file picker + conferma).
- [ ] **T5.4** Tracciare data ultimo backup in localStorage. Mostrare badge/banner non invadente quando >14 giorni.

## Fase 6 — Condivisione menù (export/import per utente)

> _Più complesso del backup: gestione granulare slot-per-slot._

- [ ] **T6.1** `exportWeek(weekId)` e `exportWeeks(weekIds)`: ritorna blob JSON con elements referenziati + weeks.
- [ ] **T6.2** UI: dalla vista settimanale, pulsante "Condividi" con opzioni "questa settimana" / "intervallo".
- [ ] **T6.3** UI Import condivisione: file picker, parsing, anteprima del menù ricevuto.
- [ ] **T6.4** Modalità import: radio "Sovrascrivi tutto" / "Scegli slot per slot".
- [ ] **T6.5** Modalità granulare: per ogni `(giorno, pasto)` con piatto importabile, checkbox per accettare. Default: tutti spuntati.
- [ ] **T6.6** Gestione Elementi mancanti: se il file referenzia Elementi che non esistono localmente, dialog "Aggiungi questi N elementi al tuo archivio?". Conflitti di nome con frequenze diverse → sub-dialog "tieni il tuo / sovrascrivi / rinomina".
- [ ] **T6.7** Test integrazione completo: export da menù A → import in menù B → verifica integrità.

## Fase 7 — Rifinitura

- [ ] **T7.1** Vista giornaliera (toggle dalla vista settimanale): un solo giorno espanso, gli altri come piccoli summary.
- [ ] **T7.2** Audit accessibilità: navigazione tastiera, contrasti, screen reader sugli stati "sforato".
- [ ] **T7.3** Audit Lighthouse: PWA score, performance, accessibilità. Fix dei major.
- [ ] **T7.4** Test su Safari iOS reale: installazione "Add to Home Screen", apertura offline, persistenza dopo 7+ giorni di non utilizzo (può essere documentato in checklist manuale).
- [ ] **T7.5** README.md: come installare, come deployare su GitHub Pages, come fare backup.
- [ ] **T7.6** Icone PWA definitive (sostituire i placeholder).

## Fase 8 — Deploy

- [ ] **T8.1** Configurare GitHub Actions per build + deploy su GitHub Pages (o equivalente).
- [ ] **T8.2** Verifica primo deploy: l'app si apre, è installabile, i dati sopravvivono al reload.

---

## Promemoria per l'agente

1. **Una task alla volta.** Non fare merge di task multiple in un solo commit.
2. **Test prima del codice** dove sensato (T1.2, T1.3, T1.5, T1.6 in particolare).
3. **Niente feature creep**: se ti viene un'idea fuori dai requisiti, scrivila in fondo a questo file sotto `## Idee future` e vai avanti.
4. **Rileggi `SPEC.md` se hai un dubbio funzionale**, `ARCHITECTURE.md` se hai un dubbio tecnico. Se il dubbio resta, **fermati e chiedi**.
5. A fine task: commit, spunta la checkbox, breve nota di cosa è cambiato sotto la checkbox se non banale.

## Idee future

> _L'agente o l'utente possono aggiungere qui idee da valutare in versioni successive, per non appesantire la v1._

-
