import { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextValue {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">(
    () => (localStorage.getItem("theme") as "dark" | "light") ?? "dark"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Apply on first render before paint to avoid flash
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setTheme(t: "dark" | "light") {
    setThemeState(t);
  }

  return (
    <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
  );
}

export const useTheme = () => useContext(ThemeContext);
