# DokkanWebScraper
Scrapes the Dokkan Wiki to build a database of characters etc

## Run locally
```
npm run run
```

Output goes to `./data/{currentDate}DokkanCharacterData.json`

The scraper also writes stable app-ingestion artifacts to:

- `./data/latest/characters.json.gz`
- `./data/latest/characters-manifest.json`

## Test 
```
npm run test
```
