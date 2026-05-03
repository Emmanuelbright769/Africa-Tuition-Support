import { useQuery } from "@tanstack/react-query";

export type Bank = { code: string; name: string; gateway?: string };

const FALLBACK_BANKS: Bank[] = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "035A", name: "ALAT by WEMA" },
  { code: "401", name: "ASO Savings & Loans" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "562", name: "Ekondo Microfinance Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "FCMB (First City Monument Bank)" },
  { code: "501", name: "FSDH Merchant Bank" },
  { code: "058", name: "GTBank (Guaranty Trust Bank)" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "090267", name: "Kuda Bank (MFB)" },
  { code: "50211", name: "Kuda Microfinance (alt)" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "90405", name: "Moniepoint MFB (alt)" },
  { code: "100004", name: "OPay (OPay Digital Services)" },
  { code: "999992", name: "OPay (alt)" },
  { code: "100033", name: "PalmPay" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "125", name: "Rubies MFB" },
  { code: "100029", name: "Sparkle Microfinance Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank" },
  { code: "302", name: "TAJ Bank" },
  { code: "102", name: "Titan Trust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "215", name: "Unity Bank" },
  { code: "090110", name: "VFD Microfinance Bank" },
  { code: "566", name: "VFD MFB (alt)" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "100025", name: "Carbon (Paylater)" },
  { code: "000019", name: "Flutterwave (Rave)" },
];

export function useBanks() {
  const { data, isLoading } = useQuery<Bank[]>({
    queryKey: ["/api/wallet/banks"],
    queryFn: async () => {
      const res = await fetch("/api/wallet/banks", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const banks = (data && data.length > 0 ? data : FALLBACK_BANKS).slice().sort((a, b) => a.name.localeCompare(b.name));
  return { banks, isLoading, isFallback: !data || data.length === 0 };
}
