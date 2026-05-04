# SPEC — Meal Planner PWA

> Documento di riferimento dei **requisiti funzionali**. Da rileggere all'inizio di ogni task implementativo. Non contiene scelte tecniche (vedi `ARCHITECTURE.md`).

## 1. Visione

Applicazione web installabile (PWA) per pianificare il menù settimanale, garantendo il rispetto di limiti di frequenza per categorie alimentari (es. carne rossa max 2/sett, formaggio max 1/sett). Single-user, completamente client-side, dati locali in IndexedDB.

## 2. Glossario

- **Elemento**: categoria alimentare con una frequenza massima settimanale. Esempi: `formaggio`, `carne rossa`, `carne bianca`, `pesce`, `verdura`, `pane`, `pasta`, `riso`. **L'Elemento è la categoria stessa**, non l'ingrediente specifico. Il dettaglio dell'ingrediente concreto (mozzarella, parmigiano, scamorza) sta nel **nome del piatto**, non nell'Elemento.
- **Piatto**: cosa l'utente mangia in un singolo slot pasto. È composto da un nome libero (es. "mozzarella e insalata con pane") e da una lista di Elementi che lo compongono (es. `formaggio`, `verdura`, `pane`).
- **Slot**: posizione nel menù settimanale identificata da `(giorno, pasto)`. Es: `(Lunedì, pranzo)`.
- **Pasto**: uno tra `colazione`, `merenda_mattina`, `pranzo`, `merenda_pomeriggio`, `cena`. Pranzo e cena sono **sempre visibili**; gli altri tre sono **nascosti di default** (toggle per mostrarli).
- **Frequenza**: numero massimo di volte alla settimana in cui un Elemento può comparire nel menù. Valori ammessi: `1, 2, 3, 4, 5, ∞ (illimitato)`.
- **Settimana**: dal lunedì alla domenica (inclusi). Tutte le frequenze si calcolano su questa finestra.

## 3. Funzionalità

### 3.1 Gestione Elementi (Tab "Elementi")

Schermata dedicata dove l'utente:

- Visualizza la lista degli Elementi definiti.
- Crea un nuovo Elemento specificando:
  - Nome (libero, es. "formaggio", "carne rossa", "verdura")
  - Frequenza massima settimanale: `1 | 2 | 3 | 4 | 5 | ∞`
- Modifica o elimina un Elemento esistente.
- L'eliminazione di un Elemento usato in piatti già pianificati: l'app deve **avvisare** l'utente e chiedere conferma. I piatti che lo usavano restano (il nome del piatto è testo libero), ma l'Elemento viene rimosso dalla lista componenti del piatto.

**Esempio descrittore (UI):**
```
Nome: formaggio
Frequenza: 3
```

### 3.2 Inserimento Piatto in uno slot del menù

Da un qualsiasi slot del menù settimanale (es. `Lunedì, pranzo`):

- L'utente clicca lo slot vuoto (o "+ Aggiungi piatto").
- Compare un form con:
  - **Nome del piatto** (testo libero, es. "mozzarella e insalata con pane"). È qui che vive il dettaglio specifico dell'ingrediente.
  - **Componenti**: selezione multipla dagli Elementi definiti. Autocomplete consigliato.
- Salvando, il piatto compare nello slot e gli Elementi scelti vanno a scalare le frequenze settimanali.

**Esempio:**
```
Slot: Lunedì, pranzo
Nome: mozzarella e insalata con pane
Componenti: formaggio (1/3), verdura (1/∞), pane (1/∞)
```
> Nota: la notazione `(n/N)` mostra a colpo d'occhio quante volte su `N` quell'Elemento è già stato usato nella settimana corrente, contando anche questo piatto.

### 3.3 Vista Settimanale (vista principale)

- Default: vista **settimanale** (lun-dom × pasti).
- Pasti sempre visibili: pranzo, cena.
- Pasti collassabili: colazione, merenda mattina, merenda pomeriggio (toggle persistente per utente).
- Navigazione tra settimane: avanti/indietro illimitato (può inserire/modificare anche settimane future).
- Vista **giornaliera** opzionale (toggle): mostra solo un giorno, utile su mobile. Da valutare in fase di design.
- In ogni slot: nome del piatto + chip degli Elementi (con eventuale stato "in eccesso" colorato, vedi 3.4).

