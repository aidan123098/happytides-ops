import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits
  }).format(cents / 100);
}

export function formatCurrencyOrNA(cents: number | null | undefined, maximumFractionDigits = 2) {
  return cents && cents > 0 ? formatCurrency(cents, maximumFractionDigits) : "N/A";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatNumberOrNA(value: number | null | undefined) {
  return value && value > 0 ? formatNumber(value) : "N/A";
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatPercentOrNA(value: number | null | undefined) {
  return value && value > 0 ? `${value.toFixed(1)}%` : "N/A";
}
