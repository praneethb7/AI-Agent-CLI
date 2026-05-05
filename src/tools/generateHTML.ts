import { type Tool, type ToolInput, type ToolResult } from "./registry.js";
import { writeFileTool } from "./writeFile.js";

// ─── page-data types (mirrored from imageProcessor to avoid circular import) ──

interface NavData {
  brandName?: string;
  links?: string[];
  primaryCta?: string;
  secondaryCta?: string;
}

interface HeroData {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  primaryCta?: string;
  secondaryCta?: string;
  rightContent?: string;
  badges?: Array<{ icon?: string; title: string; subtitle: string }>;
}

interface StatItem {
  value: string;
  suffix?: string;
  label: string;
}

interface FeatureItem {
  title: string;
  body: string;
}

interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  badge?: string;
}

interface CtaData {
  headline?: string;
  sub?: string;
  buttonText?: string;
}

interface FooterData {
  brandName?: string;
  tagline?: string;
  columns?: Array<{ heading: string; links: string[] }>;
}

interface PageData {
  nav?: NavData;
  hero?: HeroData;
  stats?: StatItem[];
  features?: FeatureItem[];
  testimonials?: TestimonialItem[];
  cta?: CtaData;
  footer?: FooterData;
}

// ─── input types ──────────────────────────────────────────────────────────────

interface GenerateHTMLInput {
  filename: string;
  title?: string;
  cssFile?: string;
  jsFile?: string;
  layout?: string;
  theme?: string;
  sections?: string[];
  pageData?: PageData;
}

interface LayoutHints {
  heroAlignment: "left" | "centered";
  heroRight: "card" | "image" | "none";
}

function isGenerateHTMLInput(input: unknown): input is GenerateHTMLInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return typeof i["filename"] === "string";
}

function parseLayout(layout: string): LayoutHints {
  const tokens = layout.toLowerCase().split(/\s+/);
  const hints: LayoutHints = { heroAlignment: "left", heroRight: "card" };
  for (const token of tokens) {
    if (token === "hero-centered") hints.heroAlignment = "centered";
    if (token === "hero-left-text") hints.heroAlignment = "left";
    if (token === "right-card") hints.heroRight = "card";
    if (token === "right-image") hints.heroRight = "image";
    if (token === "right-none") hints.heroRight = "none";
  }
  return hints;
}

function getThemeVars(theme: string): string {
  if (theme === "dark") {
    return `--bg:#0f172a;--bg-alt:#1e293b;--surface:#1e293b;--text:#f1f5f9;--text-muted:#94a3b8;--border:#334155;--accent:#FF6B35;--accent-light:rgba(255,107,53,.15);`;
  }
  if (theme === "light") {
    return `--bg:#ffffff;--bg-alt:#f8fafc;--surface:#ffffff;--text:#0f172a;--text-muted:#64748b;--border:#e2e8f0;--accent:#FF6B35;--accent-light:rgba(255,107,53,.1);`;
  }
  return `--bg:#0a0a0f;--bg-alt:#111118;--surface:#16161f;--text:#f8f8ff;--text-muted:#9090b0;--border:#2a2a3a;--accent:#FF6B35;--accent-light:rgba(255,107,53,.15);`;
}

// ─── section builders ─────────────────────────────────────────────────────────

const DEFAULT_NAV_LINKS = ["Courses", "Why Scaler", "Success Stories", "Outcomes"];
const DEFAULT_NAV_ANCHORS = ["#courses", "#features", "#testimonials", "#stats"];

