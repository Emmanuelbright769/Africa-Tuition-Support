import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";

interface TermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  context?: "signup" | "payment" | "withdrawal" | "trade" | "loan" | "booking";
  className?: string;
}

const CONTEXT_LABELS: Record<NonNullable<TermsCheckboxProps["context"]>, string> = {
  signup:     "I have read and agree to the TSIA",
  payment:    "I understand the fees involved and agree to the TSIA",
  withdrawal: "I understand that 7.5% VAT will be deducted and agree to the TSIA",
  trade:      "I understand that trading involves financial risk and agree to the TSIA",
  loan:       "I understand the loan terms and repayment obligations under the TSIA",
  booking:    "I understand that bookings are subject to third-party policies and agree to the TSIA",
};

export function TermsCheckbox({ checked, onCheckedChange, context = "signup", className = "" }: TermsCheckboxProps) {
  const label = CONTEXT_LABELS[context];
  const id = `terms-checkbox-${context}`;

  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(!!v)}
        className="mt-0.5 shrink-0"
        data-testid={`checkbox-terms-${context}`}
      />
      <label htmlFor={id} className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
        {label}{" "}
        <Link href="/terms">
          <a
            className="text-tsia-green underline hover:text-tsia-green/80 font-semibold"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            data-testid="link-terms-and-conditions"
          >
            Terms &amp; Conditions
          </a>
        </Link>
        {context === "withdrawal" && (
          <span className="block mt-0.5 text-amber-600 dark:text-amber-400 font-medium">
            A 7.5% VAT applies to all bank withdrawals per UK tax regulations.
          </span>
        )}
        {context === "trade" && (
          <span className="block mt-0.5 text-amber-600 dark:text-amber-400 font-medium">
            Past performance does not guarantee future returns.
          </span>
        )}
      </label>
    </div>
  );
}
