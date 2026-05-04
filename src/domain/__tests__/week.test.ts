import { describe, it, expect } from 'vitest';
import {
  getWeekStart,
  getCurrentWeekId,
  nextWeek,
  prevWeek,
  formatWeekLabel,
  weekIdToMonday,
} from '../week';

// Helper: crea una data UTC pulita
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe('getWeekStart', () => {
  it('restituisce lunedì per una data di lunedì', () => {
    // 2026-05-04 è lunedì
    const d = utc(2026, 5, 4);
    expect(getWeekStart(d).toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('restituisce il lunedì precedente per una domenica', () => {
    // 2026-05-10 è domenica → lunedì 2026-05-04
    const d = utc(2026, 5, 10);
    expect(getWeekStart(d).toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('restituisce il lunedì precedente per un giovedì', () => {
    // 2026-05-07 è giovedì → lunedì 2026-05-04
    const d = utc(2026, 5, 7);
    expect(getWeekStart(d).toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('attraversa il confine di mese', () => {
    // 2026-03-31 è martedì → lunedì 2026-03-30
    const d = utc(2026, 3, 31);
    expect(getWeekStart(d).toISOString()).toBe('2026-03-30T00:00:00.000Z');
  });
});

describe('getCurrentWeekId', () => {
  it('formato corretto per una data normale', () => {
    expect(getCurrentWeekId(utc(2026, 5, 4))).toBe('2026-W19');
  });

  it('settimana 1 di inizio anno', () => {
    // 2026-01-01 giovedì → settimana 1
    expect(getCurrentWeekId(utc(2026, 1, 1))).toBe('2026-W01');
  });

  it('settimana ISO 53 del 2015 (anno con W53)', () => {
    // 2015-12-31 è giovedì, appartiene alla W53 del 2015
    expect(getCurrentWeekId(utc(2015, 12, 31))).toBe('2015-W53');
  });

  it('cambio anno: 2020-12-31 appartiene al 2021-W53', () => {
    // 2020 ha 53 settimane; 2020-12-31 giovedì → W53 2020
    // Verifica che il formato non sia "2020-W54"
    const id = getCurrentWeekId(utc(2020, 12, 31));
    expect(id).toBe('2020-W53');
  });

  it('prima settimana ISO del 2016 inizia nel 2015', () => {
    // 2016-01-01 venerdì → appartiene alla W53 del 2015
    expect(getCurrentWeekId(utc(2016, 1, 1))).toBe('2015-W53');
  });

  it('2016-01-04 appartiene alla W01 del 2016', () => {
    expect(getCurrentWeekId(utc(2016, 1, 4))).toBe('2016-W01');
  });
});

describe('weekIdToMonday (round-trip)', () => {
  const cases = [
    { weekId: '2026-W01', monday: '2025-12-29T00:00:00.000Z' },
    { weekId: '2026-W19', monday: '2026-05-04T00:00:00.000Z' },
    { weekId: '2015-W53', monday: '2015-12-28T00:00:00.000Z' },
    { weekId: '2020-W53', monday: '2020-12-28T00:00:00.000Z' },
  ];

  for (const { weekId, monday } of cases) {
    it(`weekIdToMonday(${weekId}) = ${monday}`, () => {
      expect(weekIdToMonday(weekId).toISOString()).toBe(monday);
    });
  }

  it('round-trip: getCurrentWeekId(weekIdToMonday(id)) === id', () => {
    const ids = ['2026-W01', '2026-W19', '2025-W52', '2015-W53', '2020-W53'];
    for (const id of ids) {
      expect(getCurrentWeekId(weekIdToMonday(id))).toBe(id);
    }
  });
});

describe('nextWeek', () => {
  it('avanza di una settimana nella stessa anno', () => {
    expect(nextWeek('2026-W19')).toBe('2026-W20');
  });

  it('attraversa il confine di anno (W52 → W01)', () => {
    // 2025 ha 52 settimane; W52 → 2026-W01
    expect(nextWeek('2025-W52')).toBe('2026-W01');
  });

  it('attraversa il confine da W53 a W01', () => {
    // 2015 ha 53 settimane; W53 → 2016-W01
    expect(nextWeek('2015-W53')).toBe('2016-W01');
  });
});

describe('prevWeek', () => {
  it('torna indietro di una settimana nella stessa anno', () => {
    expect(prevWeek('2026-W19')).toBe('2026-W18');
  });

  it('attraversa il confine di anno (W01 → W52 o W53 dell\'anno precedente)', () => {
    // 2026-W01 → 2025-W52 (2025 ha 52 settimane)
    expect(prevWeek('2026-W01')).toBe('2025-W52');
  });

  it('arriva a W53 dell\'anno precedente se esiste', () => {
    // 2016-W01 → 2015-W53
    expect(prevWeek('2016-W01')).toBe('2015-W53');
  });
});

describe('formatWeekLabel', () => {
  it('formato "Settimana del lun gg/mm"', () => {
    expect(formatWeekLabel('2026-W19')).toBe('Settimana del lun 04/05');
  });

  it('padding corretto per giorno/mese a una cifra', () => {
    // 2026-W01 inizia 2025-12-29 → "Settimana del lun 29/12"
    expect(formatWeekLabel('2026-W01')).toBe('Settimana del lun 29/12');
  });

  it('settimana 53 del 2015', () => {
    // 2015-W53 inizia 2015-12-28
    expect(formatWeekLabel('2015-W53')).toBe('Settimana del lun 28/12');
  });
});
