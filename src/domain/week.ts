/**
 * Utility per le settimane ISO 8601.
 *
 * Formato weekId: "YYYY-Www" — es. "2026-W01", "2025-W53".
 * La settimana ISO inizia di lunedì (giorno 1) e il primo giovedì dell'anno
 * determina la settimana 1.
 */

/**
 * Restituisce il lunedì della settimana ISO che contiene `date`.
 * `date` può essere qualsiasi giorno della settimana.
 */
export function getWeekStart(date: Date): Date {
  // getDay() → 0=dom, 1=lun, …, 6=sab; ISO: 1=lun, 7=dom
  const dayOfWeek = date.getDay(); // 0..6
  const daysFromMonday = (dayOfWeek + 6) % 7; // 0 se già lunedì
  const monday = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - daysFromMonday),
  );
  return monday;
}

/**
 * Restituisce l'anno ISO e il numero di settimana ISO per un lunedì dato.
 * Il lunedì deve già essere il primo giorno della settimana (output di getWeekStart).
 */
function isoYearWeek(monday: Date): { year: number; week: number } {
  // La settimana ISO contenente il giovedì della stessa settimana determina l'anno.
  // Giovedì = lunedì + 3 giorni.
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);

  const year = thursday.getUTCFullYear();

  // Primo giovedì dell'anno ISO → appartiene alla settimana 1.
  const jan4 = new Date(Date.UTC(year, 0, 4)); // 4 gennaio è sempre in settimana 1
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));

  const diffMs = monday.getTime() - jan4Monday.getTime();
  const week = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return { year, week };
}

/**
 * Restituisce l'ID della settimana ISO che contiene `date` (default: oggi).
 * Formato: "YYYY-Www"
 */
export function getCurrentWeekId(date: Date = new Date()): string {
  const monday = getWeekStart(date);
  const { year, week } = isoYearWeek(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Avanza di una settimana rispetto al `weekId` dato.
 */
export function nextWeek(weekId: string): string {
  const monday = weekIdToMonday(weekId);
  monday.setUTCDate(monday.getUTCDate() + 7);
  const { year, week } = isoYearWeek(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Torna indietro di una settimana rispetto al `weekId` dato.
 */
export function prevWeek(weekId: string): string {
  const monday = weekIdToMonday(weekId);
  monday.setUTCDate(monday.getUTCDate() - 7);
  const { year, week } = isoYearWeek(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Formatta il `weekId` come etichetta leggibile: "Settimana del lun gg/mm".
 * Es. "2026-W19" → "Settimana del lun 04/05"
 */
export function formatWeekLabel(weekId: string): string {
  const monday = weekIdToMonday(weekId);
  const day = String(monday.getUTCDate()).padStart(2, '0');
  const month = String(monday.getUTCMonth() + 1).padStart(2, '0');
  return `Settimana del lun ${day}/${month}`;
}

/**
 * Converte un weekId ("YYYY-Www") nel lunedì corrispondente (UTC).
 * Inverso di getCurrentWeekId.
 */
export function weekIdToMonday(weekId: string): Date {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);

  // Lunedì della settimana 1: lunedì che contiene il 4 gennaio dell'anno ISO.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));

  const monday = new Date(jan4Monday);
  monday.setUTCDate(jan4Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}
