import { createContext, useContext, useEffect, useState } from "react";

// Follows the OS colour scheme. index.html sets the initial `dark` class before React
// renders (no flash); this keeps it in sync when the system preference changes.

type ResolvedTheme = "light" | "dark";

const query = "(prefers-color-scheme: dark)";

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia(query).matches ? "dark" : "light";

const ThemeContext = createContext<{ theme: ResolvedTheme }>({ theme: "light" });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setTheme(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <ThemeContext value={{ theme }}>{children}</ThemeContext>;
}

export const useTheme = () => useContext(ThemeContext);
