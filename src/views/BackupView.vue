<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { exportAll, importAll, BackupImportError } from '../storage/backup';
import { useBackupStore } from '../stores/backupStore';
import { useElementiStore } from '../stores/elementiStore';
import { useSettimanaStore } from '../stores/settimanaStore';

const backupStore = useBackupStore();
const elementiStore = useElementiStore();
const settimanaStore = useSettimanaStore();

// ---- Export ----

const exporting = ref(false);
const exportError = ref('');

async function handleExport() {
  exportError.value = '';
  exporting.value = true;
  try {
    const blob = await exportAll();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `menu-planner-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    backupStore.recordBackup();
  } catch {
    exportError.value = 'Errore durante l\'esportazione. Riprova.';
  } finally {
    exporting.value = false;
  }
}

// ---- Import ----

const fileInputRef = ref<HTMLInputElement | null>(null);
const pendingFile = ref<File | null>(null);
const showImportConfirm = ref(false);
const importing = ref(false);
const importError = ref('');
const importSuccess = ref(false);

function openFilePicker() {
  importError.value = '';
  importSuccess.value = false;
  fileInputRef.value?.click();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  pendingFile.value = file;
  showImportConfirm.value = true;
  // Reset il valore per permettere di riaprire lo stesso file
  input.value = '';
}

function cancelImport() {
  pendingFile.value = null;
  showImportConfirm.value = false;
}

async function confirmImport() {
  if (!pendingFile.value) return;
  importError.value = '';
  importing.value = true;
  showImportConfirm.value = false;
  try {
    await importAll(pendingFile.value);
    // Ricarica i dati nelle altre store
    await Promise.all([elementiStore.load(), settimanaStore.refresh()]);
    importSuccess.value = true;
  } catch (e) {
    if (e instanceof BackupImportError) {
      importError.value = e.message;
    } else {
      importError.value = 'Errore imprevisto durante l\'importazione.';
    }
  } finally {
    importing.value = false;
    pendingFile.value = null;
  }
}

// ---- Label data ultimo backup ----

const lastBackupLabel = computed<string>(() => {
  if (backupStore.lastBackupTimestamp === null) return 'Mai eseguito';
  const d = new Date(backupStore.lastBackupTimestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
});

onMounted(() => {
  // Assicura che lo store degli elementi sia caricato (necessario dopo import)
  if (elementiStore.elements.length === 0) {
    elementiStore.load();
  }
});
</script>

<template>
  <div>
    <h2>Backup</h2>

    <!-- Banner reminder -->
    <div v-if="backupStore.showReminder" class="reminder-banner" role="alert">
      <span class="reminder-icon">⚠️</span>
      <span v-if="backupStore.lastBackupTimestamp === null">
        Non hai ancora eseguito un backup. Esporta i tuoi dati per non perderli.
      </span>
      <span v-else>
        L'ultimo backup risale a
        <strong>{{ backupStore.daysSinceLastBackup }} giorni fa</strong>.
        Ti consigliamo di eseguirne uno nuovo.
      </span>
      <button class="reminder-dismiss" aria-label="Chiudi avviso" @click="backupStore.dismissReminder()">✕</button>
    </div>

    <!-- Info ultimo backup -->
    <p class="last-backup-info">
      Ultimo backup: <strong>{{ lastBackupLabel }}</strong>
    </p>

    <!-- Sezione Export -->
    <section class="backup-section">
      <h3>Esporta backup</h3>
      <p class="section-desc">
        Scarica un file JSON con tutti i tuoi Elementi e menù settimanali.
        Conservalo in un posto sicuro.
      </p>
      <button class="btn-primary" :disabled="exporting" @click="handleExport">
        {{ exporting ? 'Esportazione…' : '⬇ Esporta backup' }}
      </button>
      <p v-if="exportError" class="error-msg" role="alert">{{ exportError }}</p>
    </section>

    <!-- Sezione Import -->
    <section class="backup-section">
      <h3>Importa backup</h3>
      <p class="section-desc">
        Ripristina i tuoi dati da un file di backup precedentemente esportato.
        Gli Elementi esistenti verranno aggiornati; quelli nuovi saranno aggiunti.
        Le settimane del backup sostituiranno quelle locali.
      </p>
      <button class="btn-secondary" :disabled="importing" @click="openFilePicker">
        {{ importing ? 'Importazione…' : '⬆ Importa backup' }}
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept=".json,application/json"
        class="visually-hidden"
        @change="onFileSelected"
      />
      <p v-if="importError" class="error-msg" role="alert">{{ importError }}</p>
      <p v-if="importSuccess" class="success-msg" role="status">
        ✅ Backup ripristinato con successo.
      </p>
    </section>

    <!-- Dialog conferma import -->
    <div v-if="showImportConfirm" class="modal-overlay" @click.self="cancelImport">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="import-confirm-title">
        <h3 id="import-confirm-title">Conferma importazione</h3>
        <p>
          Stai per ripristinare il backup da
          <strong>{{ pendingFile?.name }}</strong>.
        </p>
        <p class="warning-text">
          ⚠️ Gli Elementi esistenti verranno aggiornati con le frequenze del backup e quelli nuovi verranno aggiunti.
          Le settimane presenti nel backup <strong>sostituiranno quelle locali</strong>.
          L'operazione non è reversibile.
        </p>
        <div class="form-actions">
          <button class="btn-danger-solid" @click="confirmImport">Ripristina</button>
          <button @click="cancelImport">Annulla</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
h2 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.reminder-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: #fff8e1;
  border: 1px solid #f9a825;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: #5d4037;
}

.reminder-dismiss {
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #5d4037;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.1rem;
  opacity: 0.7;
}

.reminder-dismiss:hover {
  opacity: 1;
}

.reminder-dismiss:focus-visible {
  outline: 2px solid #5d4037;
  outline-offset: 2px;
  border-radius: 2px;
  opacity: 1;
}

.reminder-icon {
  flex-shrink: 0;
}

.last-backup-info {
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 1.5rem;
}

.backup-section {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.backup-section h3 {
  margin: 0;
  font-size: 1rem;
}

.section-desc {
  font-size: 0.9rem;
  color: #555;
  margin: 0;
}

.btn-primary {
  background: #1a7a1a;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.55rem 1.1rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
  align-self: flex-start;
}

.btn-primary:hover:not(:disabled) {
  background: #155e15;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #aaa;
  border-radius: 4px;
  padding: 0.55rem 1.1rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
  align-self: flex-start;
}

.btn-secondary:hover:not(:disabled) {
  background: #f0f0f0;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger-solid {
  background: #c0392b;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.45rem 0.9rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
}

.btn-danger-solid:hover {
  background: #a93226;
}

.error-msg {
  color: #cc0000;
  font-size: 0.9rem;
  margin: 0;
}

.success-msg {
  color: #1a7a1a;
  font-size: 0.9rem;
  margin: 0;
}

.warning-text {
  color: #c0392b;
  font-size: 0.9rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  width: min(440px, 95vw);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.modal h3 {
  margin: 0 0 0.25rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