function buildHeader(nav?: NavData): string {
  const brand = nav?.brandName ?? "Scaler";
  const links = nav?.links ?? DEFAULT_NAV_LINKS;
  const primaryCta = nav?.primaryCta ?? "Apply Now";
  const secondaryCta = nav?.secondaryCta ?? "Log in";

  const navItems = links
    .map((link, i) => {
      const anchor = DEFAULT_NAV_ANCHORS[i] ?? `#${link.toLowerCase().replace(/\s+/g, "-")}`;
      return `<li><a href="${anchor}">${escapeHtml(link)}</a></li>`;
    })
    .join("\n        ");

  const mobileItems = links
    .map((link, i) => {
      const anchor = DEFAULT_NAV_ANCHORS[i] ?? `#${link.toLowerCase().replace(/\s+/g, "-")}`;
      return `<li><a href="${anchor}">${escapeHtml(link)}</a></li>`;
    })
    .join("\n        ");

  return `
  <header class="header" role="banner">
    <nav class="nav container" aria-label="Main navigation">
      <a href="/" class="logo" aria-label="${escapeHtml(brand)} home">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#FF6B35"/>
          <path d="M8 16L16 8L24 16L16 24L8 16Z" fill="white"/>
        </svg>
        <span class="logo-text">${escapeHtml(brand)}</span>
      </a>
      <ul class="nav-links" role="list">
        ${navItems}
      </ul>
      <div class="nav-actions">
        <a href="/login" class="btn btn-ghost">${escapeHtml(secondaryCta)}</a>
        <a href="/apply" class="btn btn-primary">${escapeHtml(primaryCta)}</a>
      </div>
      <button class="hamburger" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span><span></span>
      </button>
    </nav>
    <div id="mobile-menu" class="mobile-menu" hidden>
      <ul role="list">
        ${mobileItems}
        <li><a href="/apply" class="btn btn-primary">${escapeHtml(primaryCta)}</a></li>
      </ul>
    </div>
  </header>`;
}

function buildHeroText(hero?: HeroData): string {
  const eyebrow = hero?.eyebrow ?? "Trusted by 1,00,000+ learners";
  const headline = hero?.headline ?? "Crack FAANG.\nDouble Your Salary with Elite Mentorship";
  const subheadline =
    hero?.subheadline ??
    "Master DSA, system design & backend engineering through live classes, 1-on-1 mentoring from FAANG engineers, and real-world projects that get you hired.";
  const primaryCta = hero?.primaryCta ?? "Get Free Career Counselling";
  const secondaryCta = hero?.secondaryCta ?? "Explore Programs";

  // Split headline on newline so last segment gets gradient treatment
  const lines = headline.split(/\n/);
  const headingHTML =
    lines.length > 1
      ? `${lines.slice(0, -1).map(escapeHtml).join("<br>\n            ")}<br>\n            <span class="gradient-text">${escapeHtml(lines[lines.length - 1]!)}</span>`
      : `<span class="gradient-text">${escapeHtml(headline)}</span>`;

  return `
        <div class="hero-content">
          <p class="hero-eyebrow">${escapeHtml(eyebrow)}</p>
          <h1 id="hero-heading" class="hero-heading">
            ${headingHTML}
          </h1>
          <p class="hero-subtext">${escapeHtml(subheadline)}</p>
          <div class="hero-actions">
            <a href="/apply" class="btn btn-primary btn-lg">${escapeHtml(primaryCta)}</a>
            <a href="#features" class="btn btn-outline btn-lg">${escapeHtml(secondaryCta)}</a>
          </div>
          <p class="hero-note">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="#22C55E" stroke-width="1.5"/>
              <path d="M5 8L7 10L11 6" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            No upfront payment · 100% refund guarantee
          </p>
        </div>`;
}

const DEFAULT_BADGES: Array<{ icon: string; title: string; subtitle: string }> = [
  { icon: "🎯", title: "Amazon SDE-2 Offer", subtitle: "₹42 LPA · Placed in 6 months" },
  { icon: "👨‍💻", title: "Rahul Gupta", subtitle: "Ex-Google · Your Mentor" },
];

