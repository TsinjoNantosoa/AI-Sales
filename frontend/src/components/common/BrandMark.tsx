import { BrandLogo, type BrandLogoProps } from "./BrandLogo";

export type BrandMarkProps = Omit<BrandLogoProps, "variant">;

/** Compact brand symbol only — never renders the full wordmark. */
export function BrandMark(props: BrandMarkProps) {
  return <BrandLogo {...props} variant="mark" />;
}

export { BRAND_NAME } from "./BrandLogo";
