import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eraser,
  LoaderCircle,
  Moon,
  Sun,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSharedText } from '@/hooks/use-shared-text';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('scratchpad_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    localStorage.setItem('scratchpad_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { theme, toggleTheme };
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { text, status, update } = useSharedText();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 1400);
    return () => clearTimeout(timer);
  }, [copyState]);

  const StatusIcon = status === 'synced' ? Wifi : status === 'offline' ? WifiOff : LoaderCircle;

  return (
    <div className="relative flex min-h-svh flex-col bg-background text-foreground selection:bg-primary/10">
      {/* Top action bar */}
      <header className="flex w-full items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Scratch<span className="font-light text-muted-foreground">Pad</span>
          </span>
          <span className="hidden rounded-full border border-border/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-block">
            SSE Live
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="size-8.5 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark' ? (
            <Sun className="size-4 transition-transform hover:rotate-45" aria-hidden="true" />
          ) : (
            <Moon className="size-4 transition-transform hover:-rotate-12" aria-hidden="true" />
          )}
        </Button>
      </header>

      {/* Main pad area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-4 sm:px-6">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Scratch<span className="font-light text-muted-foreground">Pad</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              One shared text field, live in every browser that has it open.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <Textarea
              ref={areaRef}
              aria-label="Shared scratchpad"
              placeholder="Start typing… edits sync instantly to all tabs"
              value={text}
              onChange={(event) => update(event.target.value)}
              className="min-h-[180px] max-h-[50vh] resize-y border-0 bg-transparent px-5 py-4 text-base leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-0"
            />

            <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 dark:bg-muted/10">
              <span
                className={cn(
                  'inline-flex items-center gap-2 text-xs font-medium transition-colors select-none',
                  status === 'synced' && 'text-emerald-600 dark:text-emerald-400',
                  status === 'connecting' && 'text-amber-600 dark:text-amber-400',
                  status === 'offline' && 'text-destructive',
                )}
              >
                <span className="relative flex size-2 shrink-0">
                  {status === 'synced' && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/75 opacity-75 duration-1000" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex size-2 rounded-full',
                      status === 'synced' && 'bg-emerald-500',
                      status === 'connecting' && 'bg-amber-500',
                      status === 'offline' && 'bg-destructive',
                    )}
                  />
                </span>
                <StatusIcon
                  className={cn('size-3.5', status === 'connecting' && 'animate-spin')}
                  aria-hidden="true"
                />
                <span className="capitalize">{status}</span>
              </span>

              <div className="flex items-center gap-2">
                {text.length > 0 && (
                  <span className="mr-1 hidden text-[11px] text-muted-foreground/70 sm:inline-block">
                    {text.length} {text.length === 1 ? 'char' : 'chars'}
                  </span>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!text}
                  onClick={() => {
                    update('');
                    areaRef.current?.focus();
                  }}
                  className="px-3.5 py-1.5"
                >
                  <Eraser className="size-3.5" aria-hidden="true" />
                  Clear
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setCopyState((await copyText(text)) ? 'copied' : 'failed');
                  }}
                  className={cn(
                    'px-3.5 py-1.5',
                    copyState === 'copied' &&
                      'border-emerald-500/50 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-400',
                  )}
                >
                  {copyState === 'copied' ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : copyState === 'failed' ? (
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground/70">
            Debounced sync over Server-Sent Events • In-memory • Last-write-wins
          </p>
        </div>
      </main>
    </div>
  );
}
