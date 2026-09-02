import { cn } from "@/lib/utils";
import logoFull from "@/assets/branding/ai-sales-logo.webp";
import logoMark from "@/assets/branding/ai-sales-mark.webp";

export const BRAND_NAME = "AI Sales Assistant";

type BrandLogoVariant = "full" | "mark";
type BrandLogoSize = "sm" | "md" | "lg";

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
  /** Rounded clip on light surfaces. Does not recolor the original asset. */
  onLight?: boolean;
  /** Navigation logos should load immediately (default). */
  priority?: boolean;
  /** `height` keeps a navbar-safe max height without stretching the asset. */
  constrain?: "width" | "height";
}

const FULL_WIDTH: Record<BrandLogoSize, string> = {
  sm: "w-[min(100%,10.5rem)]",
  md: "w-[min(100%,12.25rem)]",
  lg: "w-[min(100%,17.5rem)] max-sm:w-[min(100%,13.75rem)]",
};

const MARK_BOX: Record<BrandLogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

export function BrandLogo({
  variant = "full",
  size = "md",
  className,
  onLight = false,
  priority = true,
  constrain = "width",
}: BrandLogoProps) {
  const isMark = variant === "mark";
  const heightFit = !isMark && constrain === "height";

  return (
    <div
      className={cn(
        "shrink-0 leading-none",
        isMark ? MARK_BOX[size] : heightFit ? "w-auto" : FULL_WIDTH[size],
        onLight && "rounded-md overflow-hidden",
        className,
      )}
    >
      <img
        src={isMark ? logoMark : logoFull}
        alt={BRAND_NAME}
        width={isMark ? 200 : 1024}
        height={isMark ? 231 : 338}
        className={cn(
          "block object-contain",
          isMark
            ? "h-full w-full"
            : heightFit
              ? "h-full w-auto max-w-full"
              : "h-auto w-full",
        )}
        draggable={false}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
      />
    </div>
  );
}
