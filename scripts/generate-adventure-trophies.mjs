import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const login = process.env.GITHUB_REPOSITORY_OWNER;

if (!token || !login) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY_OWNER are required");
}

const currentYear = new Date().getUTCFullYear();
const accountQuery = `
  query ProfileTrophies($login: String!) {
    user(login: $login) {
      createdAt
    }
  }
`;

async function request(query) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Dcastroro-profile-trophies",
    },
    body: JSON.stringify({ query, variables: { login } }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(JSON.stringify(payload.errors ?? payload));
  }

  return payload.data.user;
}

const account = await request(accountQuery);
const joinedYear = new Date(account.createdAt).getUTCFullYear();
const yearlyFields = Array.from(
  { length: currentYear - joinedYear + 1 },
  (_, index) => joinedYear + index,
)
  .map(
    (year) => `
      y${year}: contributionsCollection(
        from: "${year}-01-01T00:00:00Z"
        to: "${year}-12-31T23:59:59Z"
      ) {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
      }
    `,
  )
  .join("\n");

const stats = await request(`
  query ProfileTrophies($login: String!) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
      ${yearlyFields}
    }
  }
`);

const yearlyStats = Object.entries(stats)
  .filter(([key]) => /^y\d{4}$/.test(key))
  .map(([, value]) => value);

const totals = yearlyStats.reduce(
  (sum, year) => ({
    commits: sum.commits + year.totalCommitContributions,
    pullRequests: sum.pullRequests + year.totalPullRequestContributions,
    reviews: sum.reviews + year.totalPullRequestReviewContributions,
  }),
  { commits: 0, pullRequests: 0, reviews: 0 },
);

const languageTotals = new Map();
for (const repository of stats.repositories.nodes) {
  for (const { size, node } of repository.languages.edges) {
    const current = languageTotals.get(node.name) ?? {
      name: node.name,
      color: node.color ?? "#72e8dc",
      size: 0,
    };
    current.size += size;
    languageTotals.set(node.name, current);
  }
}

const topLanguages = [...languageTotals.values()]
  .sort((a, b) => b.size - a.size)
  .slice(0, 5);
const totalLanguageSize = topLanguages.reduce(
  (sum, language) => sum + language.size,
  0,
);

