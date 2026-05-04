# Menu Planner

PWA offline-first per la pianificazione di menù settimanali con controllo delle frequenze alimentari.  
Mono-utente, senza backend, senza autenticazione. Tutti i dati restano sul dispositivo.

---

## Indice

1. [Funzionalità](#funzionalità)
2. [Installazione per sviluppo](#installazione-per-sviluppo)
3. [Script disponibili](#script-disponibili)
4. [Installare l'app sul dispositivo](#installare-lapp-sul-dispositivo)
5. [Deploy su GitHub Pages](#deploy-su-github-pages)
6. [Come fare il backup dei dati](#come-fare-il-backup-dei-dati)
7. [Architettura](#architettura)

---

## Funzionalità

- **Vista settimanale** con griglia Lun–Dom × Colazione/Merenda/Pranzo/Cena
- **Vista giornaliera** (toggle 📆 Giorno) con 7 tab e pannello pasti espanso
- **Elementi alimentari** con frequenza massima settimanale configurabile (es. carne rossa max 2/sett)
- **Chip frequenza** sulle card: rosso + avviso screen reader quando la frequenza è sforata
- **Condivisione menù** via URL (base64) e import menù condivisi
- **Backup/Ripristino** dei dati via file JSON
- **Offline-first** via service worker — funziona senza connessione dopo il primo caricamento
- **Installabile** su iOS (Safari ≥ 16.4) e Android (Chrome) come app standalone

---

## Installazione per sviluppo

### Prerequisiti

- Node.js ≥ 18
- npm

### Avvio

```bash
git clone https://github.com/<tuo-user>/menu-planner.git
cd menu-planner
npm install
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173).

> **Nota**: il service worker è attivo solo nella build di produzione (`npm run build`).
> In modalità dev l'app funziona ma non è offline-first.

---

## Script disponibili

| Comando              | Descrizione                                         |
|----------------------|-----------------------------------------------------|
| `npm run dev`        | Avvia il server di sviluppo (Vite HMR)              |
| `npm run build`      | Build di produzione (TypeScript check + Vite build) |
| `npm run preview`    | Anteprima locale del build (`dist/`)                |
| `npm test`           | Esegui i test Vitest (una volta)                    |
| `npm run test:watch` | Test in modalità watch                              |
| `npm run lint`       | ESLint su tutto il sorgente                         |
| `npm run typecheck`  | TypeScript check senza output (tsc --noEmit)        |

---

## Installare l'app sul dispositivo

L'app è una **PWA installabile**: una volta installata funziona offline e compare nella schermata home come un'app nativa.

### Safari iOS 16.4+

1. Apri l'URL dell'app in **Safari** (altri browser su iOS non supportano l'installazione PWA).
2. Tocca l'icona **Condividi** (rettangolo con freccia in su).
3. Scorri il menu e seleziona **"Aggiungi a schermata Home"**.
4. Dai un nome all'app (es. `Menu Planner`) e tocca **"Aggiungi"**.

> **Persistenza dati su iOS**: Apple può svuotare IndexedDB delle web app *non installate* dopo 7 giorni di inattività. Con l'app installata sulla schermata home la persistenza è garantita, purché l'app venga aperta occasionalmente.

### Chrome Android

1. Apri l'URL in Chrome.
2. Tocca il menu **⋮** → **"Aggiungi a schermata Home"** (o "Installa app").
3. Conferma. L'app apparirà nella schermata home.

### Chrome / Edge Desktop

Clicca sull'icona di installazione 💻 nella barra degli indirizzi (se presente), oppure vai su **Menu → Salva e condividi → Installa come app**.

---

## Deploy su GitHub Pages

### Configurazione (prima volta)

1. Vai in **Settings → Pages** del repository GitHub.
2. In "Build and deployment" scegli **GitHub Actions** come sorgente.
3. Crea il file `.github/workflows/deploy.yml` (vedi sotto).

### Workflow GitHub Actions (`deploy.yml`)

```yaml
name: Build & Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

### Base path per sottocartella

Se il repository si chiama `menu-planner` (non è la root del tuo account), l'app verrà servita da `https://<user>.github.io/menu-planner/`. In questo caso imposta `base` in `vite.config.ts`:

```ts
// vite.config.ts
export default defineConfig({
  base: '/menu-planner/',   // ← aggiungi questa riga
  plugins: [vue(), VitePWA(...)],
})
```

> **Vue Router usa hash history** (`createWebHashHistory`), quindi non è necessaria nessuna configurazione lato server per il routing. L'URL sarà del tipo `…/menu-planner/#/week`.

### Verifica del deploy

Dopo il push su `main`:
1. Vai in **Actions** del repository → controlla che il workflow sia verde.
2. Apri l'URL `https://<user>.github.io/<repo>/` in Chrome e verifica che:
   - L'app si carica senza errori in console.
   - DevTools → Application → Service Workers mostra lo SW attivo.
   - DevTools → Application → Manifest mostra le icone e il `start_url` corretto.
3. Metti il dispositivo offline (o disabilita la rete) e ricarica: l'app deve funzionare ugualmente.

---

## Come fare il backup dei dati

Il backup è un file JSON che contiene tutti gli **Elementi** (categorie alimentari) e tutti i **menù settimanali**. È portabile: puoi importarlo su un altro dispositivo o usarlo come copia di sicurezza.

### Esportare un backup

1. Apri l'app e vai alla scheda **Backup** (menu in alto).
2. Clicca **⬇ Esporta backup**.
3. Il file `menu-planner-backup-YYYY-MM-DD.json` viene scaricato automaticamente.

> L'app mostra un avviso (punto arancione nella nav) quando sono trascorsi più di 7 giorni dall'ultimo backup.

### Ripristinare un backup

1. Vai alla scheda **Backup**.
2. Clicca **⬆ Importa backup** e seleziona il file JSON.
3. Conferma nella finestra di dialogo.

> ⚠️ Il ripristino **sostituisce completamente** i dati presenti sul dispositivo. Esporta prima un backup dei dati attuali se li vuoi conservare.

### Condividere il menù settimanale

Dalla vista Settimana puoi condividere il menù della settimana corrente (solo i piatti, non gli Elementi) tramite un link URL:

1. Clicca **📤 Condividi**.
2. Copia il link generato e mandalo a chi vuoi.
3. Il destinatario apre il link, clicca **📥 Importa** nella propria app e sceglie gli slot da aggiungere.

---

## Architettura

```
src/
├── domain/          # Logica pura TypeScript — zero dipendenze da Vue/Dexie/DOM
│   ├── types.ts     # Tipi di dominio: Element, Dish, Week, MealSlot
│   ├── frequency.ts # computeWeeklyFrequencies() — calcola usi/limite per Elemento
│   ├── week.ts      # getCurrentWeekId(), nextWeek(), weekIdToMonday(), …
│   ├── validator.ts # validateWeek() — verifica vincoli frequenza
│   ├── ranker.ts    # rankSuggestions() — ordinamento suggerimenti slot-per-slot
│   └── __tests__/   # Test unitari (Vitest)
├── storage/         # Persistenza IndexedDB
│   ├── db.ts        # Schema Dexie + apertura DB, migrazioni
│   ├── elements.ts  # CRUD Elementi
│   ├── weeks.ts     # CRUD Settimane / Slot / Piatti
│   └── backup.ts    # Export/import JSON, condivisione menù
├── stores/          # Pinia stores (bridge UI ↔ storage)
│   ├── settimanaStore.ts  # settimana corrente, navigazione, vista giornaliera
│   ├── elementiStore.ts   # CRUD Elementi in memoria
│   ├── backupStore.ts     # timestamp ultimo backup, needsBackup
│   └── …
├── views/           # Pagine Vue
│   ├── WeekView.vue       # Vista settimanale + giornaliera
│   ├── ElementiView.vue   # Gestione Elementi
│   └── BackupView.vue     # Export / Import backup
├── components/      # Componenti riutilizzabili
│   ├── FormAggiuntaPiatto.vue  # Modale aggiunta/modifica piatto
│   ├── ReminderFrequenze.vue   # Pannello riepilogo frequenze
│   ├── CondividiModal.vue      # Condivisione menù via URL
│   ├── ImportaMenuModal.vue    # Import menù condiviso
│   └── IosInstallBanner.vue    # Banner "Aggiungi a schermata Home" per iOS
├── io/              # Schema Zod per validazione import/export JSON
├── router/          # Vue Router con hash history
├── App.vue
└── main.ts
```

### Separazione dei layer

| Layer | Responsabilità | Dipendenze |
|-------|---------------|------------|
| `domain/` | Logica pura: frequenze, validazione, ranking | solo TypeScript stdlib |
| `storage/` | Persistenza IndexedDB via Dexie | `domain/`, Dexie |
| `stores/` | Stato reattivo, azioni | `storage/`, Pinia |
| `views/` + `components/` | Presentazione, UX | `stores/`, Vue |

### Scelte tecniche rilevanti

- **Hash history** (`createWebHashHistory`): gli URL del tipo `…/#/week` funzionano su qualsiasi static host senza configurazione server-side.
- **IndexedDB via Dexie**: schema versionato, migrazioni esplicite. Dati di dominio non toccano mai localStorage.
- **localStorage** solo per preferenze UI: ultima settimana visualizzata, toggle pasti opzionali, toggle vista giornaliera, data ultimo backup.
- **Service worker** generato da `vite-plugin-pwa` (Workbox) con strategia `cache-first` per l'app shell. Nessuna chiamata di rete in runtime → app completamente offline.
- **Icone maskable**: le icone PWA hanno `purpose: "any maskable"` — il contenuto visibile è centrato nel safe-zone dell'80% per adattarsi ai diversi form di ritaglio dei vari OS.