function buildHeroCard(hero?: HeroData): string {
  const badges =
    hero?.badges && hero.badges.length > 0
      ? hero.badges.slice(0, 2).map((b) => ({ icon: b.icon ?? "✨", title: b.title, subtitle: b.subtitle }))
      : DEFAULT_BADGES;

  const [badge1, badge2] = [badges[0] ?? DEFAULT_BADGES[0]!, badges[1] ?? DEFAULT_BADGES[1]!];

  return `
        <figure class="hero-image" aria-hidden="true">
          <div class="hero-card hero-card--main">
            <div class="code-window">
              <div class="code-window-bar">
                <span class="dot dot--red"></span>
                <span class="dot dot--yellow"></span>
                <span class="dot dot--green"></span>
                <span class="code-window-title">solution.js</span>
              </div>
              <pre class="code-snippet"><code><span class="cmt">// O(n) time · O(n) space</span>
<span class="kw">function</span> <span class="fn">twoSum</span>(nums, target) {
  <span class="kw">const</span> map <span class="op">=</span> <span class="kw">new</span> <span class="fn">Map</span>();
  <span class="kw">for</span> (<span class="kw">let</span> i <span class="op">=</span> <span class="num">0</span>; i <span class="op">&lt;</span> nums.length; i<span class="op">++</span>) {
    <span class="kw">const</span> comp <span class="op">=</span> target <span class="op">-</span> nums[i];
    <span class="kw">if</span> (map.<span class="fn">has</span>(comp))
      <span class="kw">return</span> [map.<span class="fn">get</span>(comp), i];
    map.<span class="fn">set</span>(nums[i], i);
  }
}
<span class="cmt">// ✓ Runtime: beats 98.2%</span></code></pre>
            </div>
          </div>
          <div class="hero-card hero-card--badge hero-card--offer">
            <span class="badge-icon">${badge1.icon}</span>
            <div>
              <strong>${escapeHtml(badge1.title)}</strong>
              <span>${escapeHtml(badge1.subtitle)}</span>
            </div>
          </div>
          <div class="hero-card hero-card--badge hero-card--mentor">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(badge2.title)}&background=ff7a18&color=fff&size=40" alt="${escapeHtml(badge2.title)}" width="40" height="40" class="avatar">
            <div>
              <strong>${escapeHtml(badge2.title)}</strong>
              <span>${escapeHtml(badge2.subtitle)}</span>
            </div>
          </div>
        </figure>`;
}

function buildHero(hints: LayoutHints, hero?: HeroData): string {
  const isCentered = hints.heroAlignment === "centered";
  const innerClass = isCentered ? "hero-inner hero-inner--centered" : "hero-inner";

  let inner = buildHeroText(hero);

  if (!isCentered) {
    if (hints.heroRight === "card") {
      inner += buildHeroCard(hero);
    } else if (hints.heroRight === "image") {
      inner += `
        <figure class="hero-image" aria-hidden="true">
          <img src="https://ui-avatars.com/api/?name=Hero+Image&size=480&background=FF6B35&color=fff" alt="" width="480" height="360" class="hero-img">
        </figure>`;
    }
  }

  return `
    <section class="hero" aria-labelledby="hero-heading">
      <div class="container ${innerClass}">
        ${inner}
      </div>
    </section>`;
}

const DEFAULT_STATS: StatItem[] = [
  { value: "700", suffix: "+", label: "Hiring Partners" },
  { value: "50", suffix: "%", label: "Average Salary Hike" },
  { value: "1", suffix: "L+", label: "Alumni Placed" },
  { value: "4.8", suffix: "/5", label: "Average Rating" },
];

function buildStats(stats?: StatItem[]): string {
  const items = stats && stats.length > 0 ? stats : DEFAULT_STATS;
  const listItems = items
    .map(
      (s) => `
          <li class="stat-item">
            <span class="stat-number" data-target="${escapeHtml(s.value)}">${escapeHtml(s.value)}</span>${s.suffix ? `<span class="stat-suffix">${escapeHtml(s.suffix)}</span>` : ""}
            <span class="stat-label">${escapeHtml(s.label)}</span>
          </li>`
    )
    .join("");

  return `
    <section class="stats" id="stats" aria-labelledby="stats-heading">
      <div class="container">
        <h2 id="stats-heading" class="sr-only">Platform Outcomes</h2>
        <ul class="stats-grid" role="list">${listItems}
        </ul>
      </div>
    </section>`;
}

