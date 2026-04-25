"use client";

import * as React from "react";

type SystemTheme = "light" | "dark";
export type Theme = SystemTheme | "system";

type Attribute = "class" | `data-${string}`;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme | ((prev: Theme) => Theme)) => void;
  resolvedTheme: SystemTheme;
  systemTheme: SystemTheme;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const KNOWN_THEMES: Theme[] = ["light", "dark", "system"];

interface ThemeProviderProps extends React.PropsWithChildren {
  defaultTheme?: Theme;
  storageKey?: string;
  enableSystem?: boolean;
  enableColorScheme?: boolean;
  disableTransitionOnChange?: boolean;
  attribute?: Attribute | Attribute[];
  value?: Partial<Record<Theme, string>>;
}

function getStoredTheme(
  storageKey: string,
  enableSystem: boolean,
  defaultTheme: Theme
): Theme {
  if (typeof window === "undefined") return defaultTheme;
  return normalizeTheme(window.localStorage.getItem(storageKey), enableSystem, defaultTheme);
}

function getSystemTheme(): SystemTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;-webkit-transition:none!important}"
    )
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 1);
  };
}

function normalizeTheme(input: string | null | undefined, enableSystem: boolean, fallback: Theme): Theme {
  if (!input) return fallback;
  if (!KNOWN_THEMES.includes(input as Theme)) return fallback;
  if (!enableSystem && input === "system") return "light";
  return input as Theme;
}

function applyThemeToDom(
  theme: Theme,
  {
    attribute,
    value,
    enableColorScheme,
    enableSystem,
  }: Pick<ThemeProviderProps, "attribute" | "value" | "enableColorScheme" | "enableSystem">
) {
  const root = document.documentElement;
  const resolved: SystemTheme =
    theme === "system" && enableSystem ? getSystemTheme() : (theme as SystemTheme);

  const attrs = (Array.isArray(attribute) ? attribute : [attribute]).filter(
    (attr): attr is Attribute => Boolean(attr)
  );

  attrs.forEach((attr) => {
    const attrValue = value?.[resolved] || resolved;

    if (attr === "class") {
      root.classList.remove("light", "dark");
      root.classList.add(attrValue);
      return;
    }

    root.setAttribute(attr, attrValue);
  });

  if (enableColorScheme) {
    root.style.colorScheme = resolved;
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  enableSystem = true,
  enableColorScheme = true,
  disableTransitionOnChange = false,
  attribute = "class",
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    getStoredTheme(storageKey, enableSystem, defaultTheme)
  );
  const [systemTheme, setSystemTheme] = React.useState<SystemTheme>(() => getSystemTheme());

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setThemeState(getStoredTheme(storageKey, enableSystem, defaultTheme));
    setSystemTheme(getSystemTheme());

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const next = normalizeTheme(event.newValue, enableSystem, defaultTheme);
      setThemeState(next);
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [defaultTheme, enableSystem, storageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !enableSystem) return;

    const media = window.matchMedia(MEDIA_QUERY);
    const onMediaChange = () => {
      setSystemTheme(getSystemTheme());
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onMediaChange);
      return () => media.removeEventListener("change", onMediaChange);
    }

    media.addListener(onMediaChange);
    return () => media.removeListener(onMediaChange);
  }, [enableSystem]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const restoreTransitions = disableTransitionOnChange
      ? disableTransitionsTemporarily()
      : null;

    applyThemeToDom(theme, {
      attribute,
      value,
      enableColorScheme,
      enableSystem,
    });

    if (restoreTransitions) {
      restoreTransitions();
    }
  }, [attribute, disableTransitionOnChange, enableColorScheme, enableSystem, theme, value, systemTheme]);

  const setTheme = React.useCallback(
    (next: Theme | ((prev: Theme) => Theme)) => {
      setThemeState((prev) => {
        const candidate = typeof next === "function" ? next(prev) : next;
        const normalized = normalizeTheme(candidate, enableSystem, defaultTheme);

        try {
          window.localStorage.setItem(storageKey, normalized);
        } catch {
          // ignore write failures in private mode
        }

        return normalized;
      });
    },
    [defaultTheme, enableSystem, storageKey]
  );

  const resolvedTheme: SystemTheme =
    theme === "system" && enableSystem ? systemTheme : (theme as SystemTheme);

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
    }),
    [resolvedTheme, setTheme, systemTheme, theme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