const experience = Math.max(
  1,
  Math.floor(
    (Date.now() - new Date(account.createdAt).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  ),
);

function tierFor(value, thresholds) {
  return thresholds.find((tier) => value >= tier.min);
}

const celestial = { rank: "S+", name: "CELESTIAL", color: "#fff0a6" };
const mythic = { rank: "S", name: "MYTHIC", color: "#d69cff" };
const legendary = { rank: "A+", name: "LEGENDARY", color: "#72e8dc" };
const arcane = { rank: "A", name: "ARCANE", color: "#75a7ff" };
const awakened = { rank: "B", name: "AWAKENED", color: "#a8bed1" };
const dormant = { rank: "—", name: "UNCHARTED", color: "#8fa3b8" };

function tierSymbol(name) {
  const symbols = {
    CELESTIAL: `
      <path d="M0-24 L5-7 L22-11 L9 2 L22 14 L5 9 L0 26 L-5 9 L-22 14 L-9 2 L-22-11 L-5-7Z" fill="currentColor" opacity=".95"/>
      <circle r="7" fill="#fff8cf" stroke="currentColor" stroke-width="2"/>
      <circle r="25" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 5"/>
    `,
    MYTHIC: `
      <path d="M0-24 L17-9 L11 15 L0 25 L-11 15 L-17-9Z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="2"/>
      <path d="M0-24 L0 25 M-17-9 L17-9 M-11 15 L0-9 L11 15" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M-23-2 L-30 4 L-22 8 M23-2 L30 4 L22 8" fill="none" stroke="currentColor" stroke-width="2"/>
    `,
    LEGENDARY: `
      <path d="M-21 12 L-17-14 L-6-3 L0-21 L7-3 L18-14 L21 12Z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="2"/>
      <path d="M-19 13 Q0 24 19 13 M-25-5 Q-34 2-24 12 M25-5 Q34 2 24 12" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cy="4" r="5" fill="currentColor"/>
    `,
    ARCANE: `
      <path d="M0-24 L21-12 L21 12 L0 24 L-21 12 L-21-12Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M0-15 L12 13 L0 7 L-12 13Z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="2"/>
      <circle r="4" fill="currentColor"/>
    `,
    AWAKENED: `
      <path d="M2-25 C17-10 18 0 10 14 C5 23-8 24-15 14 C-22 3-13-8-4-13 C-6-3-1 1 4 0 C8-2 8-10 2-25Z" fill="currentColor" fill-opacity=".3" stroke="currentColor" stroke-width="2"/>
      <path d="M1-5 C8 3 6 14 0 17 C-7 12-8 4 1-5Z" fill="currentColor"/>
    `,
    DORMANT: `
      <path d="M9-22 A25 25 0 1 0 20 16 A20 20 0 1 1 9-22Z" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="2"/>
      <path d="M-19 17 L-13 11 M18-18 L23-23 M-22-5 L-28-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `,
  };

  return symbols[name].replace(/[ \t]+$/gm, "").trim();
}

function trophySymbol(title, tierName) {
  if (title === "REPOSITORIES") {
    return `
      <path d="M-22 17V-7L0-23 22-7v24H8V3H-8v14Z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="2"/>
      <path d="M-15-12v-10h8v5M7-17v-5h8v10M-25-5 0-27 25-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-4 17V7h8v10M-14-2h7M7-2h7" fill="none" stroke="currentColor" stroke-width="2"/>
    `.replace(/[ \t]+$/gm, "").trim();
  }

  if (title === "REVIEWS") {
    return `
      <path d="M0-24V20M-18-14H18M-18-14-28 5M-18-14-8 5M18-14 8 5M18-14 28 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M-30 5H-6c-2 9-20 9-24 0ZM6 5h24c-4 9-22 9-24 0Z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="2"/>
      <path d="M-12 22H12M-7 17H7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    `.replace(/[ \t]+$/gm, "").trim();
  }

  return tierSymbol(tierName);
}

const trophies = [
  {
    title: "EXPERIENCE",
    value: `${experience} YEARS`,
    subtitle: `Journey began ${joinedYear}`,
    x: 112,
    y: 145,
    tier: tierFor(experience, [
      { min: 3, ...celestial },
      { min: 2, ...mythic },
      { min: 1, ...legendary },
    ]),
  },
  {
    title: "COMMITS",
    value: totals.commits.toLocaleString("en-US"),
    subtitle: "Runes forged",
    x: 306,
    y: 295,
    tier: tierFor(totals.commits, [
      { min: 500, ...celestial },
      { min: 100, ...mythic },
      { min: 50, ...legendary },
      { min: 10, ...arcane },
      { min: 0, ...awakened },
    ]),
  },
  {
    title: "PULL REQUESTS",
    value: totals.pullRequests.toLocaleString("en-US"),
    subtitle: "Bridges opened",
    x: 500,
    y: 145,
    tier: tierFor(totals.pullRequests, [
      { min: 50, ...celestial },
      { min: 15, ...mythic },
      { min: 10, ...legendary },
      { min: 5, ...arcane },
      { min: 0, ...awakened },
    ]),
  },
  {
    title: "REPOSITORIES",
    value: stats.repositories.totalCount.toLocaleString("en-US"),
    subtitle:
      stats.repositories.totalCount < 10
        ? `${10 - stats.repositories.totalCount} to Mythic`
        : "Realms shipped",
    x: 694,
    y: 295,
    tier: tierFor(stats.repositories.totalCount, [
      { min: 20, ...celestial },
      { min: 10, ...mythic },
      { min: 5, ...legendary },
      { min: 2, ...arcane },
      { min: 0, ...awakened },
    ]),
  },
  {
    title: "REVIEWS",
    value: totals.reviews.toLocaleString("en-US"),
    subtitle:
      totals.reviews === 0
        ? "1 unlocks Arcane"
        : "Council verdicts",
    x: 888,
    y: 145,
    tier: tierFor(totals.reviews, [
      { min: 50, ...celestial },
      { min: 20, ...mythic },
      { min: 10, ...legendary },
      { min: 1, ...arcane },
      { min: 0, ...dormant },
    ]),
  },
];

const trophyMarkup = trophies
  .map(
    ({ title, value, subtitle, x, y, tier }, index) => `
      <g transform="translate(${x} ${y})">
      <g class="trophy" style="--delay:${index * 50}ms">
        <circle r="78" fill="url(#medallion)" stroke="${tier.color}" stroke-width="3"/>
        <circle r="68" fill="none" stroke="${tier.color}" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="3 5"/>
        <path d="M-35 65 L-22 90 L0 76 L22 90 L35 65" fill="#5f234a" stroke="${tier.color}" stroke-width="2"/>
        <g filter="url(#glow)" stroke="${tier.color}" fill="none">
          <path d="M0-52 L6-34 L24-42 L17-24 L36-18 L18-10" opacity=".75"/>
          <path d="M0-52 L-6-34 L-24-42 L-17-24 L-36-18 L-18-10" opacity=".75"/>
        </g>
        <circle cy="-17" r="30" fill="#11233f" stroke="${tier.color}" stroke-width="2.5"/>
        <g transform="translate(0 -17)">
        <g class="sigil" style="color:${tier.color}" filter="url(#glow)">
          ${trophySymbol(title, tier.name)}
        </g>
        </g>
        <circle cx="25" cy="1" r="13" fill="${tier.color}" stroke="#0b1020" stroke-width="2"/>
        <text x="25" y="5" class="rank-badge">${tier.rank}</text>
        <text y="-56" class="title">${title}</text>
        <text y="34" class="value">${value}</text>
        <text y="54" class="subtitle">${subtitle}</text>
        <rect x="-43" y="60" width="86" height="18" rx="9" fill="#0b1020" stroke="${tier.color}" stroke-opacity=".8"/>
        <text y="72" class="tier-name" fill="${tier.color}">${tier.name}</text>
      </g>
      </g>
    `,
  )
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420" role="img" aria-labelledby="title desc">
  <title id="title">Dcastroro's live adventure trophies</title>
  <desc id="desc">An epic fantasy map with live GitHub achievements for experience, commits, pull requests, repositories and reviews.</desc>
  <defs>
    <linearGradient id="night" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#071321"/>
      <stop offset=".52" stop-color="#102a3b"/>
      <stop offset="1" stop-color="#171328"/>
    </linearGradient>
    <radialGradient id="medallion">
      <stop stop-color="#263653"/>
      <stop offset=".72" stop-color="#151b31"/>
      <stop offset="1" stop-color="#0b1020"/>
    </radialGradient>
    <linearGradient id="road" x1="0" x2="1">
      <stop stop-color="#e6ba62"/>
      <stop offset=".5" stop-color="#fff0a6"/>
      <stop offset="1" stop-color="#c98a38"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="stars" width="80" height="80" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="18" r="1" fill="#d9f8ff" opacity=".55"/>
      <circle cx="58" cy="49" r=".8" fill="#fff0a6" opacity=".45"/>
    </pattern>
  </defs>
  <style>
    text { font-family: Georgia, "Times New Roman", serif; text-anchor: middle; }
    .title { fill:#ffcf70; font-size:13px; font-weight:700; letter-spacing:1.3px; }
    .value { fill:#f8f1d4; font-size:24px; font-weight:700; }
    .subtitle { fill:#71d7cd; font-size:11px; font-style:italic; }
    .rank-badge { fill:#0b1020; font-family:"Segoe UI",sans-serif; font-size:11px; font-weight:900; }
    .tier-name { font-size:10px; font-weight:700; letter-spacing:1.2px; }
    .trophy {
      animation:trophy-enter 550ms cubic-bezier(.23,1,.32,1) both var(--delay);
      transform-box:fill-box;
      transform-origin:center;
    }
    .sigil {
      animation:sigil-breathe 3.6s cubic-bezier(.77,0,.175,1) infinite alternate;
      animation-delay:var(--delay);
      transform-box:fill-box;
      transform-origin:center;
    }
    .twinkle-a { animation:twinkle 2.7s ease infinite alternate; }
    .twinkle-b { animation:twinkle 3.4s ease 800ms infinite alternate-reverse; }
    .road { stroke-dasharray:12 9; }
    @keyframes trophy-enter {
      from { opacity:0; transform:translateY(8px) scale(.96); }
      to { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes trophy-fade {
      from { opacity:.6; }
      to { opacity:1; }
    }
    @keyframes sigil-breathe {
      from { opacity:.72; transform:scale(.97); }
      to { opacity:1; transform:scale(1.035); }
    }
    @keyframes twinkle {
      from { opacity:.2; }
      to { opacity:.9; }
    }
    @media (prefers-reduced-motion:reduce) {
      .trophy { animation:trophy-fade 200ms ease both; }
      .sigil,.twinkle-a,.twinkle-b {
        animation:twinkle 3s ease infinite alternate;
        transform:none;
      }
      .route-scout { display:none; }
    }
  </style>
  <rect x="2" y="2" width="996" height="416" rx="18" fill="url(#night)" stroke="#d8ad58" stroke-width="3"/>
  <rect x="12" y="12" width="976" height="396" rx="13" fill="url(#stars)" stroke="#74552d"/>
  <path d="M25 344 Q120 280 194 348 T390 335 T585 345 T780 337 T975 346" fill="none" stroke="#173f4f" stroke-width="70" opacity=".65"/>
  <path d="M112 145 C195 180 220 265 306 295 S420 180 500 145 S610 260 694 295 S790 185 888 145" fill="none" stroke="#4b311e" stroke-width="10" opacity=".9"/>
  <path class="road" d="M112 145 C195 180 220 265 306 295 S420 180 500 145 S610 260 694 295 S790 185 888 145" fill="none" stroke="url(#road)" stroke-width="4" filter="url(#glow)"/>
  <g class="route-scout" filter="url(#glow)">
    <circle cx="112" cy="145" r="4" fill="#fff8cf">
      <animateMotion dur="8s" repeatCount="indefinite" path="M0 0 C83 35 108 120 194 150 S308 35 388 0 S498 115 582 150 S678 40 776 0"/>
    </circle>
  </g>
  <g fill="#fff8cf" filter="url(#glow)">
    <circle class="twinkle-a" cx="198" cy="92" r="2"/>
    <circle class="twinkle-b" cx="600" cy="84" r="1.8"/>
    <circle class="twinkle-a" cx="814" cy="245" r="1.5"/>
  </g>
  <path d="M20 390 L80 322 L125 372 L174 305 L230 390Z" fill="#0a1824" stroke="#29475a"/>
  <path d="M770 390 L820 315 L855 360 L912 292 L980 390Z" fill="#0a1824" stroke="#29475a"/>
  <text x="500" y="35" fill="#f8f1d4" font-size="21" font-weight="700" letter-spacing="3">THE ACHIEVEMENT REALM</text>
  <text x="500" y="57" fill="#9bc9c6" font-size="12" font-style="italic">A live chronicle of the developer's journey</text>
  ${trophyMarkup}
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/adventure-trophies.svg", svg);

const languageMarkup = topLanguages
  .map((language, index) => {
    const percentage =
      totalLanguageSize === 0
        ? 0
        : Math.round((language.size / totalLanguageSize) * 100);
    const width = Math.max(8, Math.round((percentage / 100) * 360));
    const y = 112 + index * 43;

    return `
      <g transform="translate(0 ${y})">
        <text x="78" y="-7" class="language">${language.name}</text>
        <text x="470" y="-7" class="percentage">${percentage}%</text>
        <rect x="78" y="4" width="392" height="12" rx="6" fill="#091522" stroke="#29475a"/>
        <rect class="language-bar" style="--delay:${index * 55}ms" x="78" y="4" width="${width}" height="12" rx="6" fill="${language.color}"/>
      </g>
    `;
  })
  .join("");

const metrics = [
  { label: "COMMITS", value: totals.commits, color: "#d69cff", x: 620, y: 105 },
  {
    label: "PULL REQUESTS",
    value: totals.pullRequests,
    color: "#72e8dc",
    x: 810,
    y: 105,
  },
  {
    label: "REPOSITORIES",
    value: stats.repositories.totalCount,
    color: "#ffcf70",
    x: 620,
    y: 225,
  },
  { label: "REVIEWS", value: totals.reviews, color: "#75a7ff", x: 810, y: 225 },
];

const metricMarkup = metrics
  .map(
    ({ label, value, color, x, y }, index) => `
      <g transform="translate(${x} ${y})">
        <g class="metric" style="--delay:${index * 60}ms">
          <rect width="160" height="90" rx="17" fill="#101b2e" stroke="${color}" stroke-opacity=".75" stroke-width="2"/>
          <circle class="metric-orbit" cx="125" cy="23" r="12" fill="none" stroke="${color}" stroke-dasharray="3 5"/>
          <circle cx="125" cy="11" r="3" fill="${color}" filter="url(#glow)"/>
          <text x="18" y="29" class="metric-label">${label}</text>
          <text x="18" y="67" class="metric-value" fill="${color}">${value.toLocaleString("en-US")}</text>
        </g>
      </g>
    `,
  )
  .join("");

const ledgerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="360" viewBox="0 0 1000 360" role="img" aria-labelledby="title desc">
  <title id="title">Animated engineering signal matrix</title>
  <desc id="desc">A live overview of programming languages, commits, pull requests, repositories and reviews.</desc>
  <defs>
    <linearGradient id="ledger-bg" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#071321"/>
      <stop offset=".48" stop-color="#102a3b"/>
      <stop offset="1" stop-color="#18142a"/>
    </linearGradient>
    <radialGradient id="aura">
      <stop stop-color="#72e8dc" stop-opacity=".24"/>
      <stop offset="1" stop-color="#72e8dc" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="ledger-grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#72e8dc" stroke-opacity=".04"/>
    </pattern>
  </defs>
  <style>
    text { font-family:"Segoe UI",Arial,sans-serif; }
    .language { fill:#dcebef; font-size:13px; font-weight:700; }
    .percentage { fill:#88acb2; font-size:11px; text-anchor:end; }
    .metric-label { fill:#a9c7cb; font-size:10px; font-weight:700; letter-spacing:1px; }
    .metric-value { font-family:Georgia,serif; font-size:29px; font-weight:700; }
    .language-bar {
      animation:bar-enter 700ms cubic-bezier(.23,1,.32,1) both var(--delay);
      transform-box:fill-box;
      transform-origin:left center;
    }
    .metric {
      animation:metric-enter 550ms cubic-bezier(.23,1,.32,1) both var(--delay);
      transform-box:fill-box;
      transform-origin:center;
    }
    .metric-orbit {
      animation:orbit 8s linear infinite;
      transform-box:fill-box;
      transform-origin:center;
    }
    .aura {
      animation:aura-breathe 5s cubic-bezier(.77,0,.175,1) infinite alternate;
      transform-box:fill-box;
      transform-origin:center;
    }
    .spark-a { animation:twinkle 2.8s ease infinite alternate; }
    .spark-b { animation:twinkle 3.7s ease 900ms infinite alternate-reverse; }
    @keyframes bar-enter {
      from { opacity:0; transform:scaleX(.03); }
      to { opacity:1; transform:scaleX(1); }
    }
    @keyframes metric-enter {
      from { opacity:0; transform:translateY(8px) scale(.97); }
      to { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes orbit { to { transform:rotate(360deg); } }
    @keyframes aura-breathe {
      from { opacity:.55; transform:scale(.97); }
      to { opacity:1; transform:scale(1.04); }
    }
    @keyframes twinkle {
      from { opacity:.2; }
      to { opacity:1; }
    }
    @keyframes fade {
      from { opacity:.6; }
      to { opacity:1; }
    }
    @media (prefers-reduced-motion:reduce) {
      .language-bar,.metric {
        animation:fade 200ms ease both;
        transform:none;
      }
      .metric-orbit { animation:none; }
      .aura,.spark-a,.spark-b {
        animation:twinkle 3s ease infinite alternate;
        transform:none;
      }
      .ledger-traveler { display:none; }
    }
  </style>
  <rect x="2" y="2" width="996" height="356" rx="20" fill="url(#ledger-bg)" stroke="#d9a84f" stroke-width="3"/>
  <rect x="13" y="13" width="974" height="334" rx="14" fill="url(#ledger-grid)" stroke="#62492b"/>
  <circle class="aura" cx="805" cy="178" r="178" fill="url(#aura)"/>
  <path d="M544 72 V316" stroke="#29475a" stroke-width="1"/>
  <path id="signal-path" d="M570 300 C620 265 655 315 705 275 S790 215 842 242 S918 194 966 214" fill="none" stroke="#72e8dc" stroke-opacity=".24" stroke-width="2"/>
  <g class="ledger-traveler" filter="url(#glow)">
    <circle cx="570" cy="300" r="4" fill="#fff0a6">
      <animateMotion dur="6.5s" repeatCount="indefinite" path="M0 0 C50-35 85 15 135-25 S220-85 272-58 S348-106 396-86"/>
    </circle>
  </g>
  <text x="54" y="48" fill="#fff7d6" font-family="Georgia,serif" font-size="20" font-weight="700" letter-spacing="2">CODE COMPOSITION</text>
  <text x="54" y="70" fill="#72e8dc" font-size="10" letter-spacing="1.6">LIVE LANGUAGE SIGNALS</text>
  <text x="594" y="48" fill="#fff7d6" font-family="Georgia,serif" font-size="20" font-weight="700" letter-spacing="2">ACTIVITY PULSE</text>
  <text x="594" y="70" fill="#d69cff" font-size="10" letter-spacing="1.6">ENGINEERING TELEMETRY</text>
  ${languageMarkup}
  ${metricMarkup}
  <g fill="#fff8cf" filter="url(#glow)">
    <circle class="spark-a" cx="38" cy="92" r="1.8"/>
    <circle class="spark-b" cx="520" cy="46" r="1.5"/>
    <circle class="spark-a" cx="957" cy="64" r="2"/>
  </g>
</svg>`;

await writeFile("assets/animated-ledger.svg", ledgerSvg);

console.log(
  `Generated profile visuals: ${totals.commits} commits, ${totals.pullRequests} pull requests, ${stats.repositories.totalCount} repositories, ${totals.reviews} reviews`,
);
