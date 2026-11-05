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
  const x = 35 + i * 310;
  const accents = ['#72e8dc', '#d7c5f1', '#f1d28f'];
  const accent = accents[i];
  return `<g transform="translate(${x} 85)"><path d="M0 0H284V93H0Z" fill="#102539" fill-opacity=".85" stroke="#4a5964"/><path d="M0 0H284" stroke="${accent}" stroke-opacity=".65" stroke-width="2"/><text x="16" y="28" class="label">${label}</text><text x="16" y="75" class="number" fill="${accent}">${count.toLocaleString('en-US')}</text><path d="M245 28l6 6-6 6-6-6Z" fill="${accent}" opacity=".7"/><path d="M218 73h46" stroke="${accent}" stroke-opacity=".45"/></g>`;
}).join('');
const description = counts.map(({label, count}) => `${label}: ${count}`).join('; ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="240" viewBox="0 0 1000 240" role="img" aria-labelledby="title desc">
<title id="title">Public engineering activity</title><desc id="desc">${description}. Last 30 UTC calendar days through ${today}.</desc>
<defs><linearGradient id="night" x2="1" y2="1"><stop stop-color="#102436"/><stop offset="1" stop-color="#101b2a"/></linearGradient><linearGradient id="gold"><stop stop-color="#9e7840"/><stop offset=".45" stop-color="#f0d595"/><stop offset="1" stop-color="#9e7840"/></linearGradient></defs>
<path d="M18 2H982L998 18V222L982 238H18L2 222V18Z" fill="url(#night)" stroke="url(#gold)" stroke-width="2"/><path d="M25 10H975L990 25V215L975 230H25L10 215V25Z" fill="none" stroke="#506071" stroke-opacity=".6"/>
<style>text{font-family:Arial,sans-serif}.heading{fill:#fff4d4;font-family:Georgia,serif;font-size:25px;font-weight:700}.sub{fill:#b8d1d0;font-size:14px}.label{fill:#c7d9da;font-size:13px;font-weight:700;letter-spacing:.7px}.number{font-family:Georgia,serif;font-size:38px;font-weight:700}</style>
<path d="M35 31l6 6-6 6-6-6Z" fill="#72e8dc"/><text x="54" y="44" class="heading">Field notes</text><text x="54" y="65" class="sub">Public GitHub activity · last 30 UTC calendar days</text>
${cards}<path d="M35 201H965" stroke="#b48f53" stroke-opacity=".45"/><text x="35" y="222" class="sub">GitHub search · ${since} to ${today} UTC · refreshed daily</text></svg>`;
await writeFile('assets/activity-pulse.svg', svg);
console.log(`Public activity rendered for ${since} to ${today}`);
