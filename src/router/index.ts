import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/week' },
  { path: '/week', component: () => import('../views/WeekView.vue') },
  { path: '/dishes', component: () => import('../views/DishesView.vue') },
  { path: '/settings', component: () => import('../views/SettingsView.vue') },
  { path: '/import-export', component: () => import('../views/ImportExportView.vue') },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
