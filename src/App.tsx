import { useEffect, useState } from 'react';
import { Check, Copy, LoaderCircle, NotebookPen, TriangleAlert, Wifi, WifiOff } from 'lucide-react';

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

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 1400);
    return () => clearTimeout(timer);
  }, [copyState]);

  const StatusIcon = status === 'synced' ? Wifi : status === 'offline' ? WifiOff : LoaderCircle;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 px-5 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <NotebookPen className="size-4" aria-hidden="true" />
          ScratchPad
        </h1>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusIcon className={cn('size-3.5', status === 'connecting' && 'animate-spin')} aria-hidden="true" />
          {status}
        </span>
      </header>

      <Textarea
        aria-label="Shared scratchpad"
        placeholder="Start typing…"
        value={text}
        onChange={(event) => update(event.target.value)}
        className="min-h-[45vh] flex-1 resize-none"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
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
    </main>
  );
}