const FEATURE_ICON_PATHS = [
  `<path d="M4 14L14 4L24 14V24H18V18H10V24H4V14Z" fill="#FF6B35" opacity=".15"/><path d="M4 14L14 4L24 14V24H18V18H10V24H4V14Z" stroke="#FF6B35" stroke-width="1.8" stroke-linejoin="round"/>`,
  `<circle cx="14" cy="14" r="10" fill="#6366F1" opacity=".15"/><circle cx="14" cy="14" r="10" stroke="#6366F1" stroke-width="1.8"/><path d="M14 9v5l3 3" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round"/>`,
  `<rect x="4" y="8" width="20" height="14" rx="2" fill="#22C55E" opacity=".15"/><rect x="4" y="8" width="20" height="14" rx="2" stroke="#22C55E" stroke-width="1.8"/><path d="M10 14h8M10 18h5" stroke="#22C55E" stroke-width="1.8" stroke-linecap="round"/>`,
  `<path d="M14 4L17.5 11L25 12L19.5 17.5L21 25L14 21.5L7 25L8.5 17.5L3 12L10.5 11L14 4Z" fill="#F59E0B" opacity=".15" stroke="#F59E0B" stroke-width="1.8" stroke-linejoin="round"/>`,
  `<path d="M6 22V14a8 8 0 1116 0v8" stroke="#EC4899" stroke-width="1.8" stroke-linecap="round"/><rect x="4" y="18" width="6" height="6" rx="1" fill="#EC4899" opacity=".15" stroke="#EC4899" stroke-width="1.8"/><rect x="18" y="18" width="6" height="6" rx="1" fill="#EC4899" opacity=".15" stroke="#EC4899" stroke-width="1.8"/>`,
  `<path d="M14 4v20M4 14h20" stroke="#0EA5E9" stroke-width="1.8" stroke-linecap="round"/><circle cx="14" cy="14" r="4" fill="#0EA5E9" opacity=".15" stroke="#0EA5E9" stroke-width="1.8"/>`,
];

const DEFAULT_FEATURES: FeatureItem[] = [
  { title: "Live Interactive Classes", body: "200+ hours of live sessions led by senior engineers. Ask questions in real time, not async." },
  { title: "1-on-1 Mentorship", body: "Weekly sessions with a dedicated mentor from Google, Meta, or Amazon who has been in your shoes." },
  { title: "Real-World Projects", body: "Build production-grade projects — distributed systems, scalable APIs, and data pipelines." },
  { title: "Career Support", body: "Resume reviews, mock interviews, LinkedIn optimisation, and referrals to 700+ hiring partners." },
  { title: "Expert Community", body: "Peer learning circles, alumni Slack workspace, and exclusive events with industry leaders." },
  { title: "Structured DSA + System Design", body: "A proven 6-month roadmap covering every topic asked in FAANG interviews." },
];

function buildFeatures(features?: FeatureItem[]): string {
  const items = features && features.length > 0 ? features : DEFAULT_FEATURES;
  const cards = items
    .map(
      (f, i) => `
          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                ${FEATURE_ICON_PATHS[i % FEATURE_ICON_PATHS.length]}
              </svg>
            </div>
            <h3>${escapeHtml(f.title)}</h3>
            <p>${escapeHtml(f.body)}</p>
          </li>`
    )
    .join("");

  return `
    <section class="features" id="features" aria-labelledby="features-heading">
      <div class="container">
        <header class="section-header">
          <p class="section-eyebrow">Why Choose Us</p>
          <h2 id="features-heading" class="section-title">
            Everything you need to <span class="gradient-text">level up</span>
          </h2>
        </header>
        <ul class="features-grid" role="list">${cards}
        </ul>
      </div>
    </section>`;
}

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  { quote: "Scaler's structured DSA curriculum and mock interviews were exactly what I needed. I went from a 6 LPA job to an Amazon SDE-2 offer at 32 LPA in under 8 months.", name: "Priya Sharma", role: "SDE-2 at Amazon · Batch of 2023", badge: "32 LPA" },
  { quote: "The 1-on-1 mentor sessions changed my approach to problem-solving entirely. I cleared Google's interview loop on my first attempt and doubled my salary.", name: "Arjun Menon", role: "Software Engineer at Google · Batch of 2024", badge: "45 LPA" },
  { quote: "I was a non-CS graduate stuck in a non-tech role. Scaler's program gave me the foundation, confidence, and connections to break into backend engineering.", name: "Sneha Patel", role: "Backend Engineer at Razorpay · Batch of 2023", badge: "28 LPA" },
];

