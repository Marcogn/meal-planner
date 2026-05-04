<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import IosInstallBanner from './components/IosInstallBanner.vue';
</script>

<template>
  <header>
    <div class="header-inner">
      <span class="app-title">Menu Planner</span>
      <nav aria-label="Navigazione principale">
        <RouterLink to="/week">Settimana</RouterLink>
        <RouterLink to="/elementi">Elementi</RouterLink>
        <RouterLink to="/backup">Backup</RouterLink>
      </nav>
    </div>
  </header>
  <main>
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

.app-title {
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  flex-shrink: 0;
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

main {
  padding: 1rem;
  max-width: 960px;
  margin: 0 auto;
}
</style>
