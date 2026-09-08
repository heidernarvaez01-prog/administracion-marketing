import { useEffect, useState } from 'react';

/**
 * Design tokens live in src/index.css as bare HSL triplets (e.g. "180 48% 52%"),
 * consumed elsewhere as `hsl(var(--x))`. Canvas-based chart libraries (ECharts
 * renders to <canvas>, not DOM) can't resolve CSS custom properties on their
 * own — a canvas fillStyle/strokeStyle needs a literal color string. This
 * reads the computed values off <html> and returns real `hsl(...)` strings,
 * refreshed whenever the `.dark` class toggles (from any component — it
 * observes the DOM directly rather than trusting a single useTheme() instance).
 */

const TOKEN_NAMES = [
  'primary', 'secondary', 'success', 'warning', 'destructive', 'info',
  'muted-foreground', 'foreground', 'border', 'background', 'card',
] as const;

type TokenName = (typeof TOKEN_NAMES)[number];
export type ChartTokens = Record<TokenName, string>;

function readTokens(): ChartTokens {
  const styles = getComputedStyle(document.documentElement);
  const out = {} as ChartTokens;
  for (const name of TOKEN_NAMES) {
    const raw = styles.getPropertyValue(`--${name}`).trim();
    out[name] = raw ? `hsl(${raw})` : '#8884d8';
  }
  return out;
}

/** Resolved design tokens as literal hsl() strings, reactive to dark-mode toggles. */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(() =>
    typeof document === 'undefined' ? ({} as ChartTokens) : readTokens(),
  );

  useEffect(() => {
    setTokens(readTokens());
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTokens(readTokens()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