const AVATAR_COLORS = ["ff7a18", "6366F1", "22C55E", "EC4899", "0EA5E9", "F59E0B"];

function buildTestimonials(testimonials?: TestimonialItem[]): string {
  const items = testimonials && testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS;
  const cards = items
    .map(
      (t, i) => `
          <li class="testimonial-card">
            <blockquote>
              <p>${escapeHtml(t.quote)}</p>
            </blockquote>
            <footer class="testimonial-author">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=${AVATAR_COLORS[i % AVATAR_COLORS.length]}&color=fff&size=48" alt="${escapeHtml(t.name)}" width="48" height="48" class="avatar">
              <div>
                <strong>${escapeHtml(t.name)}</strong>
                <span>${escapeHtml(t.role)}</span>
              </div>
              ${t.badge ? `<span class="salary-badge">${escapeHtml(t.badge)}</span>` : ""}
            </footer>
          </li>`
    )
    .join("");

  return `
    <section class="testimonials" id="testimonials" aria-labelledby="testimonials-heading">
      <div class="container">
        <header class="section-header">
          <p class="section-eyebrow">Success Stories</p>
          <h2 id="testimonials-heading" class="section-title">
            Real people. <span class="gradient-text">Real results.</span>
          </h2>
        </header>
        <ul class="testimonials-grid" role="list">${cards}
        </ul>
      </div>
    </section>`;
}

function buildCta(cta?: CtaData): string {
  const headline = cta?.headline ?? "Ready to transform your career?";
  const sub = cta?.sub ?? "Join 1,00,000+ engineers who chose us to reach their full potential.";
  const buttonText = cta?.buttonText ?? "Start Your Journey →";

  return `
    <section class="cta-banner" aria-labelledby="cta-heading">
      <div class="container cta-inner">
        <div>
          <h2 id="cta-heading">${escapeHtml(headline)}</h2>
          <p>${escapeHtml(sub)}</p>
        </div>
        <a href="/apply" class="btn btn-white btn-lg">${escapeHtml(buttonText)}</a>
      </div>
    </section>`;
}

const DEFAULT_FOOTER_COLUMNS = [
  { heading: "Programs", links: ["Software Engineering", "Data Science & ML", "System Design", "DSA Bootcamp"] },
  { heading: "Company", links: ["About Us", "Careers", "Blog", "Press"] },
  { heading: "Support", links: ["FAQ", "Contact Us", "Privacy Policy", "Terms of Service"] },
];

function buildFooter(footer?: FooterData): string {
  const brand = footer?.brandName ?? "Scaler";
  const tagline = footer?.tagline ?? "Shaping the next generation of software engineers with world-class education and mentorship.";
  const columns = footer?.columns && footer.columns.length > 0 ? footer.columns : DEFAULT_FOOTER_COLUMNS;

  const colsHTML = columns
    .map(
      (col) => `
        <div class="footer-col">
          <h3>${escapeHtml(col.heading)}</h3>
          <ul role="list">
            ${col.links.map((l) => `<li><a href="#">${escapeHtml(l)}</a></li>`).join("\n            ")}
          </ul>
        </div>`
    )
    .join("");

  return `
  <footer class="footer" role="contentinfo">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a href="/" class="logo" aria-label="${escapeHtml(brand)} home">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#FF6B35"/>
            <path d="M8 16L16 8L24 16L16 24L8 16Z" fill="white"/>
          </svg>
          <span class="logo-text">${escapeHtml(brand)}</span>
        </a>
        <p>${escapeHtml(tagline)}</p>
        <ul class="social-links" role="list" aria-label="Social media">
          <li><a href="#" aria-label="Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a></li>
          <li><a href="#" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a></li>
        </ul>
      </div>
      <nav class="footer-links" aria-label="Footer navigation">
        ${colsHTML}
      </nav>
    </div>
    <div class="footer-bottom">
      <div class="container">
        <p>&copy; <time id="footer-year">${new Date().getFullYear()}</time> ${escapeHtml(brand)}. All rights reserved.</p>
        <p>Made with ♥</p>
      </div>
    </div>
  </footer>`;
}

