import express from "express";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HOLIDAYS_FILE = join(__dirname, "holidays.json");

// OB-typsmappning baserad på Dagsmart-koder
const CODES_150_FROM_07 = new Set([
  "midsummerEve", "midsummerDay",
  "christmasEve", "christmasDay", "boxingDay",
  "newYearsEve",  "newYearsDay",
  "whitSunday",   "whitMonday",   "whitSaturdayEve"
]);
const CODES_150_FROM_18 = new Set(["maundyThursday"]);
const CODES_300_FROM_07 = new Set([
  "epiphany", "ascensionDay", "labourDay", "allSaintsDay", "nationalDay"
]);

function obTypeFromCode(code) {
  if (CODES_150_FROM_07.has(code)) return "s150f07";
  if (CODES_150_FROM_18.has(code)) return "s150f18";
  if (CODES_300_FROM_07.has(code)) return "hof07";
  return "hol300";
}

// Räkna ut skärtorsdagen (3 dagar före påsk) – saknas i Dagsmart
function easterSunday(year) {
  const a=year%19, b=Math.floor(year/100), c=year%100,
        d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25),
        g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7,
        m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31),
        day=((h+l-7*m+114)%31)+1;
  return new Date(year, month-1, day);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d) {
  return d.toISOString().split("T")[0];
}

// Läs in holidays.json
function loadHolidays() {
  try {
    return JSON.parse(readFileSync(HOLIDAYS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

// Spara tillbaka till holidays.json
function saveHolidays(data) {
  const sorted = Object.fromEntries(
    Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(HOLIDAYS_FILE, JSON.stringify(sorted, null, 2), "utf-8");
}

// Hämta ett år från Dagsmart och berika med obType + skärtorsdagen
async function fetchYearFromDagsmart(year) {
  const url = `https://api.dagsmart.se/holidays?year=${year}`;
  console.log(`Hämtar ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dagsmart svarade med HTTP ${res.status}`);
  const data = await res.json();

  const result = {};
  for (const item of data) {
    result[item.date] = {
      code:   item.code,
      name:   item.name.sv,
      obType: obTypeFromCode(item.code)
    };
  }

  // Lägg till skärtorsdagen manuellt
  const skartorsdag = fmt(addDays(easterSunday(year), -3));
  result[skartorsdag] = {
    code:   "maundyThursday",
    name:   "skärtorsdagen",
    obType: "s150f18"
  };

  // Lägg även till nyårsdagen nästa år (behövs för nattpasset nyårsafton)
  const nyarNast = `${year + 1}-01-01`;
  if (!result[nyarNast]) {
    result[nyarNast] = {
      code:   "newYearsDay",
      name:   "nyårsdagen",
      obType: "s150f07"
    };
  }

  return result;
}

// Kontrollera om ett år är laddat i holidays-objektet
// Notera: ett ej hämtat år kan ändå ha en post (t.ex. nyårsdagen som
// lades till som frö av föregående års hämtning), så vi måste hålla
// reda på faktiskt hämtade år separat i _meta.loadedYears.
function yearIsLoaded(holidays, year) {
  return Array.isArray(holidays._meta?.loadedYears) &&
    holidays._meta.loadedYears.includes(year);
}

function markYearLoaded(holidays, year) {
  if (!holidays._meta) holidays._meta = { loadedYears: [] };
  if (!holidays._meta.loadedYears.includes(year)) {
    holidays._meta.loadedYears.push(year);
  }
}

// Servera statiska filer från /public
app.use(express.static(join(__dirname, "public")));

// API: hämta högtider för ett år (auto-fetch om det saknas)
app.get("/api/holidays/:year", async (req, res) => {
  const year = parseInt(req.params.year);
  if (isNaN(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: "Ogiltigt år" });
  }

  const holidays = loadHolidays();

  if (!yearIsLoaded(holidays, year)) {
    try {
      const fetched = await fetchYearFromDagsmart(year);
      Object.assign(holidays, fetched);
      markYearLoaded(holidays, year);
      saveHolidays(holidays);
      console.log(`År ${year} hämtat och sparat i holidays.json`);
    } catch (err) {
      console.error(`Kunde inte hämta ${year} från Dagsmart:`, err.message);
      return res.status(502).json({ error: `Kunde inte hämta ${year} från Dagsmart: ${err.message}` });
    }
  }

  // Filtrera och returnera bara det begärda året (+ 1 jan nästa år för nattpass)
  const result = {};
  for (const [date, val] of Object.entries(holidays)) {
    if (date.startsWith(`${year}-`) || date === `${year + 1}-01-01`) {
      result[date] = val;
    }
  }

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Lönekalkylatorn körs på http://localhost:${PORT}`);
});
