import { useEffect, useRef } from 'react';

export function useDebounce<T>(value: T, delay: number, fn: (v: T) => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const id = setTimeout(() => fnRef.current(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
}
