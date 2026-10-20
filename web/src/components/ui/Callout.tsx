import { Info, Sparkles, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type CalloutVariant = "focus" | "info" | "caution";

export interface CalloutProps extends Pick<
  HTMLAttributes<HTMLElement>,
  "id" | "aria-label" | "aria-labelledby"
> {
  variant?: CalloutVariant;
  title?: ReactNode;
  icon?: ReactNode | false;
  as?: "div" | "section" | "aside";
  role?: "note" | "status" | "alert";
  className?: string;
  children?: ReactNode;
}

function defaultIcon(variant: CalloutVariant): ReactNode {
  if (variant === "info") return <Info size={18} />;
  if (variant === "caution") return <TriangleAlert size={18} />;
  return <Sparkles size={18} />;
}

/**
 * The single "look here" idiom: a tinted block, a left bar, an icon and a text
 * title, so emphasis never depends on colour alone.
 */
export function Callout({
  variant = "focus",
  title,
  icon,
  as,
  role,
  className,
  children,
  ...rest
}: CalloutProps) {
  const Tag = as ?? "div";
  const shownIcon = icon === false ? null : (icon ?? defaultIcon(variant));
  return (
    <Tag
      {...rest}
      role={role}
      className={cx("ui-callout", `ui-callout--${variant}`, className)}
    >
      {shownIcon ? (
        <span className="ui-callout__icon" aria-hidden="true">
          {shownIcon}
        </span>
      ) : null}
      <div className="ui-callout__body">
        {title ? <p className="ui-callout__title">{title}</p> : null}
        {children ? (
          <div className="ui-callout__content">{children}</div>
        ) : null}
      </div>
    </Tag>
  );
}
