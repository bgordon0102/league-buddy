import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import fsPromises from 'fs/promises';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const COACHROLEMAP_FILE = path.join(DATA_DIR, 'coachRoleMap.json');
const SEASON_FILE = path.join(DATA_DIR, 'season.json');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const LEAGUE_FILE = path.join(DATA_DIR, 'league.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

// Use the draft class file directly for big board operations
const BIGBOARD_FILE = path.join(process.cwd(), 'draft classes/CUS01/2k26_CUS01 - Big Board.json');
const SCOUTING_FILE = path.join(DATA_DIR, 'scouting.json');
const RECRUITS_FILE = path.join(DATA_DIR, 'recruits.json');
const SCOUT_POINTS_FILE = path.join(DATA_DIR, 'scout_points.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');

// Helper to write JSON
function writeJSON(file, data) {
    try {
        if (typeof data === 'undefined') {
            console.error(`[writeJSON] Tried to write undefined data to ${file}`);
            return;
        }
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`[writeJSON] Failed to write to ${file}:`, err);
    }
}

// Extracted season reset logic (no Discord interaction)
export function resetSeasonData(seasonno, guild, caller = 'unknown') {
    console.log(`[resetSeasonData] Called from: ${caller}`);
    console.log(`[resetSeasonData] process.cwd():`, process.cwd());
    const gameno = 29;
    // Static NBA team list (shuffled for random schedule)
    const nbaTeams = [
        { id: 1, name: "Atlanta Hawks", abbreviation: "ATL" },
        { id: 2, name: "Boston Celtics", abbreviation: "BOS" },
        { id: 3, name: "Brooklyn Nets", abbreviation: "BKN" },
        { id: 4, name: "Charlotte Hornets", abbreviation: "CHA" },
        { id: 5, name: "Chicago Bulls", abbreviation: "CHI" },
        { id: 6, name: "Cleveland Cavaliers", abbreviation: "CLE" },
        { id: 7, name: "Dallas Mavericks", abbreviation: "DAL" },
        { id: 8, name: "Denver Nuggets", abbreviation: "DEN" },
        { id: 9, name: "Detroit Pistons", abbreviation: "DET" },
        { id: 10, name: "Golden State Warriors", abbreviation: "GSW" },
        { id: 11, name: "Houston Rockets", abbreviation: "HOU" },
        { id: 12, name: "Indiana Pacers", abbreviation: "IND" },
        { id: 13, name: "LA Clippers", abbreviation: "LAC" },
        { id: 14, name: "Los Angeles Lakers", abbreviation: "LAL" },
        { id: 15, name: "Memphis Grizzlies", abbreviation: "MEM" },
        { id: 16, name: "Miami Heat", abbreviation: "MIA" },
        { id: 17, name: "Milwaukee Bucks", abbreviation: "MIL" },
        { id: 18, name: "Minnesota Timberwolves", abbreviation: "MIN" },
        { id: 19, name: "New Orleans Pelicans", abbreviation: "NOP" },
        { id: 20, name: "New York Knicks", abbreviation: "NYK" },
        { id: 21, name: "Oklahoma City Thunder", abbreviation: "OKC" },
        { id: 22, name: "Orlando Magic", abbreviation: "ORL" },
        { id: 23, name: "Philadelphia 76ers", abbreviation: "PHI" },
        { id: 24, name: "Phoenix Suns", abbreviation: "PHX" },
        { id: 25, name: "Portland Trail Blazers", abbreviation: "POR" },
        { id: 26, name: "Sacramento Kings", abbreviation: "SAC" },
        { id: 27, name: "San Antonio Spurs", abbreviation: "SAS" },
        { id: 28, name: "Toronto Raptors", abbreviation: "TOR" },
        { id: 29, name: "Utah Jazz", abbreviation: "UTA" },
        { id: 30, name: "Washington Wizards", abbreviation: "WAS" }
    ];
    // Shuffle for random schedule
    const staticTeams = nbaTeams.map(team => ({ ...team, coach: null }));
    for (let i = staticTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [staticTeams[i], staticTeams[j]] = [staticTeams[j], staticTeams[i]];
    }

    // --- Self-healing file logic ---
    function safeReadJSON(file, fallback) {
        try {
            const data = fs.readFileSync(file, 'utf8');
            if (!data) throw new Error('Empty file');
            return JSON.parse(data);
        } catch {
            console.warn(`[startseason] File ${file} missing or invalid, recreating with defaults.`);
            writeJSON(file, fallback);
            return fallback;
        }
    }

    // Coach Role Map: always try to generate from guild, fallback to file, fallback to all nulls (but always all teams)
    let coachRoleMap = {};
    let usedFallback = false;
    if (guild && guild.roles && guild.roles.cache) {
        for (const team of staticTeams) {
            const nickname = team.name.split(' ').slice(-1)[0];
            let role = guild.roles.cache.find(r => r.name.toLowerCase() === 'ghost paradise');
            if (role) {
                coachRoleMap[team.name] = role.id;
            } else if (team.name === 'Portland Trail Blazers') {
                coachRoleMap[team.name] = '1423036950700626053';
                console.warn(`[startseason] No role found for team ${team.name}, using hardcoded fallback role ID.`);
            } else {
                coachRoleMap[team.name] = null;
                console.warn(`[startseason] No role found for team ${team.name}`);
            }
        }
    }
    // If still empty, fallback to file
    if (Object.keys(coachRoleMap).length === 0) {
        const fileMap = safeReadJSON(COACHROLEMAP_FILE, {});
        for (const team of staticTeams) {
            coachRoleMap[team.name] = fileMap[team.name] || '1428119680572325929';
        }
        usedFallback = true;
    }
    // If still empty, fallback to all nulls (but always all teams)
    if (Object.keys(coachRoleMap).length === 0 || Object.values(coachRoleMap).every(v => v === null)) {
        for (const team of staticTeams) {
            coachRoleMap[team.name] = null;
        }
        usedFallback = true;
        console.warn('[startseason] coachRoleMap fallback: all nulls');
    }
    // Always ensure all teams are present
    for (const team of staticTeams) {
        if (!(team.name in coachRoleMap)) {
            coachRoleMap[team.name] = null;
        }
    }
    console.log('[startseason] Writing coachRoleMap.json:', COACHROLEMAP_FILE, JSON.stringify(coachRoleMap, null, 2));
    writeJSON(COACHROLEMAP_FILE, coachRoleMap);
    console.log('[startseason] Wrote coachRoleMap.json');
    if (usedFallback) {
        console.warn('[startseason] Used fallback for coachRoleMap, check your guild context or role setup.');
    }

    // Schedule
    const schedule = generateWeekBasedSchedule(staticTeams, gameno);
    // Validate schedule: must be non-empty array of arrays
    if (!Array.isArray(schedule) || schedule.length === 0 || !Array.isArray(schedule[0])) {
        console.error('[startseason] Generated schedule is invalid, writing fallback.');
        console.log('[startseason] Writing schedule.json: fallback');
        writeJSON(SCHEDULE_FILE, [{ error: 'No schedule generated' }]);
    } else {
        console.log('[startseason] Writing schedule.json:', SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
        writeJSON(SCHEDULE_FILE, schedule);
        console.log('[startseason] Wrote schedule.json');
    }

    // Teams
    console.log('[startseason] Writing teams.json:', TEAMS_FILE, JSON.stringify(staticTeams, null, 2));
    writeJSON(TEAMS_FILE, staticTeams);
    console.log('[startseason] Wrote teams.json');

    // --- DRAFT CLASS SELECTION LOGIC ---
    // Only use the draft class files for big board and recruiting data
    let recruitingSource;
    if (seasonno === 2) {
        recruitingSource = path.resolve(process.cwd(), 'draft classes/CUS02/2k26_CUS02 - Recruiting.json');
    } else {
        recruitingSource = path.resolve(process.cwd(), 'draft classes/CUS01/2k26_CUS01 - Recruiting.json');
    }
    const recruitingData = safeReadJSON(recruitingSource, []);
    writeJSON(path.join(DATA_DIR, 'recruiting.json'), recruitingData);

    // Standings
    const standings = {};
    staticTeams.forEach(team => {
        standings[team.name] = { wins: 0, losses: 0, games: 0, pointsFor: 0, pointsAgainst: 0 };
    });
    writeJSON(path.join(DATA_DIR, 'standings.json'), standings);

    // Scores: always reset to empty array
    writeJSON(path.join(DATA_DIR, 'scores.json'), []);

    // Season file: always use the freshly generated coachRoleMap
    const seasonData = {
        currentWeek: 0,
        seasonNo: seasonno,
        coachRoleMap: coachRoleMap
    };
    if (!seasonData || typeof seasonData !== 'object' || Object.keys(seasonData).length === 0) {
        console.error('[resetSeasonData] seasonData is invalid, not writing to season.json');
    } else {
        writeJSON(SEASON_FILE, seasonData);
    }

    // League, Players, Bigboard, Scouting, Recruits, Scout Points
    // League: always write a valid league object with seasonNo and teams
    const leagueData = {
        seasonNo: seasonno,
        teams: staticTeams.map(t => ({ id: t.id, name: t.name, abbreviation: t.abbreviation }))
    };
    console.log('[startseason] Writing league.json:', LEAGUE_FILE, JSON.stringify(leagueData, null, 2));
    writeJSON(LEAGUE_FILE, leagueData);
    console.log('[startseason] Wrote league.json');
    writeJSON(PLAYERS_FILE, []);
    writeJSON(SCOUTING_FILE, {});
    writeJSON(RECRUITS_FILE, []);
    writeJSON(SCOUT_POINTS_FILE, {});

    return staticTeams.length;
}

// Generate a week-based round-robin schedule: each team plays one game per week
function generateWeekBasedSchedule(teams, gameno) {
    // Standard round-robin (circle method)
    const n = teams.length;
    const rounds = n - 1;
    const schedule = [];
    let id = 0;
    let teamList = [...teams];
    if (n % 2 !== 0) teamList.push(null); // Add bye if odd
    const numTeams = teamList.length;
    const half = numTeams / 2;
    // Add week 0 (no games)
    schedule.push([]);
    for (let round = 0; round < rounds; round++) {
        const weekGames = [];
        for (let i = 0; i < half; i++) {
            const t1 = teamList[i];
            const t2 = teamList[numTeams - 1 - i];
            if (t1 && t2) {
                weekGames.push({ id: id++, team1: t1, team2: t2 });
            }
        }
        schedule.push(weekGames);
        // Rotate teams (except first)
        teamList = [teamList[0], teamList[numTeams - 1], ...teamList.slice(1, numTeams - 1)];
    }
    // Only single round robin (29 games per team)
    return schedule;
}

// Discord command builder and execute function
export const data = new SlashCommandBuilder()
    .setName('startseason')
    .setDescription('Start a new NBA 2K season. If data exists, you will be prompted to confirm reset.')
    .addIntegerOption(option =>
        option.setName('seasonno')
            .setDescription('Season number')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

import { DataManager } from '../../utils/dataManager.js';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const dataManager = new DataManager();
    // fs and path are already imported at the top as ES modules
    const SEASON_FILE = path.join(process.cwd(), 'data', 'season.json');
    try {
        // --- Unpin old standings/playoff messages and pin new reset ones ---
        const standingsChannelId = '1428159168904167535';
        const playoffChannelId = '1428159324341141576';
        const guild = interaction.guild;
        async function resetPinnedEmbed(channelId, embedArr, envKey = null) {
            try {
                const channel = await guild.channels.fetch(channelId);
                if (!channel) return;
                const pins = await channel.messages.fetchPinned();
                for (const msg of pins.values()) {
                    if (msg.author.id === guild.client.user.id) {
                        await msg.unpin();
                        await msg.delete();
                    }
                }
                const sentMsg = await channel.send({ embeds: embedArr });
                await sentMsg.pin();
                // If envKey is provided, update .env with the new message ID
                if (envKey) {
                    const envPath = path.resolve(process.cwd(), '.env');
                    let envContent = '';
                    try {
                        envContent = await fsPromises.readFile(envPath, 'utf8');
                    } catch { }
                    const regex = new RegExp(`^${envKey}=.*$`, 'm');
                    if (regex.test(envContent)) {
                        envContent = envContent.replace(regex, `${envKey}=${sentMsg.id}`);
                    } else {
                        envContent += `\n${envKey}=${sentMsg.id}`;
                    }
                    await fsPromises.writeFile(envPath, envContent, 'utf8');
                }
            } catch (err) {
                console.error('Failed to reset pinned message in channel', channelId, err);
            }
        }
        // Blank/reset standings embed
        const blankStandingsEmbed = new (await import('discord.js')).EmbedBuilder()
            .setTitle('NBA League Standings')
            .addFields(
                { name: 'Eastern Conference', value: 'No games played', inline: false },
                { name: 'Western Conference', value: 'No games played', inline: false }
            )
            .setColor(0x1D428A)
            .setFooter({ text: 'W-L | Win% | Games Behind (GB)' });
        await resetPinnedEmbed(standingsChannelId, [blankStandingsEmbed], 'STANDINGS_PINNED_MESSAGE_ID');
        // Blank/reset playoff picture embeds
        const blankEastEmbed = new (await import('discord.js')).EmbedBuilder()
            .setTitle('🏆 Eastern Conference Playoff Bracket')
            .addFields(
                { name: 'Playoff Matchups', value: 'No games played', inline: false },
                { name: 'Play-In Matchups', value: 'No games played', inline: false }
            )
            .setColor(0x1D428A)
            .setFooter({ text: 'Top 6: Playoff | 7-10: Play-In' });
        const blankWestEmbed = new (await import('discord.js')).EmbedBuilder()
            .setTitle('🏆 Western Conference Playoff Bracket')
            .addFields(
                { name: 'Playoff Matchups', value: 'No games played', inline: false },
                { name: 'Play-In Matchups', value: 'No games played', inline: false }
            )
            .setColor(0xE03A3E)
            .setFooter({ text: 'Top 6: Playoff | 7-10: Play-In' });
        await resetPinnedEmbed(playoffChannelId, [blankEastEmbed, blankWestEmbed]);
        // Check if season.json exists and is non-empty
        let seasonExists = false;
        try {
            const stats = fs.statSync(SEASON_FILE);
            if (stats.size > 10) seasonExists = true;
        } catch { }
        if (seasonExists) {
            // Show confirmation button with season number in customId
            const seasonno = interaction.options.getInteger('seasonno');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`startseason_confirm_${seasonno}`)
                    .setLabel('Are you sure? This will reset all season data!')
                    .setStyle(ButtonStyle.Danger)
            );
            await interaction.editReply({
                content: 'Season data already exists. Are you sure you want to reset everything?',
                components: [row],
                ephemeral: true
            });
            return;
        }
        // ...existing code for season initialization...
        const seasonno = interaction.options.getInteger('seasonno');
        const nbaTeams = [
            { id: 1, name: "Atlanta Hawks", abbreviation: "ATL" },
            { id: 2, name: "Boston Celtics", abbreviation: "BOS" },
            { id: 3, name: "Brooklyn Nets", abbreviation: "BKN" },
            { id: 4, name: "Charlotte Hornets", abbreviation: "CHA" },
            { id: 5, name: "Chicago Bulls", abbreviation: "CHI" },
            { id: 6, name: "Cleveland Cavaliers", abbreviation: "CLE" },
            { id: 7, name: "Dallas Mavericks", abbreviation: "DAL" },
            { id: 8, name: "Denver Nuggets", abbreviation: "DEN" },
            { id: 9, name: "Detroit Pistons", abbreviation: "DET" },
            { id: 10, name: "Golden State Warriors", abbreviation: "GSW" },
            { id: 11, name: "Houston Rockets", abbreviation: "HOU" },
            { id: 12, name: "Indiana Pacers", abbreviation: "IND" },
            { id: 13, name: "LA Clippers", abbreviation: "LAC" },
            { id: 14, name: "Los Angeles Lakers", abbreviation: "LAL" },
            { id: 15, name: "Memphis Grizzlies", abbreviation: "MEM" },
            { id: 16, name: "Miami Heat", abbreviation: "MIA" },
            { id: 17, name: "Milwaukee Bucks", abbreviation: "MIL" },
            { id: 18, name: "Minnesota Timberwolves", abbreviation: "MIN" },
            { id: 19, name: "New Orleans Pelicans", abbreviation: "NOP" },
            { id: 20, name: "New York Knicks", abbreviation: "NYK" },
            { id: 21, name: "Oklahoma City Thunder", abbreviation: "OKC" },
            { id: 22, name: "Orlando Magic", abbreviation: "ORL" },
            { id: 23, name: "Philadelphia 76ers", abbreviation: "PHI" },
            { id: 24, name: "Phoenix Suns", abbreviation: "PHX" },
            { id: 25, name: "Portland Trail Blazers", abbreviation: "POR" },
            { id: 26, name: "Sacramento Kings", abbreviation: "SAC" },
            { id: 27, name: "San Antonio Spurs", abbreviation: "SAS" },
            { id: 28, name: "Toronto Raptors", abbreviation: "TOR" },
            { id: 29, name: "Utah Jazz", abbreviation: "UTA" },
            { id: 30, name: "Washington Wizards", abbreviation: "WAS" }
        ];
        const staticTeams = nbaTeams.map(team => ({ ...team, coach: null }));
        for (let i = staticTeams.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [staticTeams[i], staticTeams[j]] = [staticTeams[j], staticTeams[i]];
        }
        let coachRoleMap = {};
        staticTeams.forEach(team => { coachRoleMap[team.name] = null; });
        const standings = {};
        staticTeams.forEach(team => {
            standings[team.name] = { wins: 0, losses: 0, games: 0, pointsFor: 0, pointsAgainst: 0 };
        });
        const prospectBoards = [];
        const recruitingData = [];
        const seasonData = {
            currentWeek: 0,
            seasonNo: seasonno,
            coachRoleMap: coachRoleMap
        };
        dataManager.writeData('season', seasonData);
        dataManager.writeData('teams', staticTeams);
        dataManager.writeData('standings', standings);
        dataManager.writeData('scores', []);
        dataManager.writeData('prospectBoards', prospectBoards);
        dataManager.writeData('recruiting', recruitingData);
        await interaction.editReply({ content: `Season ${seasonData.seasonNo} started! All data initialized.` });
    } catch (err) {
        console.error('[startseason] Error:', err);
        await interaction.editReply({ content: 'Error starting season.' });
    }
}