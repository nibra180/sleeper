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

`.github/workflows/update-league-data.yml` läuft täglich um **06:00 Europe/Berlin**. Dazu kommen zwei Läufe:

- Mittwoch 09:30, nach der Waiver-Verarbeitung von Sleeper, damit Rosters und FAAB-Stand aktuell sind.
- Sonntag 17:45, nach den Inactives, vor den Spielen ab 19:00.

Den Start löst cron-job.org über die GitHub-API aus (`workflow_dispatch`). Der eingebaute GitHub-Scheduler hat geplante Läufe in diesem Repo 4 bis 7 Stunden zu spät gestartet und eignet sich deshalb nicht für eine feste Uhrzeit.

Einrichtung bei cron-job.org:

- URL: `https://api.github.com/repos/nibra180/sleeper/actions/workflows/update-league-data.yml/dispatches`
- Methode: `POST`
- Header: `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`, `Content-Type: application/json`, `X-GitHub-Api-Version: 2022-11-28`
- Body: `{"ref":"main"}`
- Zeitplan: täglich 06:00, Zeitzone `Europe/Berlin`. Für Mittwoch 09:30 und Sonntag 17:45 je ein eigener Job mit denselben Einstellungen.
- Erwartete Antwort: `204 No Content`

Der Token ist ein Fine-grained Personal Access Token, beschränkt auf dieses Repository, mit der Berechtigung **Actions: Read and write**. Er läuft ab und muss dann bei cron-job.org ersetzt werden.

Als Rückfall plant der Workflow selbst einen Lauf um 06:30 Europe/Berlin. Dieser Lauf bricht ab, wenn `generatedAt` schon das heutige Datum trägt. Er greift also nur an Tagen, an denen cron-job.org nicht ausgelöst hat, und kommt wegen der GitHub-Verzögerung meist erst gegen Mittag.

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
