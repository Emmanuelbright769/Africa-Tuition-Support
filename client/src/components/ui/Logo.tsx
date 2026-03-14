import logoColorHorizontal from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104201_0000_1773481330559.png";
import logoWhiteHorizontal from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104313_0000_1773481330559.png";
import logoBadgeColor from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104012_0000_1773481330558.png";
import logoBadgeWhite from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104300_0000_1773481330559.png";
import logoColorFull from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104143_0000_1773481330559.png";
import logoWhiteFull from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104245_0000_1773481330559.png";
import { useTheme } from "@/lib/theme";

type LogoVariant = "horizontal" | "badge" | "full";

interface LogoProps {
  variant?: LogoVariant;
  forceDark?: boolean;
  className?: string;
  height?: number;
}

export function Logo({ variant = "horizontal", forceDark = false, className = "", height = 40 }: LogoProps) {
  const { resolved } = useTheme();
  const isDark = forceDark || resolved === "dark";

  const logoMap = {
    horizontal: isDark ? logoWhiteHorizontal : logoColorHorizontal,
    badge: isDark ? logoBadgeWhite : logoBadgeColor,
    full: isDark ? logoWhiteFull : logoColorFull,
  };

  return (
    <img
      src={logoMap[variant]}
      alt="TSIA - Tuition Support Initiative for Africa"
      className={className}
      style={{ height: `${height}px`, width: "auto" }}
      data-testid="img-tsia-logo"
    />
  );
}

export { logoColorHorizontal, logoWhiteHorizontal, logoBadgeColor, logoBadgeWhite, logoColorFull, logoWhiteFull };
