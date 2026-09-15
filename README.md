# Sleeper Fantasy Data

Kleiner, dependency-freier Exporter für die Sleeper-Liga `1400190366010863616`.

Das Repository erzeugt täglich eine normalisierte Datei unter:

```text
data/league-state.json
```

Diese Datei ist als Datenquelle für einen Fantasy-Football-Advisor gedacht.

## Enthaltene Daten

Der Export enthält unter anderem:

- League-Settings und Scoring
- aktuellen NFL-/Sleeper-Week-State
- mein Team `nibra180`
- Starter, Bench, Reserve und Taxi
- alle Liga-Rosters
- aktuelles Matchup und alle Matchups der Woche
- Standings
- Transaktionen der aktuellen und vorherigen Woche
- Sleeper Trending Adds/Drops der letzten 24 Stunden
- in der Liga nicht rostered aktive QB/RB/WR/TE/K und D/ST
- Sleeper Injury- und Depth-Chart-Metadaten, sofern vorhanden

## Lokaler Lauf

Voraussetzung: Node.js 22+

```bash
npm run fetch
```

Optional lassen sich Liga und Username überschreiben:

```bash
SLEEPER_LEAGUE_ID=1400190366010863616 \
SLEEPER_USERNAME=nibra180 \
npm run fetch
```

## GitHub Action

`.github/workflows/update-league-data.yml` läuft täglich gegen **07:30 Europe/Berlin** und berücksichtigt automatisch CET/CEST.

Die Action kann außerdem über **Actions → Update Sleeper league data → Run workflow** manuell gestartet werden.

Nach einem erfolgreichen Lauf committed `github-actions[bot]` die aktualisierte JSON-Datei direkt nach `main`.

## Datenquelle für ChatGPT

Repository-Datei:

```text
https://github.com/nibra180/sleeper/blob/main/data/league-state.json
```

Raw-URL:

```text
https://raw.githubusercontent.com/nibra180/sleeper/main/data/league-state.json
```

Für Fantasy-Analysen sollte zuerst `generatedAt` geprüft werden. Anschließend können Liga-/Roster-Daten aus dieser Datei mit aktuellen NFL-News, Injury Reports, Practice Reports und Matchup-Daten kombiniert werden.

## Sleeper API

Die Daten stammen aus der öffentlichen, read-only Sleeper API. Für diese Endpoints ist kein API-Key nötig.

Dokumentation: https://docs.sleeper.com/
