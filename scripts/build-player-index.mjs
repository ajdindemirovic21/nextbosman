import fs from "fs";
import path from "path";
import readline from "readline";

const ROOT = process.cwd();
const TODAY = new Date("2026-10-07");
const STATS_FROM = "2025-07-01";
const OUT_DIR = path.join(ROOT, "data", "derived");
const OUT_FILE = path.join(OUT_DIR, "players.json");

const EU = new Set([
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
]);

const SUB = {
  Goalkeeper: "GK",
  "Centre-Back": "CB",
  Sweeper: "CB",
  "Left-Back": "LB",
  "Right-Back": "RB",
  "Defensive Midfield": "DM",
  "Central Midfield": "CM",
  "Right Midfield": "RW",
  "Left Midfield": "LW",
  "Attacking Midfield": "AM",
  "Left Winger": "LW",
  "Right Winger": "RW",
  "Centre-Forward": "ST",
  "Second Striker": "ST",
};

const GROUP = {
  Goalkeeper: "GK",
  Defender: "CB",
  Midfield: "CM",
  Attack: "ST",
};

function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function isoDate(value) {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function ageFrom(iso) {
  if (!iso) return 0;
  const born = new Date(iso);
  let age = TODAY.getFullYear() - born.getFullYear();
  const m = TODAY.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && TODAY.getDate() < born.getDate())) age -= 1;
  return age;
}

function loadCompetitions() {
  const map = new Map();
  const text = fs.readFileSync(path.join(ROOT, "competitions.csv"), "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseLine(lines[0]);
  const id = header.indexOf("competition_id");
  const name = header.indexOf("name");
  const country = header.indexOf("country_name");
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    map.set(row[id], { name: row[name] || "", country: row[country] || "" });
  }
  return map;
}

function loadPlayers(competitions) {
  const text = fs.readFileSync(path.join(ROOT, "players.csv"), "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseLine(lines[0]);
  const col = (n) => header.indexOf(n);
  const players = [];
  const wanted = new Set();

  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    if (row.length < 10) continue;
    const lastSeason = Number(row[col("last_season")] || 0);
    if (lastSeason < 2024) continue;

    const contract = isoDate(row[col("contract_expiration_date")]);
    const clubName = (row[col("current_club_name")] || "").trim();
    let availability = null;
    let freeSince = null;
    let contractUntil = null;

    if (contract) {
      const dt = new Date(contract);
      if (dt < TODAY) {
        availability = "free";
        freeSince = contract;
      } else if (dt.getFullYear() <= 2027) {
        availability = "expiring";
        contractUntil = contract;
      } else {
        continue;
      }
    } else if (!clubName) {
      availability = "free";
    } else {
      continue;
    }

    const dob = isoDate(row[col("date_of_birth")]) || "1998-01-01";
    const competitionId = row[col("current_club_domestic_competition_id")] || "";
    const competition = competitions.get(competitionId);
    const nationality = (row[col("country_of_citizenship")] || "").trim();
    const sub = row[col("sub_position")] || "";
    const group = row[col("position")] || "";
    const id = String(row[col("player_id")]);

    const player = {
      id,
      name: row[col("name")] || "",
      age: ageFrom(dob),
      dateOfBirth: dob,
      position: SUB[sub] || GROUP[group] || "CM",
      club: availability === "free" ? null : clubName || null,
      lastClub: clubName || "—",
      league: competition?.name || competitionId || "",
      country: competition?.country || row[col("country_of_birth")] || "",
      nationality,
      euPassport: EU.has(nationality),
      availability,
      contractUntil,
      freeSince,
      appearances: 0,
      goals: 0,
      assists: 0,
      minutesPlayed: 0,
      internationalCaps: Number(row[col("international_caps")] || 0) || 0,
      internationalGoals: Number(row[col("international_goals")] || 0) || 0,
      marketValueEur: Number(row[col("market_value_in_eur")] || 0) || 0,
    };

    players.push(player);
    wanted.add(id);
  }

  return { players, wanted };
}

async function addAppearanceStats(players, wanted) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const file = path.join(ROOT, "appearances.csv");
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  let col = {};
  let n = 0;

  for await (const line of rl) {
    if (!header) {
      header = parseLine(line);
      col = {
        player_id: header.indexOf("player_id"),
        date: header.indexOf("date"),
        goals: header.indexOf("goals"),
        assists: header.indexOf("assists"),
        minutes: header.indexOf("minutes_played"),
      };
      continue;
    }
    n++;
    const row = parseLine(line);
    const id = row[col.player_id];
    if (!wanted.has(id)) continue;
    const date = row[col.date] || "";
    if (date < STATS_FROM) continue;
    const player = byId.get(id);
    if (!player) continue;
    player.appearances += 1;
    player.goals += Number(row[col.goals] || 0) || 0;
    player.assists += Number(row[col.assists] || 0) || 0;
    player.minutesPlayed += Number(row[col.minutes] || 0) || 0;
  }

  console.log("appearances_rows", n);
}

const competitions = loadCompetitions();
const { players, wanted } = loadPlayers(competitions);
console.log("indexed_players", players.length, "free", players.filter((p) => p.availability === "free").length, "expiring", players.filter((p) => p.availability === "expiring").length);
await addAppearanceStats(players, wanted);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(players));
console.log("wrote", OUT_FILE, "bytes", fs.statSync(OUT_FILE).size);
