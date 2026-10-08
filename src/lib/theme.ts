export const THEME_KEY = 'pms-theme';
export type Theme = 'dark' | 'light';

export function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'dark' || set === 'light') return set;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
  return next;
}

/** Inline script for <head>. It sets the saved theme before the first paint. */
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t)document.documentElement.dataset.theme=t}catch(e){}`;
