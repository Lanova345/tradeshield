"use client";

import { useTheme } from "next-themes";
import { SunMoon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunMoon size={17} />
    </button>
  );
}