import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eraser, LoaderCircle, TriangleAlert, Wifi, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSharedText } from '@/hooks/use-shared-text';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

function useSystemTheme() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
}

export default function App() {
  useSystemTheme();
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
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-5xl font-bold tracking-tight sm:text-6xl">
          Scratch
          <span className="font-light text-muted-foreground">Pad</span>
        </h1>

        <div className="mt-8 rounded-2xl border bg-card shadow-sm transition-colors focus-within:border-ring">
          <Textarea
            ref={areaRef}
            aria-label="Shared scratchpad"
            placeholder="Start typing…"
            value={text}
            onChange={(event) => update(event.target.value)}
            className="max-h-[45vh] min-h-[132px] resize-none border-0 bg-transparent px-4 py-3.5 shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusIcon className={cn('size-3.5', status === 'connecting' && 'animate-spin')} aria-hidden="true" />
              {status}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!text}
                onClick={() => {
                  update('');
                  areaRef.current?.focus();
                }}
              >
                <Eraser aria-hidden="true" />
                Clear
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  setCopyState(await copyText(text) ? 'copied' : 'failed');
                }}
              >
                {copyState === 'copied' ? (
                  <Check aria-hidden="true" />
                ) : copyState === 'failed' ? (
                  <TriangleAlert aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
