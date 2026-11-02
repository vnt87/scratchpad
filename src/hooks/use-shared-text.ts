import { useCallback, useEffect, useRef, useState } from 'react';

export type SyncStatus = 'connecting' | 'synced' | 'offline';

const PUSH_DELAY_MS = 120;

export function useSharedText() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsentValue = useRef<string | null>(null);

  useEffect(() => {
    const stream = new EventSource('/api/events');

    stream.onopen = () => setStatus('synced');
    stream.onerror = () => setStatus('offline');
    stream.onmessage = (event) => {
      // Last-write-wins: while a local edit is still in flight, keep it rather
      // than letting the echo of an older value overwrite what was just typed.
      if (unsentValue.current !== null) return;
      setStatus('synced');
      const { text: next } = JSON.parse(event.data) as { text: string };
      setText((current) => (current === next ? current : next));
    };

    return () => stream.close();
  }, []);

  const update = useCallback((value: string) => {
    setText(value);
    unsentValue.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/text', { method: 'POST', body: value });
        if (!response.ok) setStatus('offline');
      } catch {
        setStatus('offline');
      } finally {
        if (unsentValue.current === value) unsentValue.current = null;
      }
    }, PUSH_DELAY_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { text, status, update };
}
