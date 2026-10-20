import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className={cx("ui-empty", className)}>
      {icon ? (
        <span className="ui-empty__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <Heading className="ui-empty__title">{title}</Heading>
      {description ? (
        <div className="ui-empty__description">{description}</div>
      ) : null}
      {actions ? <div className="ui-empty__actions">{actions}</div> : null}
    </div>
  );
}
