import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const LS_KEY = 'menuPlanner.lastBackup';
const LS_DISMISS_KEY = 'menuPlanner.backupReminderDismissedAt';

/** Numero di giorni oltre i quali l'app mostra il reminder di backup. */
export const BACKUP_REMINDER_DAYS = 14;
/** BACKUP_REMINDER_DAYS convertito in millisecondi. */
const BACKUP_REMINDER_MS = BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;

export const useBackupStore = defineStore('backup', () => {
  // Timestamp (ms) dell'ultimo backup riuscito, o null se mai eseguito.
  // Persiste in localStorage (solo preferenza UI — ok per ARCHITECTURE.md).
  const lastBackupTimestamp = ref<number | null>(
    (() => {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? Number(stored) : null;
    })(),
  );

  // Timestamp (ms) dell'ultima dismissione del reminder, o null se mai dismesso.
  const dismissedAt = ref<number | null>(
    (() => {
      const stored = localStorage.getItem(LS_DISMISS_KEY);
      return stored ? Number(stored) : null;
    })(),
  );

  /** Giorni interi trascorsi dall'ultimo backup, o null se mai eseguito. */
  const daysSinceLastBackup = computed<number | null>(() => {
    if (lastBackupTimestamp.value === null) return null;
    return Math.floor((Date.now() - lastBackupTimestamp.value) / (1000 * 60 * 60 * 24));
  });

  /**
   * true se non è mai stato fatto un backup o sono passati più di
   * BACKUP_REMINDER_DAYS giorni dall'ultimo.
   */
  const needsBackup = computed<boolean>(() => {
    if (lastBackupTimestamp.value === null) return true;
    return (daysSinceLastBackup.value ?? 0) > BACKUP_REMINDER_DAYS;
  });

  /**
   * true se il reminder è stato dismesso di recente (entro BACKUP_REMINDER_DAYS
   * giorni dalla dismissione) e l'utente non ha ancora fatto un nuovo backup.
   */
  const snoozed = computed<boolean>(() => {
    if (dismissedAt.value === null) return false;
    // La dismissione è valida solo se è successiva all'ultimo backup (o se non
    // c'è mai stato un backup), e non è scaduta.
    if (lastBackupTimestamp.value !== null && dismissedAt.value <= lastBackupTimestamp.value) {
      return false;
    }
    const msElapsed = Date.now() - dismissedAt.value;
    return msElapsed < BACKUP_REMINDER_MS;
  });

  /**
   * true se il reminder deve essere mostrato (needsBackup && non dismesso).
   * Usato sia dal badge nell'header sia dal banner nella pagina Backup.
   */
  const showReminder = computed<boolean>(() => needsBackup.value && !snoozed.value);

  /** Registra il timestamp corrente come data dell'ultimo backup. */
  function recordBackup(): void {
    const now = Date.now();
    lastBackupTimestamp.value = now;
    localStorage.setItem(LS_KEY, String(now));
  }

  /** Dismette il reminder per BACKUP_REMINDER_DAYS giorni. */
  function dismissReminder(): void {
    const now = Date.now();
    dismissedAt.value = now;
    localStorage.setItem(LS_DISMISS_KEY, String(now));
  }

  return {
    lastBackupTimestamp,
    daysSinceLastBackup,
    needsBackup,
    showReminder,
    dismissReminder,
    recordBackup,
  };
});
