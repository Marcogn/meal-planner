# CLAUDE.md

> Questo file viene letto automaticamente da Claude Code all'inizio di ogni sessione. Contiene il contesto operativo del progetto. Modificalo solo per cambiare convenzioni stabili — non per appunti temporanei.

## Cos'è questo progetto

PWA italiana per pianificare il menù settimanale rispettando frequenze massime per categorie alimentari (es. carne rossa max 2/sett). Single-user, completamente client-side, dati in IndexedDB. Deploy come file statici su GitHub Pages.

## Documenti di riferimento

Prima di ogni task, leggi le sezioni pertinenti di questi tre file. Sono la **fonte di verità** del progetto:

- `SPEC.md` — requisiti funzionali. Cos'è un Elemento, un Piatto, come si calcolano le frequenze, come funziona l'import/export. **Consulta sempre quando hai un dubbio sul comportamento atteso.**
- `ARCHITECTURE.md` — vincoli tecnici. Stack permessi, storage obbligatorio (IndexedDB), modello dati, struttura cartelle, cosa NON fare. **Consulta sempre quando hai un dubbio tecnico.**
- `TASKS.md` — lista task con checkbox. Ordine di esecuzione. Promemoria operativi.

## Workflow di lavoro

1. **Una task alla volta**, in ordine, dal `TASKS.md`.
2. Prima di iniziare un task: rileggi le sezioni pertinenti di `SPEC.md` e `ARCHITECTURE.md`.
3. Implementa il codice.
4. Esegui `npm run lint`, `npm run test`, `npm run build`. Tutti devono passare.
5. Spunta la checkbox in `TASKS.md`. Se utile, aggiungi una nota di una riga sotto.
6. Commit con messaggio del tipo `T1.3: implementa calcolo frequenze settimanali`.
7. **Fermati e attendi conferma utente** prima del task successivo, salvo diversa indicazione.

## Decisioni già prese (non rimetterle in discussione senza chiedere)

- **PWA installabile** (manifest + service worker), non web app classica. Motivo: Safari iOS evicta dati dopo 7gg di inattività se l'app non è "Add to Home Screen".
- **IndexedDB** per dati di dominio, **non localStorage**. localStorage ammesso solo per preferenze UI.
- **TypeScript** obbligatorio. No `any` non motivato.
- **Vite** come build tool.
- **Nessun backend**, nessuna API esterna in runtime.
- **L'Elemento È la categoria** (formaggio, carne rossa, verdura). Niente entità `Category` separata. Il dettaglio specifico (mozzarella, primosale) vive nel nome libero del Piatto.
- **Sforamento frequenze**: permesso ma segnalato in rosso. Mai bloccato.
- **UI in italiano**.

## Convenzioni di codice

- **TypeScript strict mode** in `tsconfig.json`.
- **ESLint + Prettier** configurati. Esegui sempre `npm run lint` prima di committare.
- Nomi: `camelCase` per variabili/funzioni, `PascalCase` per tipi e componenti, `kebab-case` per file.
- File: un componente / una funzione "principale" per file. File piccoli e focalizzati.
- Commenti: scrivi *perché*, non *cosa*. Il codice già dice cosa fa.
- Niente dipendenze "grasse": no lodash intero, no moment.js. Preferire native (Intl, Array methods) o piccole utility (date-fns, idb).

## Testing

- **Vitest**.
- Logica di dominio (`src/domain/`) e storage (`src/storage/`): test unitari obbligatori.
- UI: test sui componenti complessi (form aggiunta piatto, vista settimanale). Skipabili sui componenti banali.
- Edge case da non saltare: cambio anno (settimana ISO 53), timezone, sforamento frequenze, Elemento referenziato ed eliminato, import con conflitti.

## Quando fermarti e chiedere

- Ambiguità tra `SPEC.md` e `ARCHITECTURE.md` (non dovrebbero contraddirsi, ma se accade è un bug del piano).
- Un task richiede una decisione architetturale non già coperta (es. "che libreria di routing?" se non specificato).
- Pensi di dover violare un vincolo non negoziabile per fare il task.
- Trovi un requisito che sembra impossibile o contraddittorio.

**NON chiedere** per:
- Scelte di stile interno al codice (variabili, refactor minori, struttura interna di un file).
- Decisioni già prese in `ARCHITECTURE.md` (rileggi).
- Conferma di task già nella lista (esegui).

## Comandi utili

```bash
npm run dev        # dev server
npm run build      # build produzione (output in dist/)
npm run preview    # preview della build
npm run test       # test Vitest
npm run lint       # lint
npm run typecheck  # tsc --noEmit
```

## Cosa NON fare (mai)

- ❌ Aggiungere autenticazione, login, account.
- ❌ Aggiungere chiamate di rete a terze parti (analytics, font CDN runtime, telemetria).
- ❌ Usare localStorage per dati di dominio.
- ❌ Implementare feature elencate in `SPEC.md` sezione 6 "Out of scope".
- ❌ Cambiare lo stack scelto a metà progetto.
- ❌ Introdurre l'entità `Category` separata dall'`Element`.
- ❌ Saltare i test sulla logica di dominio per "andare più veloce".
- ❌ Mergiare più task in un unico commit.

## Note operative

- Il primo task (T0.1) include la scelta dello stack. Scrivila in cima a `TASKS.md` nella sezione "Stack scelto" prima di iniziare T0.1.
- Le icone PWA all'inizio sono placeholder. Vanno sostituite in T7.6.
- Il seed iniziale degli Elementi (T2.5) è arbitrario e modificabile dall'utente.
