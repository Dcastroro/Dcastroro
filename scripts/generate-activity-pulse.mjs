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
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'profile-activity-pulse'}});
    if (!response.ok) throw new Error(`GitHub search failed for ${label}: ${response.status}`);
    const data = await response.json();
    if (!data.incomplete_results && Number.isSafeInteger(data.total_count)) return {label, count: data.total_count};
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
  throw new Error(`Incomplete GitHub data for ${label} after 3 attempts`);
}));

const cards = counts.map(({label, count}, i) => {
  const y = 96 + i * 64;
  const accents = ['#72e8dc', '#d7c5f1', '#f1d28f'];
  const accent = accents[i];
  return `<g transform="translate(32 ${y})"><path d="M0 0H576V56H0Z" fill="#102539" fill-opacity=".85" stroke="#4a5964"/><path d="M0 0V56" stroke="${accent}" stroke-opacity=".8" stroke-width="3"/><path d="M20 23l5 5-5 5-5-5Z" fill="${accent}" opacity=".8"/><text x="38" y="35" class="label">${label}</text><text x="552" y="40" class="number" text-anchor="end" fill="${accent}">${count.toLocaleString('en-US')}</text></g>`;
}).join('');
const description = counts.map(({label, count}) => `${label}: ${count}`).join('; ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="330" viewBox="0 0 640 330" role="img" aria-labelledby="title desc">
<title id="title">Public engineering activity</title><desc id="desc">${description}. Last 30 UTC calendar days through ${today}.</desc>
<defs><linearGradient id="night" x2="1" y2="1"><stop stop-color="#102436"/><stop offset="1" stop-color="#101b2a"/></linearGradient><linearGradient id="gold"><stop stop-color="#9e7840"/><stop offset=".45" stop-color="#f0d595"/><stop offset="1" stop-color="#9e7840"/></linearGradient></defs>
<path d="M18 2H622L638 18V312L622 328H18L2 312V18Z" fill="url(#night)" stroke="url(#gold)" stroke-width="2"/><path d="M25 10H615L630 25V305L615 320H25L10 305V25Z" fill="none" stroke="#506071" stroke-opacity=".6"/>
<style>text{font-family:Arial,sans-serif}.heading{fill:#fff4d4;font-family:Georgia,serif;font-size:29px;font-weight:700}.sub{fill:#b8d1d0;font-size:16px}.label{fill:#c7d9da;font-size:18px;font-weight:700;letter-spacing:.5px}.number{font-family:Georgia,serif;font-size:32px;font-weight:700}</style>
<path d="M36 32l6 6-6 6-6-6Z" fill="#72e8dc"/><text x="55" y="46" class="heading">Field notes</text><text x="55" y="72" class="sub">Public GitHub activity · last 30 UTC calendar days</text>
${cards}<path d="M32 292H608" stroke="#b48f53" stroke-opacity=".45"/><text x="32" y="314" class="sub">GitHub search · ${since} to ${today} UTC · refreshed daily</text></svg>`;
await writeFile('assets/activity-pulse.svg', svg);
console.log(`Public activity rendered for ${since} to ${today}`);
