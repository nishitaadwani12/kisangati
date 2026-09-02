// Runtime theme switching for the dashboard. Sets `data-theme` on <html> and
// persists the choice in localStorage. Palettes are defined in styles.css.
import { useState } from "react";

export type ThemeId = "" | "harvest" | "indigo" | "dark";

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "", label: "Kisan Modern", swatch: "#0f7a54" },
  { id: "harvest", label: "Harvest Earth", swatch: "#c2410c" },
  { id: "indigo", label: "Trust Indigo", swatch: "#4f46e5" },
  { id: "dark", label: "Slate Dark", swatch: "#17201c" },
];

const KEY = "kg_theme";

export function getTheme(): ThemeId {
  const v = (localStorage.getItem(KEY) || "") as ThemeId;
  return THEMES.some((t) => t.id === v) ? v : "";
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id) root.setAttribute("data-theme", id);
  else root.removeAttribute("data-theme");
  localStorage.setItem(KEY, id);
}

// Palette-dot picker. `variant="login"` centers it on the login card.
export function ThemeSwitcher({ variant, label }: { variant?: "login"; label?: string }) {
  const [current, setCurrent] = useState<ThemeId>(getTheme());
  const pick = (id: ThemeId) => { applyTheme(id); setCurrent(id); };
  return (
    <div className={variant === "login" ? "login-themeswitch" : "themeswitch"}>
      {label && <span className="lbl">{label}</span>}
      {THEMES.map((th) => (
        <button
          key={th.id || "default"}
          type="button"
          title={th.label}
          aria-label={th.label}
          className={`theme-dot${current === th.id ? " on" : ""}`}
          style={{ background: th.swatch }}
          onClick={() => pick(th.id)}
        />
      ))}
    </div>
  );
}
