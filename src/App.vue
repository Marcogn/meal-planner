<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import IosInstallBanner from './components/IosInstallBanner.vue';
import { useBackupStore } from './stores/backupStore';

const backupStore = useBackupStore();
</script>

<template>
  <!-- Skip link: visibile solo con tastiera, salta la navigazione -->
  <a class="skip-link" href="#main-content">Vai al contenuto principale</a>

  <header>
    <div class="header-inner">
      <RouterLink to="/week" class="app-title-link" aria-label="Menu Planner – torna alla settimana">
        <h1 class="app-title">Menu Planner</h1>
      </RouterLink>
      <nav aria-label="Navigazione principale">
        <RouterLink to="/week">Settimana</RouterLink>
        <RouterLink to="/elementi">Elementi</RouterLink>
        <RouterLink to="/backup" class="nav-backup">
          Backup
          <span v-if="backupStore.showReminder" class="backup-badge" aria-label="Backup consigliato"></span>
        </RouterLink>
      </nav>
    </div>
  </header>
  <main id="main-content" tabindex="-1">
    <RouterView />
  </main>
  <IosInstallBanner />
</template>

<style scoped>
header {
  padding: 0 1rem;
  border-bottom: 1px solid #ddd;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  max-width: 960px;
  margin: 0 auto;
  height: 52px;
}

.app-title-link {
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.app-title-link:hover .app-title {
  color: #1a7a1a;
}

.app-title {
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  margin: 0;
  line-height: 1;
}

nav {
  display: flex;
  gap: 0;
  flex: 1;
}

nav a {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1rem;
  text-decoration: none;
  color: #555;
  font-size: 0.95rem;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
}

nav a:hover {
  color: #1a1a1a;
  background: #f5f5f5;
}

nav a.router-link-active {
  color: #1a1a1a;
  font-weight: 600;
  border-bottom-color: #1a7a1a;
}

.nav-backup {
  position: relative;
}

.backup-badge {
  position: absolute;
  top: 10px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: #f9a825;
  border-radius: 50%;
  border: 1.5px solid #fff;
}

main {
  padding: 1rem;
  max-width: 960px;
  margin: 0 auto;
}
</style>
