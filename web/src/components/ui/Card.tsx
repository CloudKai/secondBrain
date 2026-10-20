import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> {
  as?: "div" | "section" | "article" | "aside";
  tone?: "default" | "raised" | "quiet";
  padding?: "sm" | "md" | "lg";
  children?: ReactNode;
}

export function Card({
  as,
  tone = "default",
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  const Tag = as ?? "div";
  return (
    <Tag
      {...rest}
      className={cx(
        "ui-card",
        `ui-card--${tone}`,
        `ui-card--pad-${padding}`,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
