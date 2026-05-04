<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Element } from '../domain/types';
import type { FrequencyEntry } from '../domain/frequency';

const props = defineProps<{
  frequencies: Map<string, FrequencyEntry>;
  elements: Element[];
}>();

interface ReminderRow {
  id: string;
  name: string;
  used: number;
  maxLabel: string; // "3", "∞"
  exceeded: boolean;
  isOrphan: boolean; // Elemento eliminato ma ancora referenziato nella settimana
}

/**
 * Costruisce la lista da mostrare nel pannello:
 * 1. Tutti gli Elementi con frequenza finita (anche se used=0)
 * 2. Elementi con frequenza ∞ solo se used > 0
 * 3. Elementi presenti nei piatti ma non più in archivio (caso limite)
 * Ordinamento: sforati prima, poi alfabetico
 */
const rows = computed<ReminderRow[]>(() => {
  const elementMap = new Map(props.elements.map((el) => [el.id, el]));
  const result: ReminderRow[] = [];

  // Voci per ogni Elemento in archivio
  for (const el of props.elements) {
    const entry = props.frequencies.get(el.id);
    const used = entry?.used ?? 0;
    const max = el.maxFrequencyPerWeek;

    // Elementi unlimited a 0 usi: non li mostriamo
    if (max === 'unlimited' && used === 0) continue;

    const exceeded = max !== 'unlimited' && used > (max as number);
    result.push({
      id: el.id,
      name: el.name,
      used,
      maxLabel: max === 'unlimited' ? '∞' : String(max),
      exceeded,
      isOrphan: false,
    });
  }

  // Voci "orfane": Elementi referenziati nella settimana ma non più in archivio
  for (const [id, entry] of props.frequencies) {
    if (!elementMap.has(id) && entry.used > 0) {
      result.push({
        id,
        name: '(elemento eliminato)',
        used: entry.used,
        maxLabel: '∞',
        exceeded: false,
        isOrphan: true,
      });
    }
  }

  // Ordina: sforati prima, poi per nome
  result.sort((a, b) => {
    if (a.exceeded !== b.exceeded) return a.exceeded ? -1 : 1;
    return a.name.localeCompare(b.name, 'it');
  });

  return result;
});

// T4.2 — toggle "solo sforati"
const showOnlyExceeded = ref(false);

const visibleRows = computed(() =>
  showOnlyExceeded.value ? rows.value.filter((r) => r.exceeded) : rows.value,
);

const exceededCount = computed(() => rows.value.filter((r) => r.exceeded).length);
</script>

<template>
  <section class="reminder" aria-label="Riepilogo frequenze settimanali">
    <div class="reminder__header">
      <h2 class="reminder__title">Frequenze settimana</h2>
      <button
        v-if="rows.length > 0"
        class="reminder__toggle"
        :aria-pressed="showOnlyExceeded"
        :title="showOnlyExceeded ? 'Mostra tutti gli elementi' : 'Mostra solo sforati'"
        @click="showOnlyExceeded = !showOnlyExceeded"
      >
        <span v-if="showOnlyExceeded">Tutti</span>
        <span v-else>
          Solo sforati
          <span v-if="exceededCount > 0" class="reminder__badge">{{ exceededCount }}</span>
        </span>
      </button>
    </div>

    <p v-if="rows.length === 0" class="reminder__empty">
      Nessun elemento da mostrare — aggiungi piatti al menù.
    </p>

    <p v-else-if="visibleRows.length === 0" class="reminder__empty">
      Nessun elemento sforato questa settimana. 🎉
    </p>

    <ul v-else class="reminder__list">
      <li
        v-for="row in visibleRows"
        :key="row.id"
        class="reminder__row"
        :class="{
          'reminder__row--exceeded': row.exceeded,
          'reminder__row--orphan': row.isOrphan,
        }"
      >
        <span class="reminder__name">{{ row.name }}</span>
        <span
          class="reminder__count"
          :aria-label="`${row.used} su ${row.maxLabel}`"
        >{{ row.used }}/{{ row.maxLabel }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.reminder {
  margin-top: 1.25rem;
  border-top: 1px solid #e0e0e0;
  padding-top: 0.75rem;
}

.reminder__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.reminder__title {
  font-size: 0.9rem;
  font-weight: 700;
  margin: 0;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.reminder__empty {
  font-size: 0.85rem;
  color: #888;
  margin: 0;
}

.reminder__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.reminder__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  border-radius: 4px;
  background: #f5f7ff;
  font-size: 0.85rem;
}

.reminder__row--exceeded {
  background: #fde8e8;
  color: #cc0000;
  font-weight: 600;
}

.reminder__row--orphan {
  opacity: 0.7;
  font-style: italic;
}

.reminder__name {
  flex: 1;
  margin-right: 0.5rem;
}

.reminder__count {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.reminder__row--exceeded .reminder__count {
  font-weight: 700;
}

.reminder__toggle {
  font-size: 0.78rem;
  padding: 3px 8px;
  min-height: 30px;
  border-radius: 4px;
  border: 1px solid #bbb;
  background: #f5f5f5;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reminder__toggle:hover {
  background: #e8e8e8;
}

.reminder__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #cc0000;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 10px;
  padding: 0 5px;
  min-width: 16px;
  line-height: 1.6;
}
</style>
