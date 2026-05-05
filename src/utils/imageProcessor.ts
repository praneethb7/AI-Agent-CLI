import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { GroqService } from "../services/groq.js";

// ─── exported types ───────────────────────────────────────────────────────────

export interface ColorPalette {
  primary: string;
  secondary?: string;
  bg: string;
  bgAlt?: string;
  surface?: string;
  border?: string;
  text?: string;
  textMuted?: string;
}

export interface NavData {
  brandName?: string;
  links?: string[];
  primaryCta?: string;
  secondaryCta?: string;
}

export interface HeroData {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  primaryCta?: string;
  secondaryCta?: string;
  rightContent?: "code-card" | "dashboard-card" | "image" | "none";
  badges?: Array<{ icon?: string; title: string; subtitle: string }>;
}

export interface StatItem {
  value: string;
  suffix?: string;
  label: string;
}

export interface FeatureItem {
  title: string;
  body: string;
}

export interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  badge?: string;
}

export interface CtaData {
  headline?: string;
  sub?: string;
  buttonText?: string;
}

export interface FooterData {
  brandName?: string;
  tagline?: string;
  columns?: Array<{ heading: string; links: string[] }>;
}

export interface PageData {
  nav?: NavData;
  hero?: HeroData;
  stats?: StatItem[];
  features?: FeatureItem[];
  testimonials?: TestimonialItem[];
  cta?: CtaData;
  footer?: FooterData;
}

export interface TypographyDetails {
  scale?: "compact" | "default" | "large";
  fontFamily?: "inter" | "system" | "serif";
  headingWeight?: "normal" | "bold" | "extrabold";
}

// Kept for backward compatibility
export interface LayoutStyleHints {
  primaryColor: string;
  background: string;
  typography: string;
}

export interface ImageLayout {
  layout: string;
  theme: string;
  sections: string[];
  styleHints: LayoutStyleHints;
  colors?: ColorPalette;
  typography?: TypographyDetails;
  pageData?: PageData;
}

// ─── fallback ─────────────────────────────────────────────────────────────────

const FALLBACK: ImageLayout = {
  layout: "hero-left-text right-card",
  theme: "dark",
  sections: ["header", "hero", "stats", "features", "testimonials", "cta", "footer"],
  styleHints: { primaryColor: "#FF6B35", background: "dark", typography: "default" },
  colors: {
    primary: "#FF6B35",
    secondary: "#1a2a6c",
    bg: "#0b1220",
    bgAlt: "#0f1a2e",
    surface: "#162038",
    border: "#1e2d4a",
    text: "#dde6f0",
    textMuted: "#7a90b0",
  },
  typography: { scale: "default", fontFamily: "inter", headingWeight: "extrabold" },
};

// ─── analysis ─────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a precise UI analyst. Study this screenshot carefully and return ONE JSON object — no prose, no markdown, no explanation.

Use this EXACT shape (omit keys that are not visible):

{
  "layout": "hero-left-text right-card | hero-centered | two-column | dashboard-sidebar | landing-page",
  "theme": "dark | light | gradient | mesh | solid",
  "sections": ["header", "hero", "stats", "features", "testimonials", "cta", "footer"],

  "colors": {
    "primary":   "<main brand/accent hex, e.g. #FF6B35>",
    "secondary": "<secondary brand hex>",
    "bg":        "<page background hex>",
    "bgAlt":     "<alternate section background hex>",
    "surface":   "<card/panel surface hex>",
    "border":    "<border/divider hex>",
    "text":      "<primary body text hex>",
    "textMuted": "<muted/secondary text hex>"
  },

  "typography": {
    "scale":         "compact | default | large",
    "fontFamily":    "inter | system | serif",
    "headingWeight": "bold | extrabold"
  },

  "pageData": {
    "nav": {
      "brandName":    "<exact brand name visible>",
      "links":        ["<exact nav link text>"],
      "primaryCta":   "<primary nav button text>",
      "secondaryCta": "<secondary nav button text if any>"
    },
    "hero": {
      "eyebrow":      "<small label above headline>",
      "headline":     "<main headline text>",
      "subheadline":  "<subtitle or description text>",
      "primaryCta":   "<main CTA button text>",
      "secondaryCta": "<secondary CTA button text>",
      "rightContent": "code-card | dashboard-card | image | none"
    },
    "stats": [
      { "value": "<number>", "suffix": "<+|%|x etc>", "label": "<stat label>" }
    ],
    "features": [
      { "title": "<feature heading>", "body": "<feature description>" }
    ],
    "testimonials": [
      { "quote": "<quote text>", "name": "<person name>", "role": "<role at company>", "badge": "<e.g. 32 LPA>" }
    ],
    "cta": {
      "headline":   "<CTA section headline>",
      "sub":        "<CTA sub-text>",
      "buttonText": "<CTA button text>"
    },
    "footer": {
      "brandName": "<brand name>",
      "tagline":   "<tagline>",
      "columns": [
        { "heading": "<column heading>", "links": ["<link text>"] }
      ]
    }
  }
}

Rules:
- Copy EXACT text from the screenshot, do not invent content
- Extract ALL visible hex/rgb colors, converting rgb to hex
- Only include sections/fields that are actually visible
- For colors, look at buttons, backgrounds, text, borders — all distinct colors
- Return ONLY the JSON object`;

function imageToDataUrl(imagePath: string): string {
  const ext = extname(imagePath).toLowerCase().slice(1);
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
  };
  const mime = mimeMap[ext] ?? "image/png";
  const base64 = readFileSync(imagePath).toString("base64");
  return `data:${mime};base64,${base64}`;
}

export async function analyzeImageLayout(
  imagePath: string,
  groq: GroqService
): Promise<ImageLayout> {
  try {
    const dataUrl = imageToDataUrl(imagePath);

    // Use 1500 tokens — the full JSON response can be large
    const response = await groq.chat(
      [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      1500
    );

    const raw = response.content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(raw) as Partial<ImageLayout>;

    if (!parsed.layout || !parsed.theme) return FALLBACK;

    const colors = parsed.colors ?? FALLBACK.colors!;
    const typography = parsed.typography ?? FALLBACK.typography!;

    return {
      layout: parsed.layout,
      theme: parsed.theme,
      sections: Array.isArray(parsed.sections) ? parsed.sections : FALLBACK.sections,
      styleHints: {
        primaryColor: colors.primary ?? FALLBACK.styleHints.primaryColor,
        background: parsed.theme,
        typography: typography.scale ?? "default",
      },
      colors,
      typography,
      ...(parsed.pageData !== undefined ? { pageData: parsed.pageData } : {}),
    };
  } catch {
    return FALLBACK;
  }
}

/** Synchronous no-op fallback for callers that can't go async. */
export function extractBasicLayout(_imagePath: string): ImageLayout {
  return FALLBACK;
}
