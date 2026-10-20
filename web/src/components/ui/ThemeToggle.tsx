import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { THEME_OPTIONS } from "../../lib/theme";
import type { ThemePreference } from "../../lib/theme";

export interface ThemeToggleProps {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}

const icons: Record<ThemePreference, ReactNode> = {
  system: <Monitor size={16} />,
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
};

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div role="group" aria-label="Appearance" className="ui-theme-toggle">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className="ui-theme-toggle__option"
          onClick={() => onChange(option.value)}
        >
          <span className="ui-theme-toggle__icon" aria-hidden="true">
            {icons[option.value]}
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
