import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } from 'discord.js';
import fs from 'fs';

import path from 'path';

const SEASON_FILE = './data/season.json';
const SCORES_FILE = './data/scores.json';

function readScores() {
    if (!fs.existsSync(SCORES_FILE)) return [];
    return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
}
function writeScores(scores) {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

export const customId = 'submit_score';
export async function execute(interaction) {
    // Robust coach role check with debug logging and coachRoleMap.json
    console.log('[submit_score] DEBUG: execute called by user:', interaction.user.tag, 'ID:', interaction.user.id);
    const channelName = interaction.channel.name;
    const match = channelName.match(/([a-z0-9\-]+)-vs-([a-z0-9\-]+)/);
    if (!match) {
        return interaction.reply({ content: 'This button can only be used in a valid game channel.', ephemeral: true });
    }
    // NBA abbreviation to full team name mapping
    const abbrToFull = {
        PHI: 'Philadelphia 76ers', DET: 'Detroit Pistons', OKC: 'Oklahoma City Thunder', DEN: 'Denver Nuggets', GSW: 'Golden State Warriors', CHA: 'Charlotte Hornets', ORL: 'Orlando Magic', ATL: 'Atlanta Hawks', MIN: 'Minnesota Timberwolves', IND: 'Indiana Pacers', SAC: 'Sacramento Kings', NYK: 'New York Knicks', HOU: 'Houston Rockets', LAC: 'LA Clippers', WAS: 'Washington Wizards', PHX: 'Phoenix Suns', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', MEM: 'Memphis Grizzlies', LAL: 'Los Angeles Lakers', SAS: 'San Antonio Spurs', BKN: 'Brooklyn Nets', MIL: 'Milwaukee Bucks', POR: 'Portland Trail Blazers', NOP: 'New Orleans Pelicans', UTA: 'Utah Jazz', BOS: 'Boston Celtics', MIA: 'Miami Heat', CHI: 'Chicago Bulls', TOR: 'Toronto Raptors'
    };
    const abbr1 = match[1].toUpperCase();
    const abbr2 = match[2].toUpperCase();
    const teamAFull = abbrToFull[abbr1] || abbr1;
    const teamBFull = abbrToFull[abbr2] || abbr2;
    // Load coachRoleMap.json
    let coachRoleMap = {};
    try {
        coachRoleMap = JSON.parse(fs.readFileSync('./data/coachRoleMap.json', 'utf8'));
    } catch (e) {
        console.log('[submit_score] ERROR: Could not read coachRoleMap.json:', e);
    }
    const teamARoleId = coachRoleMap[teamAFull];
    const teamBRoleId = coachRoleMap[teamBFull];
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    // Debug logging
    console.log('[submit_score] Channel:', channelName, '| TeamA:', teamAFull, '| TeamB:', teamBFull);
    console.log('[submit_score] Role IDs from map:', teamARoleId, teamBRoleId);
    console.log('[submit_score] Member roles:', member.roles.cache.map(r => r.name + ' (' + r.id + ')').join(', '));
    if (!teamARoleId && !teamBRoleId) {
        await interaction.reply({ content: 'Coach roles for these teams are not set up. Please contact staff.', ephemeral: true });
        return;
    }
    if (!member.roles.cache.has(teamARoleId) && !member.roles.cache.has(teamBRoleId)) {
        await interaction.reply({ content: 'Only the coaches for this game can submit a score.', ephemeral: true });
        return;
    }
    // Open modal with team names pre-filled
    const modal = new ModalBuilder()
        .setCustomId('submit_score_modal')
        .setTitle('Submit Game Score');
    const teamAInput = new TextInputBuilder()
        .setCustomId('team_a')
        .setLabel('Team A')
        .setStyle(TextInputStyle.Short)
        .setValue(teamAFull)
        .setRequired(true);
    const teamBInput = new TextInputBuilder()
        .setCustomId('team_b')
        .setLabel('Team B')
        .setStyle(TextInputStyle.Short)
        .setValue(teamBFull)
        .setRequired(true);
    const scoreAInput = new TextInputBuilder()
        .setCustomId('score_a')
        .setLabel('Team A Score')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const scoreBInput = new TextInputBuilder()
        .setCustomId('score_b')
        .setLabel('Team B Score')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    modal.addComponents(
        new ActionRowBuilder().addComponents(teamAInput),
        new ActionRowBuilder().addComponents(teamBInput),
        new ActionRowBuilder().addComponents(scoreAInput),
        new ActionRowBuilder().addComponents(scoreBInput)
    );
    await interaction.showModal(modal);
}

// Modal handler
export const modalCustomId = 'submit_score_modal';
export async function handleModal(interaction) {
    const teamA = interaction.fields.getTextInputValue('team_a');
    const teamB = interaction.fields.getTextInputValue('team_b');
    const scoreA = parseInt(interaction.fields.getTextInputValue('score_a'));
    const scoreB = parseInt(interaction.fields.getTextInputValue('score_b'));
    // Determine result type
    let resultType = 'Submit Score';
    if (arguments.length > 1 && typeof arguments[1] === 'string') {
        resultType = arguments[1];
    } else if (interaction.customId === 'force_win_modal') {
        resultType = 'Force Win';
    } else if (interaction.customId === 'sim_result_modal') {
        resultType = 'Sim Result';
    }
    if (isNaN(scoreA) || isNaN(scoreB)) {
        return interaction.reply({ content: 'Scores must be numbers.', ephemeral: true });
    }
    if (scoreA === scoreB) {
        return interaction.reply({ content: 'Ties are not allowed in basketball. Please enter a valid score.', ephemeral: true });
    }
    // Prevent duplicate submissions for this matchup/week
    let seasonNo = null, week = null;
    if (fs.existsSync(SEASON_FILE)) {
        const season = JSON.parse(fs.readFileSync(SEASON_FILE, 'utf8'));
        seasonNo = season.seasonNo || 1;
        const cat = interaction.channel.parent;
        if (cat && cat.name.match(/Week (\d+)/)) {
            week = parseInt(cat.name.match(/Week (\d+)/)[1]);
        }
    }
    if (!week) {
        // Prompt for week if not found
        return interaction.reply({ content: 'Could not infer week. Please contact staff.', ephemeral: true });
    }
    // Only allow one approved score per matchup/week
    const scores = readScores();
    const alreadyLogged = scores.find(s => s.week == week && s.seasonNo == seasonNo && ((s.teamA === teamA && s.teamB === teamB) || (s.teamA === teamB && s.teamB === teamA)) && s.approved);
    if (alreadyLogged) {
        return interaction.reply({ content: 'A score for this matchup has already been approved and logged.', ephemeral: true });
    }
    // Post for approval
    const scheduleTrackerRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'schedule tracker');
    const approveBtn = new ButtonBuilder()
        .setCustomId('approve_score')
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success);
    const denyBtn = new ButtonBuilder()
        .setCustomId('deny_score')
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);
    const embed = new EmbedBuilder()
        .setTitle(`${resultType} Submitted`)
        .addFields(
            { name: teamA, value: scoreA.toString(), inline: true },
            { name: teamB, value: scoreB.toString(), inline: true },
            { name: 'Week', value: week ? week.toString() : 'Unknown', inline: true },
            { name: 'Season', value: seasonNo ? seasonNo.toString() : 'Unknown', inline: true },
            { name: 'Submitted by', value: `<@${interaction.user.id}>`, inline: false },
            { name: 'Result Type', value: resultType, inline: false }
        )
        .setColor(0x00AE86);
    await interaction.reply({
        content: scheduleTrackerRole ? `${scheduleTrackerRole}` : 'Schedule Tracker',
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(approveBtn, denyBtn)],
        ephemeral: false
    });
}

