import { type Tool, type ToolInput, type ToolResult } from "./registry.js";
import { writeFileTool } from "./writeFile.js";

interface GenerateHTMLInput {
  filename: string;
  title?: string;
  cssFile?: string;
  jsFile?: string;
}

function isGenerateHTMLInput(input: unknown): input is GenerateHTMLInput {
  if (typeof input !== "object" || input === null) return false;
  const i = input as Record<string, unknown>;
  return typeof i["filename"] === "string";
}

function buildLandingPage(title: string, cssFile: string, jsFile: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${cssFile}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="${jsFile}" defer></script>
</head>
<body>

  <!-- ===== HEADER ===== -->
  <header class="header" role="banner">
    <nav class="nav container" aria-label="Main navigation">
      <a href="/" class="logo" aria-label="Scaler home">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#FF6B35"/>
          <path d="M8 16L16 8L24 16L16 24L8 16Z" fill="white"/>
        </svg>
        <span class="logo-text">Scaler</span>
      </a>

      <ul class="nav-links" role="list">
        <li><a href="#courses">Courses</a></li>
        <li><a href="#features">Why Scaler</a></li>
        <li><a href="#testimonials">Success Stories</a></li>
        <li><a href="#stats">Outcomes</a></li>
      </ul>

      <div class="nav-actions">
        <a href="/login" class="btn btn-ghost">Log in</a>
        <a href="/apply" class="btn btn-primary">Apply Now</a>
      </div>

      <button class="hamburger" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span><span></span>
      </button>
    </nav>

    <div id="mobile-menu" class="mobile-menu" hidden>
      <ul role="list">
        <li><a href="#courses">Courses</a></li>
        <li><a href="#features">Why Scaler</a></li>
        <li><a href="#testimonials">Success Stories</a></li>
        <li><a href="#stats">Outcomes</a></li>
        <li><a href="/apply" class="btn btn-primary">Apply Now</a></li>
      </ul>
    </div>
  </header>

  <main>

    <!-- ===== HERO ===== -->
    <section class="hero" aria-labelledby="hero-heading">
      <div class="container hero-inner">
        <div class="hero-content">
          <p class="hero-eyebrow">Trusted by 1,00,000+ learners</p>
          <h1 id="hero-heading" class="hero-heading">
            Advance Your Tech Career with
            <span class="gradient-text">Industry-Led Mentorship</span>
          </h1>
          <p class="hero-subtext">
            Master software engineering, system design, and DSA through live classes,
            real projects, and 1-on-1 mentoring from top engineers at FAANG companies.
          </p>
          <div class="hero-actions">
            <a href="/apply" class="btn btn-primary btn-lg">Get Free Career Counselling</a>
            <a href="#courses" class="btn btn-outline btn-lg">Explore Programs</a>
          </div>
          <p class="hero-note">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="#22C55E" stroke-width="1.5"/>
              <path d="M5 8L7 10L11 6" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            No upfront payment · 100% refund guarantee
          </p>
        </div>

        <figure class="hero-image" aria-hidden="true">
          <div class="hero-card hero-card--main">
            <div class="code-window">
              <div class="code-window-bar">
                <span class="dot dot--red"></span>
                <span class="dot dot--yellow"></span>
                <span class="dot dot--green"></span>
              </div>
              <pre class="code-snippet"><code><span class="kw">function</span> <span class="fn">twoSum</span>(nums, target) {
  <span class="kw">const</span> map = <span class="kw">new</span> Map();
  <span class="kw">for</span> (<span class="kw">let</span> i = <span class="num">0</span>; i &lt; nums.length; i++) {
    <span class="kw">const</span> comp = target - nums[i];
    <span class="kw">if</span> (map.has(comp))
      <span class="kw">return</span> [map.get(comp), i];
    map.set(nums[i], i);
  }
}</code></pre>
            </div>
          </div>

          <div class="hero-card hero-card--badge hero-card--offer">
            <span class="badge-icon">🎯</span>
            <div>
              <strong>Amazon offer</strong>
              <span>₹42 LPA · Placed in 6 months</span>
            </div>
          </div>

          <div class="hero-card hero-card--badge hero-card--mentor">
            <img src="https://ui-avatars.com/api/?name=Rahul+Gupta&background=FF6B35&color=fff&size=40" alt="Mentor Rahul Gupta" width="40" height="40" class="avatar">
            <div>
              <strong>Rahul Gupta</strong>
              <span>Ex-Google · Mentor</span>
            </div>
          </div>
        </figure>
      </div>
    </section>

    <!-- ===== STATS ===== -->
    <section class="stats" id="stats" aria-labelledby="stats-heading">
      <div class="container">
        <h2 id="stats-heading" class="sr-only">Platform Outcomes</h2>
        <ul class="stats-grid" role="list">
          <li class="stat-item">
            <span class="stat-number" data-target="700">0</span><span class="stat-suffix">+</span>
            <span class="stat-label">Hiring Partners</span>
          </li>
          <li class="stat-item">
            <span class="stat-number" data-target="50">0</span><span class="stat-suffix">%</span>
            <span class="stat-label">Average Salary Hike</span>
          </li>
          <li class="stat-item">
            <span class="stat-number" data-target="1">0</span><span class="stat-suffix">L+</span>
            <span class="stat-label">Alumni Placed</span>
          </li>
          <li class="stat-item">
            <span class="stat-number" data-target="4.8">0</span><span class="stat-suffix">/5</span>
            <span class="stat-label">Average Rating</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ===== FEATURES ===== -->
    <section class="features" id="features" aria-labelledby="features-heading">
      <div class="container">
        <header class="section-header">
          <p class="section-eyebrow">Why Scaler</p>
          <h2 id="features-heading" class="section-title">
            Everything you need to <span class="gradient-text">level up</span>
          </h2>
          <p class="section-subtitle">
            We combine world-class curriculum with personalised mentoring to
            get you hired at the company of your dreams.
          </p>
        </header>

        <ul class="features-grid" role="list">
          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M4 14L14 4L24 14V24H18V18H10V24H4V14Z" fill="#FF6B35" opacity=".15"/>
                <path d="M4 14L14 4L24 14V24H18V18H10V24H4V14Z" stroke="#FF6B35" stroke-width="1.8" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3>Live Interactive Classes</h3>
            <p>200+ hours of live sessions led by senior engineers. Ask questions in real time, not async.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="10" fill="#6366F1" opacity=".15"/>
                <circle cx="14" cy="14" r="10" stroke="#6366F1" stroke-width="1.8"/>
                <path d="M14 9v5l3 3" stroke="#6366F1" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <h3>1-on-1 Mentorship</h3>
            <p>Weekly sessions with a dedicated mentor from Google, Meta, or Amazon who has been in your shoes.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="8" width="20" height="14" rx="2" fill="#22C55E" opacity=".15"/>
                <rect x="4" y="8" width="20" height="14" rx="2" stroke="#22C55E" stroke-width="1.8"/>
                <path d="M10 14h8M10 18h5" stroke="#22C55E" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <h3>Real-World Projects</h3>
            <p>Build production-grade projects — distributed systems, scalable APIs, and data pipelines — for your portfolio.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 4L17.5 11L25 12L19.5 17.5L21 25L14 21.5L7 25L8.5 17.5L3 12L10.5 11L14 4Z" fill="#F59E0B" opacity=".15" stroke="#F59E0B" stroke-width="1.8" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3>Career Support</h3>
            <p>Resume reviews, mock interviews, LinkedIn optimisation, and referrals to 700+ hiring partners.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 22V14a8 8 0 1116 0v8" stroke="#EC4899" stroke-width="1.8" stroke-linecap="round"/>
                <rect x="4" y="18" width="6" height="6" rx="1" fill="#EC4899" opacity=".15" stroke="#EC4899" stroke-width="1.8"/>
                <rect x="18" y="18" width="6" height="6" rx="1" fill="#EC4899" opacity=".15" stroke="#EC4899" stroke-width="1.8"/>
              </svg>
            </div>
            <h3>Expert Community</h3>
            <p>Peer learning circles, alumni Slack workspace, and exclusive events with industry leaders.</p>
          </li>

          <li class="feature-card">
            <div class="feature-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 4v20M4 14h20" stroke="#0EA5E9" stroke-width="1.8" stroke-linecap="round"/>
                <circle cx="14" cy="14" r="4" fill="#0EA5E9" opacity=".15" stroke="#0EA5E9" stroke-width="1.8"/>
              </svg>
            </div>
            <h3>Structured DSA + System Design</h3>
            <p>A proven 6-month roadmap covering every topic asked in FAANG interviews — from arrays to distributed systems.</p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ===== TESTIMONIALS ===== -->
    <section class="testimonials" id="testimonials" aria-labelledby="testimonials-heading">
      <div class="container">
        <header class="section-header">
          <p class="section-eyebrow">Success Stories</p>
          <h2 id="testimonials-heading" class="section-title">
            Real people. <span class="gradient-text">Real results.</span>
          </h2>
        </header>

        <ul class="testimonials-grid" role="list">
          <li class="testimonial-card">
            <blockquote>
              <p>"Scaler's structured DSA curriculum and mock interviews were exactly what I needed. I went from a 6 LPA job to an Amazon SDE-2 offer at 32 LPA in under 8 months."</p>
            </blockquote>
            <footer class="testimonial-author">
              <img src="https://ui-avatars.com/api/?name=Priya+Sharma&background=FF6B35&color=fff&size=48" alt="Priya Sharma" width="48" height="48" class="avatar">
              <div>
                <strong>Priya Sharma</strong>
                <span>SDE-2 at Amazon · Batch of 2023</span>
              </div>
              <span class="salary-badge">32 LPA</span>
            </footer>
          </li>

          <li class="testimonial-card">
            <blockquote>
              <p>"The 1-on-1 mentor sessions changed my approach to problem-solving entirely. I cleared Google's interview loop on my first attempt and doubled my salary."</p>
            </blockquote>
            <footer class="testimonial-author">
              <img src="https://ui-avatars.com/api/?name=Arjun+Menon&background=6366F1&color=fff&size=48" alt="Arjun Menon" width="48" height="48" class="avatar">
              <div>
                <strong>Arjun Menon</strong>
                <span>Software Engineer at Google · Batch of 2024</span>
              </div>
              <span class="salary-badge">45 LPA</span>
            </footer>
          </li>

          <li class="testimonial-card">
            <blockquote>
              <p>"I was a non-CS graduate stuck in a non-tech role. Scaler's program gave me the foundation, confidence, and connections to break into backend engineering at a unicorn startup."</p>
            </blockquote>
            <footer class="testimonial-author">
              <img src="https://ui-avatars.com/api/?name=Sneha+Patel&background=22C55E&color=fff&size=48" alt="Sneha Patel" width="48" height="48" class="avatar">
              <div>
                <strong>Sneha Patel</strong>
                <span>Backend Engineer at Razorpay · Batch of 2023</span>
              </div>
              <span class="salary-badge">28 LPA</span>
            </footer>
          </li>
        </ul>
      </div>
    </section>

    <!-- ===== CTA BANNER ===== -->
    <section class="cta-banner" aria-labelledby="cta-heading">
      <div class="container cta-inner">
        <div>
          <h2 id="cta-heading">Ready to transform your career?</h2>
          <p>Join 1,00,000+ engineers who chose Scaler to reach their full potential.</p>
        </div>
        <a href="/apply" class="btn btn-white btn-lg">Start Your Journey →</a>
      </div>
    </section>

  </main>

  <!-- ===== FOOTER ===== -->
  <footer class="footer" role="contentinfo">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a href="/" class="logo" aria-label="Scaler home">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#FF6B35"/>
            <path d="M8 16L16 8L24 16L16 24L8 16Z" fill="white"/>
          </svg>
          <span class="logo-text">Scaler</span>
        </a>
        <p>Shaping the next generation of software engineers with world-class education and mentorship.</p>
        <ul class="social-links" role="list" aria-label="Social media">
          <li><a href="#" aria-label="Twitter">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a></li>
          <li><a href="#" aria-label="LinkedIn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a></li>
          <li><a href="#" aria-label="YouTube">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a></li>
        </ul>
      </div>

      <nav class="footer-links" aria-label="Footer navigation">
        <div class="footer-col">
          <h3>Programs</h3>
          <ul role="list">
            <li><a href="#courses">Software Engineering</a></li>
            <li><a href="#courses">Data Science &amp; ML</a></li>
            <li><a href="#courses">System Design</a></li>
            <li><a href="#courses">DSA Bootcamp</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Company</h3>
          <ul role="list">
            <li><a href="/about">About Us</a></li>
            <li><a href="/careers">Careers</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/press">Press</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Support</h3>
          <ul role="list">
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/contact">Contact Us</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
          </ul>
        </div>
      </nav>
    </div>

    <div class="footer-bottom">
      <div class="container">
        <p>&copy; <time id="footer-year">2024</time> Scaler Academy. All rights reserved.</p>
        <p>Made with ♥ for ambitious engineers.</p>
      </div>
    </div>
  </footer>

</body>
</html>`;
}

export const generateHTMLTool: Tool = {
  name: "generateHTML",
  description:
    "Generate a complete, production-quality Scaler Academy-style landing page (header, hero, stats, features, testimonials, footer) and write it to the output directory. Returns only the HTML string.",
  inputSchema: {
    filename: {
      type: "string",
      description: "Output filename, e.g. index.html",
      required: true,
    },
    title: {
      type: "string",
      description: "The <title> of the HTML document. Defaults to 'Scaler Academy'.",
    },
    cssFile: {
      type: "string",
      description: "Relative path to the CSS file. Defaults to 'styles.css'.",
    },
    jsFile: {
      type: "string",
      description: "Relative path to the JS file. Defaults to 'script.js'.",
    },
  },

  async execute(raw: ToolInput): Promise<ToolResult> {
    if (!isGenerateHTMLInput(raw)) {
      return { success: false, error: "Missing required field: filename" };
    }

    const input = raw as GenerateHTMLInput;
    const title = typeof input.title === "string" && input.title ? input.title : "Scaler Academy";
    const cssFile = typeof input.cssFile === "string" && input.cssFile ? input.cssFile : "styles.css";
    const jsFile = typeof input.jsFile === "string" && input.jsFile ? input.jsFile : "script.js";

    const html = buildLandingPage(title, cssFile, jsFile);
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
