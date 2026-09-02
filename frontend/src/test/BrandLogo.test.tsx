import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/components/common/BrandLogo";
import { BrandMark } from "@/components/common/BrandMark";

describe("BrandLogo", () => {
  it("renders the full logo with accessible name", () => {
    render(<BrandLogo variant="full" />);
    expect(screen.getByRole("img", { name: "AI Sales Assistant" })).toBeInTheDocument();
  });

  it("BrandMark renders symbol only (mark variant)", () => {
    const { container } = render(<BrandMark size="sm" />);
    const img = screen.getByRole("img", { name: "AI Sales Assistant" });
    expect(img).toBeInTheDocument();
    expect(container.querySelector("img")?.getAttribute("src") ?? "").toMatch(/ai-sales-mark/);
  });
});