// Approval handler
export async function handleApproval(interaction, approve) {
    if (approve) {
        const teamA = interaction.message.embeds[0].fields[0].name;
        const scoreA = parseInt(interaction.message.embeds[0].fields[0].value);
        const teamB = interaction.message.embeds[0].fields[1].name;
        const scoreB = parseInt(interaction.message.embeds[0].fields[1].value);
        const week = interaction.message.embeds[0].fields[2].value;
        const seasonNo = interaction.message.embeds[0].fields[3].value;
        const submittedBy = interaction.message.embeds[0].fields[4].value;
        const resultType = interaction.message.embeds[0].fields[5]?.value || 'Submit Score';
        const scores = readScores();
        scores.push({ teamA, scoreA, teamB, scoreB, week, seasonNo, submittedBy, resultType, approved: true, approvedBy: interaction.user.id, approvedAt: new Date().toISOString() });
        writeScores(scores);

        // --- Update persistent standings.json ---
        const TEAMS_FILE = './data/teams.json';
        const STANDINGS_FILE = './data/standings.json';
        let teams = [];
        if (fs.existsSync(TEAMS_FILE)) {
            teams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8')).map(t => t.name);
        }
        // Initialize standings
        const standings = {};
        for (const team of teams) {
            standings[team] = { team, wins: 0, losses: 0, winPct: 0, gb: 0 };
        }
        // Calculate wins/losses
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
        // Calculate win %
        for (const team of teams) {
            const s = standings[team];
            const total = s.wins + s.losses;
            s.winPct = total > 0 ? (s.wins / total) : 0;
        }
        // Sort and calculate games behind (GB)
        function sortConf(conf) {
            const arr = conf.filter(t => standings[t]).map(t => standings[t]);
            if (arr.length === 0) return arr;
            arr.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || a.losses - b.losses || a.team.localeCompare(b.team));
            const leader = arr[0];
            for (const s of arr) {
                s.gb = ((leader.wins - s.wins) + (s.losses - leader.losses)) / 2;
            }
            return arr;
        }
        // NBA conference mapping
        const EAST = [
            'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers', 'Detroit Pistons', 'Indiana Pacers', 'Miami Heat', 'Milwaukee Bucks', 'New York Knicks', 'Orlando Magic', 'Philadelphia 76ers', 'Toronto Raptors', 'Washington Wizards'
        ];
        const WEST = [
            'Dallas Mavericks', 'Denver Nuggets', 'Golden State Warriors', 'Houston Rockets', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'Oklahoma City Thunder', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Utah Jazz'
        ];
        const standingsOut = {
            east: sortConf(EAST),
            west: sortConf(WEST)
        };
        fs.writeFileSync(STANDINGS_FILE, JSON.stringify(standingsOut, null, 2));
        // --- End persistent standings update ---

        // --- Update persistent playoffpicture.json ---
        const PLAYOFF_FILE = './data/playoffpicture.json';
        function getPlayoffPicture(confArr) {
            // NBA Playoff logic: Top 6 = Playoff, 7-10 = Play-In
            return {
                playoff: confArr.slice(0, 6),
                playin: confArr.slice(6, 10)
            };
        }
        const playoffOut = {
            east: getPlayoffPicture(standingsOut.east),
            west: getPlayoffPicture(standingsOut.west)
        };
        fs.writeFileSync(PLAYOFF_FILE, JSON.stringify(playoffOut, null, 2));
        // --- End persistent playoffpicture update ---

        await interaction.update({ content: '✅ Score approved and logged!', embeds: interaction.message.embeds, components: [] });
    } else {
        await interaction.update({ content: '❌ Score denied. Please resubmit if needed.', embeds: interaction.message.embeds, components: [] });
    }
}
