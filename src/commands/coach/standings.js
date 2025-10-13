import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const SEASON_FILE = './data/season.json';
const SCORES_FILE = './data/scores.json';

// NBA conference mapping (Eastern/Western)
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
    // Calculate wins/losses
    for (const game of scores) {
        if (!game.approved) continue;
        const { teamA, teamB, scoreA, scoreB } = game;
        if (!standings[teamA] || !standings[teamB]) {
            console.warn(`[standings] Team missing from standings:`, teamA, teamB);
            continue;
        }
        if (scoreA > scoreB) {
            standings[teamA].wins++;
            standings[teamB].losses++;
        } else if (scoreB > scoreA) {
            standings[teamB].wins++;
            standings[teamA].losses++;
        }
    }
    // Calculate win %
    for (const team of teamsArr) {
        const s = standings[team.name];
        if (!s) {
            console.warn(`[standings] Team missing from standings during win% calc:`, team.name);
            continue;
        }
        const total = s.wins + s.losses;
        s.winPct = total > 0 ? (s.wins / total) : 0;
    }
    // Sort and calculate games behind (GB)
    function sortConf(conf) {
        // Only include teams present in this season
        const arr = conf.filter(t => standings[t]).map(t => standings[t]);
        if (arr.length === 0) return arr;
        arr.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || a.losses - b.losses || a.team.localeCompare(b.team));
        const leader = arr[0];
        for (const s of arr) {
            s.gb = ((leader.wins - s.wins) + (s.losses - leader.losses)) / 2;
        }
        return arr;
    }
    return {
        east: sortConf(EAST),
        west: sortConf(WEST)
    };
}

export const data = new SlashCommandBuilder()
    .setName('standings')
    .setDescription('Show NBA-style conference standings');

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const standings = getStandings();
    if (!standings) {
        return await interaction.editReply('Standings data not available.');
    }
    function formatRow(s, i) {
        return `**${i + 1}. ${s.team}**  ${s.wins}-${s.losses}  (.${String(Math.round(s.winPct * 1000)).padStart(3, '0')})  GB: ${s.gb === 0 ? '-' : s.gb}`;
    }
    const eastRows = standings.east.map(formatRow).join('\n');
    const westRows = standings.west.map(formatRow).join('\n');
    const embed = new EmbedBuilder()
        .setTitle('NBA League Standings')
        .addFields(
            { name: 'Eastern Conference', value: eastRows || 'No games played', inline: false },
            { name: 'Western Conference', value: westRows || 'No games played', inline: false }
        )
        .setColor(0x1D428A)
        .setFooter({ text: 'W-L | Win% | Games Behind (GB)' });
    await interaction.editReply({ embeds: [embed] });
}
