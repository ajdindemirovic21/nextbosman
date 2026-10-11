import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const file = path.join(ROOT, "data", "derived", "players.json");
if (!fs.existsSync(file)) {
  console.error("Missing data/derived/players.json — run npm run index:players first");
  process.exit(1);
}

const players = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = players.map((player) => ({
  id: player.id,
  name: player.name,
  age: player.age,
  date_of_birth: player.dateOfBirth || null,
  position: player.position,
  club: player.club,
  last_club: player.lastClub,
  league: player.league,
  country: player.country,
  nationality: player.nationality,
  eu_passport: player.euPassport,
  availability: player.availability,
  contract_until: player.contractUntil,
  free_since: player.freeSince,
  has_season_stats: player.hasSeasonStats === true,
  appearances: player.appearances,
  goals: player.goals,
  assists: player.assists,
  minutes_played: player.minutesPlayed,
  international_caps: player.internationalCaps,
  international_goals: player.internationalGoals,
  market_value_eur: player.marketValueEur,
}));

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const chunkSize = 400;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await supabase.from("players").upsert(chunk, { onConflict: "id" });
  if (error) {
    console.error(`Upsert failed at ${i}:`, error.message);
    process.exit(1);
  }
  console.log(`Upserted ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`);
}

console.log("Done.");
