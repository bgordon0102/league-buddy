import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';

const SEASON_FILE = './data/season.json';
const SCORES_FILE = './data/scores.json';

const EAST = [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers', 'Detroit Pistons', 'Indiana Pacers', 'Miami Heat', 'Milwaukee Bucks', 'New York Knicks', 'Orlando Magic', 'Philadelphia 76ers', 'Toronto Raptors', 'Washington Wizards'
];
const WEST = [
    'Dallas Mavericks', 'Denver Nuggets', 'Golden State Warriors', 'Houston Rockets', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'Oklahoma City Thunder', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Utah Jazz'
];

function getStandings() {
    const TEAMS_FILE = './data/teams.json';
    if (!fs.existsSync(TEAMS_FILE) || !fs.existsSync(SCORES_FILE)) return null;
    const teamsArr = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
    const scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    // Initialize standings
    const standings = {};
    for (const team of teamsArr) {
        standings[team.name] = { team: team.name, wins: 0, losses: 0, winPct: 0, gb: 0 };
    }
    for (const game of scores) {
        if (!game.approved) continue;
        const { teamA, teamB, scoreA, scoreB } = game;
        if (!standings[teamA] || !standings[teamB]) continue;
        if (scoreA > scoreB) {
            standings[teamA].wins++;
            standings[teamB].losses++;
        } else if (scoreB > scoreA) {
            standings[teamB].wins++;
            standings[teamA].losses++;
        }
    }
    for (const team of teamsArr) {
        const s = standings[team.name];
        const total = s.wins + s.losses;
        s.winPct = total > 0 ? (s.wins / total) : 0;
    }
    function sortConf(conf) {
        const arr = conf.filter(t => standings[t]).map(t => standings[t]);
        arr.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || a.losses - b.losses || a.team.localeCompare(b.team));
        return arr;
    }
    return {
        east: sortConf(EAST),
        west: sortConf(WEST)
    };
}

function getPlayoffPicture(confArr) {
    // NBA Playoff logic: Top 6 = Playoff, 7-10 = Play-In
    // Seeds 1-6: Playoff, 7-10: Play-In
    return {
        playoff: confArr.slice(0, 6),
        playin: confArr.slice(6, 10)
    };
}

export const data = new SlashCommandBuilder()
    .setName('playoffpicture')
    .setDescription('Show the current NBA-style playoff bracket and play-in teams for each conference.');

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const standings = getStandings();
    if (!standings) {
        return await interaction.editReply('Standings data not available.');
    }
    const east = getPlayoffPicture(standings.east);
    const west = getPlayoffPicture(standings.west);
    function getTeamName(arr, idx) {
        return arr[idx] ? arr[idx].team : 'TBD';
    }
    // Playoff matchups: 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5 (NBA format)
    function playoffMatchups(conf) {
        return [
            `1️⃣ ${getTeamName(conf, 0)} vs 8️⃣ ${getTeamName(conf, 7)}`,
            `2️⃣ ${getTeamName(conf, 1)} vs 7️⃣ ${getTeamName(conf, 6)}`,
            `3️⃣ ${getTeamName(conf, 2)} vs 6️⃣ ${getTeamName(conf, 5)}`,
            `4️⃣ ${getTeamName(conf, 3)} vs 5️⃣ ${getTeamName(conf, 4)}`
        ].join('\n');
    }
    // Play-In matchups: 7 vs 10, 8 vs 9
    function playinMatchups(conf) {
        return [
            `7️⃣ ${getTeamName(conf, 6)} vs 🔟 ${getTeamName(conf, 9)}`,
            `8️⃣ ${getTeamName(conf, 7)} vs 9️⃣ ${getTeamName(conf, 8)}`
        ].join('\n');
    }

    const eastEmbed = new EmbedBuilder()
        .setTitle('🏆 Eastern Conference Playoff Bracket')
        .addFields(
            { name: 'Playoff Matchups', value: playoffMatchups(standings.east), inline: false },
            { name: 'Play-In Matchups', value: playinMatchups(standings.east), inline: false }
        )
        .setColor(0x1D428A)
        .setFooter({ text: 'Top 6: Playoff | 7-10: Play-In' });

    const westEmbed = new EmbedBuilder()
        .setTitle('🏆 Western Conference Playoff Bracket')
        .addFields(
            { name: 'Playoff Matchups', value: playoffMatchups(standings.west), inline: false },
            { name: 'Play-In Matchups', value: playinMatchups(standings.west), inline: false }
        )
        .setColor(0xE03A3E)
        .setFooter({ text: 'Top 6: Playoff | 7-10: Play-In' });

    await interaction.editReply({ embeds: [eastEmbed, westEmbed] });
}
