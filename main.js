const API_KEY = "YOUR_TOMORROW_KEY";
const lat = 42.32, lon = 21.36; // Viti

const fields = ["lightningFlashRateDensity"];
const now = new Date().toISOString();

const url = `https://api.tomorrow.io/v4/timelines?location=${lat},${lon}` +
  `&fields=${fields.join(",")}` +
  `&timesteps=minute&startTime=${now}&endTime=nowPlus1h` +
  `&apikey=${API_KEY}`;

const data = await fetch(url).then(r => r.json());
const points = data?.data?.timelines?.[0]?.intervals || [];
// p.sh. merre vlerën e fundit
const last = points.at(-1)?.values?.lightningFlashRateDensity ?? 0;
// Shfaq një badge në UI
document.querySelector("#lightning").textContent =
  last > 0 ? `⚡ Aktivitet rrufesh: ${last.toFixed(2)} fl/min/km²` : "Pa aktivizim";
