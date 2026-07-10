export function cn(...inputs: (string | undefined | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
