import { useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  label: string;
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  idPrefix?: string;
  className?: string;
}

export interface TabPanelProps {
  idPrefix: string;
  /** The currently selected tab id. */
  value: string;
  /** The tab id this panel belongs to. */
  id: string;
  className?: string;
  children?: ReactNode;
}

export function tabId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}

export function panelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}

export function Tabs({
  label,
  items,
  value,
  onValueChange,
  idPrefix,
  className,
}: TabsProps) {
  const generated = useId();
  const prefix = idPrefix ?? generated;
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = items.filter((item) => !item.disabled);
  const focusable = enabled.some((item) => item.id === value)
    ? value
    : (enabled[0]?.id ?? "");

  function move(target: TabItem | undefined) {
    if (!target) return;
    onValueChange(target.id);
    buttons.current[target.id]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const index = enabled.findIndex((item) => item.id === id);
    if (index < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(enabled[(index + 1) % enabled.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(enabled[(index - 1 + enabled.length) % enabled.length]);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(enabled[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      move(enabled[enabled.length - 1]);
    }
  }

  return (
    <div role="tablist" aria-label={label} className={cx("ui-tabs", className)}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              buttons.current[item.id] = node;
            }}
            type="button"
            role="tab"
            id={tabId(prefix, item.id)}
            aria-selected={selected}
            aria-controls={panelId(prefix, item.id)}
            tabIndex={item.id === focusable ? 0 : -1}
            disabled={item.disabled}
            className={cx("ui-tab", selected && "ui-tab--selected")}
            onClick={() => onValueChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idPrefix,
  value,
  id,
  className,
  children,
}: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      tabIndex={0}
      hidden={value !== id}
      className={cx("ui-tabpanel", className)}
    >
      {children}
    </div>
  );
}
