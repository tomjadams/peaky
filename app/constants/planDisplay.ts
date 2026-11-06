/**
 * Shared display config for improvement-plan severity.
 * Kept shared because review-level items and product rollups use the same labels.
 */
import type { RiskLevel } from "~/models/template";

export const SEVERITY_DISPLAY: Record<
  RiskLevel,
  { label: string; color: "error" | "warning" | "neutral" }
> = {
  critical: { label: "Critical", color: "error" },
  high: { label: "High", color: "warning" },
  medium: { label: "Medium", color: "neutral" },
};
