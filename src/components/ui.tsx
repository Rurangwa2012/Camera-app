import type { ReactNode } from "react";

interface StatusBadgeProps {
  status: "online" | "offline" | "camera-on" | "streaming" | "recording" | "connected" | "disconnected" | "pending" | "paired" | "expired";
  label?: string;
  pulse?: boolean;
}

const styles: Record<StatusBadgeProps["status"], string> = {
  online: "bg-emerald-100 text-emerald-800 border-emerald-200",
  offline: "bg-slate-100 text-slate-600 border-slate-200",
  "camera-on": "bg-blue-100 text-blue-800 border-blue-200",
  streaming: "bg-indigo-100 text-indigo-800 border-indigo-200",
  recording: "bg-red-100 text-red-800 border-red-300",
  connected: "bg-emerald-100 text-emerald-800 border-emerald-200",
  disconnected: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  paired: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expired: "bg-red-100 text-red-700 border-red-200",
};

const defaultLabels: Record<StatusBadgeProps["status"], string> = {
  online: "Online",
  offline: "Offline",
  "camera-on": "Camera ON",
  streaming: "Streaming",
  recording: "REC",
  connected: "Connected",
  disconnected: "Disconnected",
  pending: "Pending",
  paired: "Paired",
  expired: "Expired",
};

export function StatusBadge({ status, label, pulse }: StatusBadgeProps) {
  const isRec = status === "recording";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles[status]} ${pulse ? "animate-pulse" : ""}`}
    >
      {(isRec || status === "online" || status === "camera-on") && (
        <span
          className={`h-2 w-2 rounded-full ${isRec ? "bg-red-600" : status === "camera-on" ? "bg-blue-600" : "bg-emerald-600"} ${pulse ? "animate-pulse" : ""}`}
        />
      )}
      {label || defaultLabels[status]}
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const buttonVariants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
};

const buttonSizes = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-6 py-4 text-lg font-semibold min-h-[56px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className = "", title, description }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h3 className="mb-1 text-lg font-semibold text-slate-900">{title}</h3>}
      {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}
      {children}
    </div>
  );
}

interface AlertProps {
  type: "error" | "warning" | "info" | "success";
  children: ReactNode;
  onDismiss?: () => void;
}

const alertStyles = {
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

export function Alert({ type, children, onDismiss }: AlertProps) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${alertStyles[type]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>{children}</div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };
  return (
    <div
      className={`animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 ${sizes[size]}`}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
