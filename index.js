import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Builds README.md. Runs hourly (main.yml) and after the daily stats run (stats.yml).
// - Numbers: stats.md / stats.json, written by stats.py from all my repositories.
// - Projects and Writing: counts come live from stanase.com's public post index.
// Edit this file, not README.md: README.md is overwritten on every run.

const SITE = 'https://stanase.com';
const UA = 'Mozilla/5.0 (compatible; GitHubActions/1.0; +https://github.com/7ihin/7ihin)';

// Newest first. `strong` = bold in the table. `length` = show how long it lasted.
const TIMELINE = [
  { from: '2026-03', to: null, role: 'M.S. student, Artificial Intelligence', where: 'Gachon University · IRASC Lab', strong: true, length: true },
  { from: '2025-12', to: '2026-02', role: 'Embedded Team Intern', where: 'ROBOTIS', strong: true, length: true },
  { from: '2023-03', to: '2025-07', role: 'Hardware Development Intern', where: 'RoboGates', strong: true, length: true },
  { from: '2022-04', to: '2023-10', role: 'Signaller, military service', where: 'ROK Army · 83rd Tank Battalion' },
  { from: '2021-02', to: '2026-02', role: 'B.S., Future Automotive Engineering', where: 'Gachon University' },
];

const AWARDS = [
  { year: 2019, result: 'Champion', event: '3D Printing Hackathon, Gyeonggi Science Festival', strong: true },
  { year: 2019, result: 'Runner-up', event: 'LEGO Autonomous Vehicle Competition, Pangyo Autonomous Motor Show' },
  { year: 2019, result: 'Alliance Award', event: 'World Robot Olympiad Korea' },
  { year: 2018, result: 'Champion', event: 'Intelligent Robot Competition, Suwon Information & Science Festival', strong: true },
];

// Same projects as stanase.com/projects (src/data/projects.json there).
const PROJECTS = [
  {
    slug: 'microduck',
    title: 'Microduck · Gwakgwak',
    stack: 'Raspberry Pi 4, Dynamixel XL330, ONNX Runtime, mjlab',
    summary: 'Building Pollen Robotics’ open-source bipedal robot and teaching it to walk with a reinforcement-learning policy.',
  },
  {
    slug: 'rl-ptz-multi-control',
    title: 'RL-based PTZ Multi-Camera Control',
    stack: '',
    summary: 'Research at IRASC Lab: controlling several PTZ cameras with reinforcement learning to improve tracking quality and coordination.',
  },
  {
    slug: 'robotics-hardware-study-2026',
    title: 'Robotics Fundamentals Study 2026',
    stack: 'ROS 2, Dynamixel XL330, Fusion 360, Python, PID, MPC',
    summary: 'Hardware team study notes: DC/BLDC/QDD motors, PID and MPC control, inverse kinematics, CAD, up to a robot-arm pick-and-place build.',
  },
  {
    slug: 'autonomous-driving-lane-study',
    title: 'Autonomous Driving Lane Study',
    stack: '',
    summary: 'Lane detection, motor control and lightweight autonomy on constrained hardware.',
  },
  {
    slug: 'stanase-archive',
    title: 'Stanase',
    stack: 'React, TypeScript, Vite, Three.js',
    summary: 'This blog, written in Korean and English, with its own editor.',
  },
];

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const num = (n) => n.toLocaleString('en-US');
const monthYear = (iso) =>
  new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dot = (ym) => ym.replace('-', '.');

// Months from start to end, both months counted (Mar 2023 – Jul 2025 = 2 yr 5 mo).
function length(from, to) {
  const now = new Date(Date.now() + 9 * 3600e3); // KST
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to ? to.split('-').map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const m = (ty - fy) * 12 + (tm - fm) + 1;
  const y = Math.floor(m / 12);
  return [y ? `${y} yr` : '', m % 12 ? `${m % 12} mo` : ''].filter(Boolean).join(' ');
}

