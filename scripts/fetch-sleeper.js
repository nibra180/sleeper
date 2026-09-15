import { mkdir, writeFile } from 'node:fs/promises';

const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID ?? '1400190366010863616';
const MY_USERNAME = process.env.SLEEPER_USERNAME ?? 'nibra180';
const API = 'https://api.sleeper.app/v1';

async function get(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'user-agent': 'nibra180-sleeper-fantasy-data/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Sleeper API ${response.status} for ${path}`);
  }

  return response.json();
}

function sumFantasyPoints(settings = {}) {
  const whole = Number(settings.fpts ?? 0);
  const decimal = Number(settings.fpts_decimal ?? 0) / 100;
  return whole + decimal;
}

function sumFantasyPointsAgainst(settings = {}) {
  const whole = Number(settings.fpts_against ?? 0);
  const decimal = Number(settings.fpts_against_decimal ?? 0) / 100;
  return whole + decimal;
}

function playerSummary(playerId, players) {
  if (!playerId) return null;

  if (/^[A-Z]{2,3}$/.test(playerId)) {
    return {
      id: playerId,
      name: `${playerId} D/ST`,
      position: 'DEF',
      team: playerId,
      status: 'Active',
      injuryStatus: null,
      fantasyPositions: ['DEF'],
    };
  }

  const player = players[playerId] ?? {};
  const derivedName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  const fullName = player.full_name ?? (derivedName || playerId);

  return {
    id: playerId,
    name: fullName,
    firstName: player.first_name ?? null,
    lastName: player.last_name ?? null,
    position: player.position ?? null,
    team: player.team ?? null,
    status: player.status ?? null,
    injuryStatus: player.injury_status ?? null,
    injuryBodyPart: player.injury_body_part ?? null,
    injuryNotes: player.injury_notes ?? null,
    fantasyPositions: player.fantasy_positions ?? [],
    depthChartPosition: player.depth_chart_position ?? null,
    depthChartOrder: player.depth_chart_order ?? null,
    yearsExp: player.years_exp ?? null,
    age: player.age ?? null,
  };
}

function enrichPlayerIds(ids = [], players) {
  return ids.filter(Boolean).map((id) => playerSummary(id, players));
}

function normalizeTransaction(transaction, rosterById, players) {
  const mapPlayers = (entries) => Object.entries(entries ?? {}).map(([playerId, rosterId]) => ({
    player: playerSummary(playerId, players),
    rosterId,
    team: rosterById.get(Number(rosterId))?.teamName ?? null,
  }));

  return {
    id: transaction.transaction_id,
    type: transaction.type,
    status: transaction.status,
    createdAt: transaction.created ? new Date(transaction.created).toISOString() : null,
    week: transaction.leg ?? null,
    rosterIds: transaction.roster_ids ?? [],
    teams: (transaction.roster_ids ?? []).map((id) => rosterById.get(Number(id))?.teamName ?? `Roster ${id}`),
    adds: mapPlayers(transaction.adds),
    drops: mapPlayers(transaction.drops),
    waiverBid: transaction.settings?.waiver_bid ?? null,
    draftPicks: transaction.draft_picks ?? [],
  };
}

const [league, users, rosters, nflState, allPlayers, trendingAdds, trendingDrops] = await Promise.all([
  get(`/league/${LEAGUE_ID}`),
  get(`/league/${LEAGUE_ID}/users`),
  get(`/league/${LEAGUE_ID}/rosters`),
  get('/state/nfl'),
  get('/players/nfl'),
  get('/players/nfl/trending/add?lookback_hours=24&limit=50'),
  get('/players/nfl/trending/drop?lookback_hours=24&limit=50'),
]);

const currentWeek = Number(nflState.week ?? nflState.leg ?? 1);
const transactionWeeks = [...new Set([currentWeek, Math.max(1, currentWeek - 1)])];

const [matchups, ...transactionSets] = await Promise.all([
  get(`/league/${LEAGUE_ID}/matchups/${currentWeek}`),
  ...transactionWeeks.map((week) => get(`/league/${LEAGUE_ID}/transactions/${week}`)),
]);

const userById = new Map(users.map((user) => [user.user_id, user]));
const rosterById = new Map();

const normalizedRosters = rosters.map((roster) => {
  const user = userById.get(roster.owner_id);
  const teamName = user?.metadata?.team_name || user?.display_name || user?.username || `Roster ${roster.roster_id}`;
  const starters = roster.starters ?? [];
  const reserve = roster.reserve ?? [];
  const taxi = roster.taxi ?? [];
  const players = roster.players ?? [];
  const starterSet = new Set(starters);
  const reserveSet = new Set(reserve);
  const taxiSet = new Set(taxi);
  const bench = players.filter((id) => !starterSet.has(id) && !reserveSet.has(id) && !taxiSet.has(id));

  const normalized = {
    rosterId: roster.roster_id,
    ownerId: roster.owner_id,
    username: user?.username ?? null,
    displayName: user?.display_name ?? null,
    teamName,
    record: {
      wins: roster.settings?.wins ?? 0,
      losses: roster.settings?.losses ?? 0,
      ties: roster.settings?.ties ?? 0,
      fantasyPoints: sumFantasyPoints(roster.settings),
      fantasyPointsAgainst: sumFantasyPointsAgainst(roster.settings),
      waiverPosition: roster.settings?.waiver_position ?? null,
      waiverBudgetUsed: roster.settings?.waiver_budget_used ?? null,
    },
    starters: enrichPlayerIds(starters, allPlayers),
    bench: enrichPlayerIds(bench, allPlayers),
    reserve: enrichPlayerIds(reserve, allPlayers),
    taxi: enrichPlayerIds(taxi, allPlayers),
    allPlayers: enrichPlayerIds(players, allPlayers),
  };

  rosterById.set(roster.roster_id, normalized);
  return normalized;
});