// ─── page assembly ────────────────────────────────────────────────────────────

const SECTION_BUILDERS: Record<string, (hints: LayoutHints, pd?: PageData) => string> = {
  header: (_h, pd) => buildHeader(pd?.nav),
  hero:   (h,  pd) => buildHero(h, pd?.hero),
  stats:  (_h, pd) => buildStats(pd?.stats),
  features:     (_h, pd) => buildFeatures(pd?.features),
  testimonials: (_h, pd) => buildTestimonials(pd?.testimonials),
  cta:    (_h, pd) => buildCta(pd?.cta),
  footer: (_h, pd) => buildFooter(pd?.footer),
};

const DEFAULT_SECTIONS = ["header", "hero", "stats", "features", "testimonials", "cta", "footer"];

function buildPage(
  title: string,
  cssFile: string,
  jsFile: string,
  layout: string,
  theme: string,
  sections: string[],
  pageData?: PageData,
): string {
  const hints = parseLayout(layout);
  const themeVars = getThemeVars(theme);

  const mainSections = sections.filter((s) => s !== "header" && s !== "footer");
  const hasHeader = sections.includes("header");
  const hasFooter = sections.includes("footer");

  const mainHTML = mainSections
    .map((s) => (SECTION_BUILDERS[s] ? SECTION_BUILDERS[s]!(hints, pageData) : ""))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>:root{${themeVars}}</style>
  <link rel="stylesheet" href="${cssFile}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&display=swap" rel="stylesheet">
  <script src="${jsFile}" defer></script>
</head>
<body>

${hasHeader ? buildHeader(pageData?.nav) : ""}

  <main>
${mainHTML}
  </main>

${hasFooter ? buildFooter(pageData?.footer) : ""}

</body>
</html>`;
}

// ─── tool export ──────────────────────────────────────────────────────────────

export const generateHTMLTool: Tool = {
  name: "generateHTML",
  description:
    "Generate a complete landing page. Accepts layout, theme, sections, and pageData (nav, hero, stats, features, testimonials, cta, footer content extracted from a reference image) to produce a true clone rather than a generic template.",
  inputSchema: {
    filename: { type: "string", description: "Output filename, e.g. index.html", required: true },
    title:    { type: "string", description: "Document <title>. Defaults to brand name from pageData.nav or 'Landing Page'." },
    cssFile:  { type: "string", description: "Relative path to CSS file. Defaults to 'styles.css'." },
    jsFile:   { type: "string", description: "Relative path to JS file. Defaults to 'script.js'." },
    layout:   { type: "string", description: "Space-separated tokens: hero-left-text, hero-centered, right-card, right-image, right-none." },
    theme:    { type: "string", description: "'orange' (default), 'dark', or 'light'." },
    sections: { type: "array",  description: "Ordered sections to render: header, hero, stats, features, testimonials, cta, footer." },
    pageData: { type: "object", description: "Extracted page content: { nav, hero, stats[], features[], testimonials[], cta, footer }. All fields optional with sensible defaults." },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isGenerateHTMLInput(raw)) {
      return { success: false, error: "Missing required field: filename" };
    }

    const input = raw as GenerateHTMLInput;
    const pageData = input.pageData;
    const title = input.title || pageData?.nav?.brandName || "Landing Page";
    const cssFile = input.cssFile || "styles.css";
    const jsFile = input.jsFile || "script.js";
    const layout = input.layout || "hero-left-text right-card";
    const theme = input.theme || "orange";
    const sections =
      Array.isArray(input.sections) && input.sections.length > 0
        ? input.sections
        : DEFAULT_SECTIONS;

    const html = buildPage(title, cssFile, jsFile, layout, theme, sections, pageData);
    return writeFileTool.execute({ filePath: input.filename, content: html });
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
