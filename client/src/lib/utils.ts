import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const USD_TO_NGN = 1600;

export function toNGN(usd: number | string): string {
  const amount = typeof usd === "string" ? parseFloat(usd) : usd;
  if (isNaN(amount)) return "₦0";
  const ngn = Math.round(amount * USD_TO_NGN);
  return `₦${ngn.toLocaleString("en-NG")}`;
}