const myUser = users.find((user) => user.username?.toLowerCase() === MY_USERNAME.toLowerCase());
const myRoster = normalizedRosters.find((roster) => roster.ownerId === myUser?.user_id) ?? null;

const matchupGroups = new Map();
for (const matchup of matchups) {
  if (!matchupGroups.has(matchup.matchup_id)) matchupGroups.set(matchup.matchup_id, []);
  matchupGroups.get(matchup.matchup_id).push(matchup);
}

const normalizedMatchups = [...matchupGroups.entries()].map(([matchupId, teams]) => ({
  matchupId,
  teams: teams.map((team) => {
    const roster = rosterById.get(team.roster_id);
    const starterSet = new Set(team.starters ?? []);
    const bench = (team.players ?? []).filter((id) => !starterSet.has(id));
    return {
      rosterId: team.roster_id,
      teamName: roster?.teamName ?? `Roster ${team.roster_id}`,
      username: roster?.username ?? null,
      points: team.points ?? 0,
      projectedPoints: team.custom_points ?? null,
      starters: enrichPlayerIds(team.starters ?? [], allPlayers),
      bench: enrichPlayerIds(bench, allPlayers),
    };
  }),
}));

const myMatchup = myRoster
  ? normalizedMatchups.find((matchup) => matchup.teams.some((team) => team.rosterId === myRoster.rosterId)) ?? null
  : null;

const rosteredPlayerIds = new Set(rosters.flatMap((roster) => roster.players ?? []));
const fantasyPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K']);

const availablePlayers = Object.entries(allPlayers)
  .filter(([playerId, player]) => {
    if (rosteredPlayerIds.has(playerId)) return false;
    if (!player?.active) return false;
    if (!fantasyPositions.has(player.position)) return false;
    return Boolean(player.team);
  })
  .map(([playerId]) => playerSummary(playerId, allPlayers))
  .sort((a, b) => {
    const positionOrder = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4 };
    return (positionOrder[a.position] ?? 99) - (positionOrder[b.position] ?? 99) || a.name.localeCompare(b.name);
  });

const defenses = [];
const nflTeams = new Set(
  Object.values(allPlayers)
    .map((player) => player?.team)
    .filter(Boolean),
);
for (const team of nflTeams) {
  if (!rosteredPlayerIds.has(team)) defenses.push(playerSummary(team, allPlayers));
}

const standings = [...normalizedRosters]
  .sort((a, b) =>
    b.record.wins - a.record.wins ||
    a.record.losses - b.record.losses ||
    b.record.fantasyPoints - a.record.fantasyPoints,
  )
  .map((roster, index) => ({
    rank: index + 1,
    rosterId: roster.rosterId,
    username: roster.username,
    teamName: roster.teamName,
    ...roster.record,
  }));

const transactions = transactionSets
  .flat()
  .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
  .map((transaction) => normalizeTransaction(transaction, rosterById, allPlayers));

const trending = {
  adds: trendingAdds.map((entry) => ({
    count: entry.count,
    player: playerSummary(entry.player_id, allPlayers),
    availableInLeague: !rosteredPlayerIds.has(entry.player_id),
  })),
  drops: trendingDrops.map((entry) => ({
    count: entry.count,
    player: playerSummary(entry.player_id, allPlayers),
    availableInLeague: !rosteredPlayerIds.has(entry.player_id),
  })),
};

const output = {
  generatedAt: new Date().toISOString(),
  source: {
    provider: 'Sleeper API',
    leagueId: LEAGUE_ID,
    username: MY_USERNAME,
  },
  nflState,
  league: {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    status: league.status,
    totalRosters: league.total_rosters,
    rosterPositions: league.roster_positions,
    settings: league.settings,
    scoringSettings: league.scoring_settings,
  },
  me: myRoster,
  currentMatchup: myMatchup,
  matchups: normalizedMatchups,
  standings,
  rosters: normalizedRosters,
  recentTransactions: transactions,
  trending,
  availablePlayers: [...availablePlayers, ...defenses],
};

await mkdir('data', { recursive: true });
await writeFile('data/league-state.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(`Wrote data/league-state.json for league ${LEAGUE_ID}, week ${currentWeek}.`);
console.log(`My roster: ${myRoster?.teamName ?? 'not found'} (${MY_USERNAME})`);
console.log(`Available fantasy players: ${output.availablePlayers.length}`);
