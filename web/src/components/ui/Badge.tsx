import type { ReactNode } from "react";
import { cx } from "./cx";

export interface BadgeProps {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The label text always carries the meaning; colour only reinforces it. */
export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)}>
      {icon ? (
        <span className="ui-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
