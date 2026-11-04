import { writeFile } from 'node:fs/promises';

const login = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;
if (!login || !token || !/^[\w-]+$/.test(login)) throw new Error('GitHub owner and token are required');

const today = new Date().toISOString().slice(0, 10);
const start = new Date(`${today}T00:00:00Z`);
start.setUTCDate(start.getUTCDate() - 29);
const since = start.toISOString().slice(0, 10);
const searches = [
  ['PUBLIC PRS OPENED', `is:pr is:public author:${login} created:>=${since}`],
  ['PUBLIC PRS MERGED', `is:pr is:public author:${login} merged:>=${since}`],
  ['PUBLIC ISSUES OPENED', `is:issue is:public author:${login} created:>=${since}`],
];
const counts = await Promise.all(searches.map(async ([label, query]) => {
  const url = new URL('https://api.github.com/search/issues');
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '1');
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'profile-activity-pulse'}});
  if (!response.ok) throw new Error(`GitHub search failed for ${label}: ${response.status}`);
  const data = await response.json();
  if (data.incomplete_results || !Number.isSafeInteger(data.total_count)) throw new Error(`Incomplete GitHub data for ${label}`);
  return {label, count: data.total_count};
}));

const cards = counts.map(({label, count}, i) => {
  const x = 28 + i * 308;
  return `<g transform="translate(${x} 92)"><rect width="282" height="120" rx="14" fill="#11263a" stroke="#315367"/><text x="20" y="32" class="label">${label}</text><text x="20" y="88" class="number">${count.toLocaleString('en-US')}</text><path d="M226 30h32M242 14v32" stroke="#72e8dc" opacity=".45"/></g>`;
}).join('');
const description = counts.map(({label, count}) => `${label}: ${count}`).join('; ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="270" viewBox="0 0 980 270" role="img" aria-labelledby="title desc">
<title id="title">Public engineering activity</title><desc id="desc">${description}. Last 30 UTC calendar days through ${today}.</desc>
<rect x="2" y="2" width="976" height="266" rx="20" fill="#0b192b" stroke="#d9a84f" stroke-width="2"/>
<style>text{font-family:Arial,sans-serif}.heading{fill:#fff4d4;font-size:23px;font-weight:700}.sub{fill:#9ec9cb;font-size:13px}.label{fill:#b8d1d7;font-size:12px;font-weight:700;letter-spacing:.6px}.number{fill:#72e8dc;font-size:38px;font-weight:700}</style>
<text x="28" y="41" class="heading">ENGINEERING PULSE</text><text x="28" y="66" class="sub">Public GitHub activity · last 30 UTC calendar days</text>
${cards}<text x="28" y="244" class="sub">GitHub search · ${since} to ${today} UTC · refreshed daily</text></svg>`;
await writeFile('assets/activity-pulse.svg', svg);
console.log(`Public activity rendered for ${since} to ${today}`);