(async () => {
  let posts;
  let latest;
  try {
    posts = (await getJson(`${SITE}/data/posts-index.json`)).posts.filter((p) => p.meta.status === 'published');
    latest = (await getJson(`${SITE}/latest-posts.json`)).slice(0, 5);
  } catch (err) {
    // Site unreachable: keep the README as it is instead of writing one with holes.
    console.error(`README left unchanged: ${err.message}`);
    return;
  }
  const perProject = {};
  for (const p of posts) if (p.meta.project) perProject[p.meta.project] = (perProject[p.meta.project] || 0) + 1;

  const stats = existsSync('stats.md') ? readFileSync('stats.md', 'utf8').trim() : '_Numbers appear after the first daily stats run._';
  const totals = existsSync('stats.json') ? JSON.parse(readFileSync('stats.json', 'utf8')) : null;

  // One line of the numbers that matter most, right under the intro.
  const headline = [
    totals && `**${num(totals.commits)}** commits since ${monthYear(totals.first)}`,
    totals && `**${num(totals.days)}** days with a commit`,
    totals && `**${totals.repos}** repositories (${totals.private} private)`,
    totals && `**${num(totals.added)}** lines of code, ${Math.round(totals.top_share)} % ${totals.top_lang}`,
    posts.length && `**${posts.length}** blog posts`,
  ].filter(Boolean).join(' · ');

  const timeline = [
    '| When | Length | Role | Where |',
    '|:--|--:|:--|:--|',
    ...TIMELINE.map((t) => {
      const role = t.strong ? `**${t.role}**` : t.role;
      return `| ${dot(t.from)} – ${t.to ? dot(t.to) : 'now'} | ${t.length ? length(t.from, t.to) : '–'} | ${role} | ${t.where} |`;
    }),
  ].join('\n');

  const awards = [
    '| Year | Result | Competition |',
    '|:--|:--|:--|',
    ...AWARDS.map((a) => `| ${a.year} | ${a.strong ? `**${a.result}**` : a.result} | ${a.event} |`),
  ].join('\n');

  const projects = [
    '| Project | Posts | What it is | Built with |',
    '|:--|--:|:--|:--|',
    ...PROJECTS.map((p) => {
      const n = (p.slug === 'stanase-archive' ? posts.length : perProject[p.slug]) || '–';
      return `| [${p.title}](${SITE}/projects/${p.slug}/) | ${n} | ${p.summary} | ${p.stack || '–'} |`;
    }),
  ].join('\n');

  const writing = latest.map((it) => `- ${it.date} · [${it.title}](${it.url})`).join('\n');

  const text = `# LEO · Kwon Minjae

Robotics engineer and M.S. student at IRASC Lab, Gachon University, working on reinforcement learning for multi-camera PTZ control.
I work across the stack, from mechanical design and embedded firmware to ROS, control and autonomy, and I like turning hardware into systems that actually move: design it, build it, test it, iterate.

${headline}

[stanase.com ↗](${SITE}) · [minmj0815@gachon.ac.kr](mailto:minmj0815@gachon.ac.kr) · [LinkedIn ↗](https://www.linkedin.com/in/%EB%AF%BC%EC%9E%AC-%EA%B6%8C-6047a9302/)

## Timeline

${timeline}

## Numbers

<!-- STATS:START -->
${stats}
<!-- STATS:END -->

## Projects

${projects}

## Awards

${awards}

<details>
<summary>Clubs and certifications</summary>

| When | Role | Club |
|:--|:--|:--|
| 2024.09 – 2026.01 | Executive member | *Take Out*, embedded systems club |
| 2024.09 – 2025.08 | Member | *Pay1oad*, security club |
| 2018 – 2020 | President, then member | Robotics club, Suwon Technical High School |

Certifications: Electronics Technician · Electronic CAD Technician · Information Technology Equipment Technician · Word Processor Level 1 · Computer Literacy Level 2

</details>

## Stack

- **Languages** — Python, TypeScript / JavaScript, Java, C++, C, Lua
- **Embedded and hardware** — STM32, Raspberry Pi, Arduino, Dynamixel
- **Robotics and vision** — ROS / ROS 2, mjlab, OpenCV, MATLAB
- **CAD** — SolidWorks, Fusion 360
- **Tools** — Ubuntu, Git, VS Code

## Writing

<!-- BLOG-POST-LIST:START -->
${writing}
<!-- BLOG-POST-LIST:END -->

More at [stanase.com ↗](${SITE})
`;

  writeFileSync('README.md', text, 'utf8');
  console.log('README updated');
})();
