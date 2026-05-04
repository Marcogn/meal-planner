<script setup lang="ts">
import { ref } from 'vue';

// Detect Safari iOS running in browser (not already installed as PWA)
const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as Navigator & { standalone?: boolean }).standalone;

const dismissed = ref(localStorage.getItem('ios-install-dismissed') === '1');

function dismiss() {
  dismissed.value = true;
  localStorage.setItem('ios-install-dismissed', '1');
}
</script>

<template>
  <div v-if="isIosSafari && !dismissed" class="ios-banner" role="status">
    <span class="ios-banner__text">
      Per installare l'app: tocca
      <strong>Condividi</strong> <span class="ios-banner__share-icon" aria-label="icona condividi">⬆</span>
      poi <strong>Aggiungi a schermata Home</strong>.
    </span>
    <button class="ios-banner__close" aria-label="Chiudi suggerimento" @click="dismiss">✕</button>
  </div>
</template>

<style scoped>
.ios-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #2c6e49;
  color: #fff;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
  z-index: 9999;
}

.ios-banner__text {
  flex: 1;
  line-height: 1.4;
}

.ios-banner__share-icon {
  font-style: normal;
}

.ios-banner__close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
}
</style>
