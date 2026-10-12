import { useEffect, useState } from "react";

/** The value once it has stopped changing for `ms` (search boxes that query as you type) */
export const useDebounced = <T>(value: T, ms: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};
