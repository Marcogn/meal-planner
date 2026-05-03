<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/week">Settimana</RouterLink>
      <RouterLink to="/dishes">Piatti</RouterLink>
      <RouterLink to="/settings">Impostazioni</RouterLink>
      <RouterLink to="/import-export">Import/Export</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style scoped>
header {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ccc;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

nav {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
}

nav a {
  text-decoration: none;
  color: inherit;
  font-size: 0.95rem;
}

nav a.router-link-active {
  font-weight: bold;
  text-decoration: underline;
}

main {
  padding: 1rem;
  max-width: 960px;
  margin: 0 auto;
}
</style>
