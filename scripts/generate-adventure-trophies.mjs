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
      repositories(first: 1, ownerAffiliations: OWNER) {
        totalCount
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

const experience = Math.max(
  1,
  Math.floor(
    (Date.now() - new Date(account.createdAt).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  ),
);

const trophies = [
  {
    title: "EXPERIENCE",
    value: `${experience} YEARS`,
    subtitle: `Journey began ${joinedYear}`,
    x: 112,
    y: 145,
    icon: "✦",
  },
  {
    title: "COMMITS",
    value: totals.commits.toLocaleString("en-US"),
    subtitle: "Runes forged",
    x: 306,
    y: 295,
    icon: "◆",
  },
  {
    title: "PULL REQUESTS",
    value: totals.pullRequests.toLocaleString("en-US"),
    subtitle: "Bridges opened",
    x: 500,
    y: 145,
    icon: "⚔",
  },
  {
    title: "REPOSITORIES",
    value: stats.repositories.totalCount.toLocaleString("en-US"),
    subtitle: "Realms discovered",
    x: 694,
    y: 295,
    icon: "⌂",
  },
  {
    title: "REVIEWS",
    value: totals.reviews.toLocaleString("en-US"),
    subtitle: "Council verdicts",
    x: 888,
    y: 145,
    icon: "✧",
  },
];

const trophyMarkup = trophies
  .map(
    ({ title, value, subtitle, x, y, icon }, index) => `
      <g class="trophy" style="--delay:${index * 0.14}s" transform="translate(${x} ${y})">
        <circle r="78" fill="url(#medallion)" stroke="#d8ad58" stroke-width="3"/>
        <circle r="68" fill="none" stroke="#74552d" stroke-width="1.5" stroke-dasharray="3 5"/>
        <path d="M-35 65 L-22 90 L0 76 L22 90 L35 65" fill="#5f234a" stroke="#d8ad58" stroke-width="2"/>
        <circle cy="-17" r="30" fill="#11233f" stroke="#71d7cd" stroke-width="2"/>
        <text y="-7" class="icon">${icon}</text>
        <text y="-56" class="title">${title}</text>
        <text y="34" class="value">${value}</text>
        <text y="54" class="subtitle">${subtitle}</text>
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
    .icon { fill:#fff0a6; font-size:34px; filter:url(#glow); }
    .trophy { opacity:1; }
    .road { stroke-dasharray:12 9; animation:march 8s linear infinite; }
    @keyframes march { to { stroke-dashoffset:-84; } }
    @media (prefers-reduced-motion:reduce) {
      .road { animation:none; }
    }
  </style>
  <rect x="2" y="2" width="996" height="416" rx="18" fill="url(#night)" stroke="#d8ad58" stroke-width="3"/>
  <rect x="12" y="12" width="976" height="396" rx="13" fill="url(#stars)" stroke="#74552d"/>
  <path d="M25 344 Q120 280 194 348 T390 335 T585 345 T780 337 T975 346" fill="none" stroke="#173f4f" stroke-width="70" opacity=".65"/>
  <path d="M112 145 C195 180 220 265 306 295 S420 180 500 145 S610 260 694 295 S790 185 888 145" fill="none" stroke="#4b311e" stroke-width="10" opacity=".9"/>
  <path class="road" d="M112 145 C195 180 220 265 306 295 S420 180 500 145 S610 260 694 295 S790 185 888 145" fill="none" stroke="url(#road)" stroke-width="4" filter="url(#glow)"/>
  <path d="M20 390 L80 322 L125 372 L174 305 L230 390Z" fill="#0a1824" stroke="#29475a"/>
  <path d="M770 390 L820 315 L855 360 L912 292 L980 390Z" fill="#0a1824" stroke="#29475a"/>
  <text x="500" y="35" fill="#f8f1d4" font-size="21" font-weight="700" letter-spacing="3">THE ACHIEVEMENT REALM</text>
  <text x="500" y="57" fill="#9bc9c6" font-size="12" font-style="italic">A live chronicle of the developer's journey</text>
  ${trophyMarkup}
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/adventure-trophies.svg", svg);

console.log(
  `Generated trophies: ${totals.commits} commits, ${totals.pullRequests} pull requests, ${stats.repositories.totalCount} repositories, ${totals.reviews} reviews`,
);