### 3.4 Reminder frequenze (sezione/tab nella vista settimanale)

- Pannello sempre accessibile (tab laterale, drawer o sezione fissa) che mostra il **conteggio attuale per la settimana visualizzata**:
  ```
  Formaggio: 1/4
  Carne rossa: 3/2   ← in rosso (sforato)
  Carne bianca: 2/3
  Verdura: 4/∞
  ```
- Mostra **tutti gli Elementi definiti** (anche quelli a 0 nella settimana, se hanno frequenza finita) + eventuali Elementi presenti nella settimana ma non più tra quelli definiti (caso limite import).
- **Comportamento sforamento**: l'app **permette** di sforare (non blocca) ma evidenzia in rosso sia nel reminder sia nel chip dell'Elemento dentro il piatto in cui lo sforamento avviene.

### 3.5 Condivisione menù (export/import)

**Export:**
- Da un menù settimanale (o multi-settimana — da decidere), generare un file di export contenente: gli Elementi referenziati, i piatti, gli slot.
- Il file è scaricabile dall'utente con i mezzi standard del browser (download). L'invio vero e proprio (mail, AirDrop, ecc.) è gestito dal sistema operativo, non dall'app.

**Import:**
- L'utente seleziona un file di export ricevuto.
- L'app valida il file e mostra un'anteprima.
- L'utente sceglie tra:
  1. **Sovrascrittura totale** del menù della/e settimana/e ricevuta/e.
  2. **Selezione granulare**: per ogni `(giorno, pasto)` può scegliere se importare o tenere il proprio.
- Gli Elementi presenti nel file ma non nel proprio archivio: l'app chiede se aggiungerli. Conflitti di nome (stesso nome, frequenze diverse) vanno risolti con dialog: "tieni il tuo / sovrascrivi con quello importato / rinomina".

### 3.6 Backup/Restore (separato da export menù)

> _Aggiunto in fase di analisi per coprire il rischio di eviction storage di Safari iOS._

- L'utente può esportare un **backup completo** (tutti gli Elementi + tutti i menù di tutte le settimane) come file JSON.
- L'utente può ripristinare un backup, sovrascrivendo tutto lo stato locale.
- L'app mostra un **reminder visibile** quando è passato troppo tempo dall'ultimo backup (soglia configurabile, default 14 giorni).

## 4. Vincoli e regole di business

- **Una settimana** = lunedì 00:00 → domenica 23:59 (timezone locale del dispositivo).
- **Conteggio frequenze**: ogni Elemento conta `1` per ogni piatto in cui appare, indipendentemente dal pasto. Se `formaggio` è in pranzo e cena dello stesso giorno, conta `2`.
- **Stesso Elemento ripetuto nello stesso piatto**: conta `1` (è una caratteristica del piatto, non si moltiplica).
- **Nessun limite** sul numero di Elementi per piatto.
- **Nessun limite** sul numero di piatti per slot (ma tipicamente uno).

## 5. Decisioni di design già prese (e perché)

- **L'Elemento è la categoria alimentare**, non l'ingrediente specifico. Il dettaglio (mozzarella vs primosale) vive solo nel nome del piatto come testo libero. Motivo: scelta esplicita dell'utente — granularità più fine sarebbe overkill rispetto all'obiettivo di tracciare frequenze nutrizionali.
- **Sforamento permesso ma segnalato**: come da requisito esplicito ("lasciare fare ma segnare in rosso").
- **No autenticazione, no sync, no server**: per scelta esplicita dell'utente.
- **PWA installabile**: necessaria per evitare eviction storage a 7 giorni di Safari iOS (fonte: web.dev / WebKit).

## 6. Out of scope (per la v1)

- Suggerimenti automatici di piatti.
- Liste della spesa generate dal menù.
- Calcolo nutrizionale (calorie, macro).
- Multi-utente / famiglie / profili separati nello stesso device.
- Sync cloud.
- Notifiche push.
- Internazionalizzazione (l'app sarà in italiano).
- Sotto-categorie o gerarchia di Elementi (es. "formaggio" → "formaggio fresco" / "formaggio stagionato").
