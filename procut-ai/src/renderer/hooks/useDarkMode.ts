import { useEffect } from 'react';

export function useDarkMode() {
  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = localStorage.getItem('darkMode') !== 'false';
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('darkMode', String(isDark));
  }, []);
  
  const toggle = () => {
    const root = window.document.documentElement;
    const isDark = !root.classList.contains('dark');
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('darkMode', String(isDark));
  };
  
  return { toggle };
}
