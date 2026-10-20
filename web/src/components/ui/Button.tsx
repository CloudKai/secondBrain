import { LoaderCircle } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

/** Icon-only buttons must carry an accessible name. */
type ButtonContent =
  | { iconOnly?: false; children: ReactNode }
  | { iconOnly: true; "aria-label": string; children?: ReactNode };

export type ButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "className" | "children"
> &
  ButtonLook & { loading?: boolean } & ButtonContent;

export type ButtonLinkProps = Omit<
  ComponentPropsWithRef<"a">,
  "className" | "children" | "href"
> &
  ButtonLook & { href: string } & ButtonContent;

function buttonClass(
  { variant = "secondary", size = "md", fullWidth, className }: ButtonLook,
  iconOnly: boolean | undefined,
  loading?: boolean,
): string {
  return cx(
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    iconOnly && "ui-button--icon",
    fullWidth && "ui-button--full",
    loading && "ui-button--loading",
    className,
  );
}

function ButtonBody({
  iconOnly,
  leadingIcon,
  trailingIcon,
  children,
}: Pick<ButtonLook, "leadingIcon" | "trailingIcon"> & {
  iconOnly: boolean | undefined;
  children: ReactNode;
}) {
  if (iconOnly) {
    return (
      <span className="ui-button__icon" aria-hidden="true">
        {leadingIcon}
        {children}
      </span>
    );
  }
  return (
    <>
      {leadingIcon ? (
        <span className="ui-button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className="ui-button__label">{children}</span>
      {trailingIcon ? (
        <span className="ui-button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </>
  );
}

export function Button({
  variant,
  size,
  leadingIcon,
  trailingIcon,
  fullWidth,
  className,
  loading = false,
  iconOnly,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      className={buttonClass(
        { variant, size, fullWidth, className },
        iconOnly,
        loading,
      )}
    >
      {loading ? (
        <span className="ui-button__icon" aria-hidden="true">
          <LoaderCircle size={16} className="spin" />
        </span>
      ) : null}
      <ButtonBody
        iconOnly={iconOnly}
        leadingIcon={loading ? null : leadingIcon}
        trailingIcon={trailingIcon}
      >
        {children}
      </ButtonBody>
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  leadingIcon,
  trailingIcon,
  fullWidth,
  className,
  iconOnly,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a
      {...rest}
      className={buttonClass({ variant, size, fullWidth, className }, iconOnly)}
    >
      <ButtonBody
        iconOnly={iconOnly}
        leadingIcon={leadingIcon}
        trailingIcon={trailingIcon}
      >
        {children}
      </ButtonBody>
    </a>
  );
}
