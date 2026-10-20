import { cx } from "./cx";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  /** A position or activity phrase such as "Lesson 2 of 4", never a mastery claim. */
  valueText?: string;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  size = "md",
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const now = Math.min(Math.max(value, 0), safeMax);
  const percent = (now / safeMax) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={now}
      aria-valuetext={valueText ?? `${now} of ${safeMax}`}
      className={cx("ui-progress", `ui-progress--${size}`, className)}
    >
      <span className="ui-progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
