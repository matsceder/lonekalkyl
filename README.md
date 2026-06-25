# Löneöversikt

OB- och övertidskalkylator baserad på kollektivavtal med stöd för svensk kalender via [Dagsmart](https://dagsmart.se).

## Kom igång

### GitHub Codespaces (rekommenderat)

1. Klona repot och öppna i GitHub Codespaces
2. Codespace installerar dependencies automatiskt
3. Kör `npm start` i terminalen
4. Appen öppnas automatiskt i webbläsaren på port 3000

### Lokalt med Docker

```bash
docker build -t lonekalkyl .
docker run -p 3000:3000 lonekalkyl
```

Öppna sedan [http://localhost:3000](http://localhost:3000).

### Lokalt med Node.js

Kräver Node.js 18+.

```bash
npm install
npm start
```

## Kalender

Högtider för 2025–2026 finns förifyllda i `holidays.json`. När ett nytt år efterfrågas i appen hämtas data automatiskt från Dagsmart API och sparas i filen. Commita `holidays.json` för att dela uppdateringar med kollegor.

## Struktur

```
├── server.js          # Express-server, hämtar från Dagsmart vid behov
├── holidays.json      # Sparade högtider (committas i repot)
├── public/
│   └── index.html     # Frontend
├── Dockerfile
└── .devcontainer/
    └── devcontainer.json
```
