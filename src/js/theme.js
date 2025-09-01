/**
 * theme.js
 * Handles loading and applying the user's theme preference (light/dark) from localStorage.
 * Usage: import { setThemeFromStorage } from './theme.js';
 */

export function setThemeFromStorage() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}