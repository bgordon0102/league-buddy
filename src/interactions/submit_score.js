// Required for Discord interaction loader
export const customId = 'submit_score';
export const execute = handleButton;
// Handler for Force Win button
// Shared team name autofill function (top-level)
function getTeamNamesFromChannel(channelName) {
    const abbrToFull = {
        ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers', LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat', MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards'
    };
    let teamAName = '';
    let teamBName = '';
    const parts = channelName.split(/-vs-/i).map(s => s.replace(/-w\d+|-week\d+/i, '').trim());
    if (parts.length === 2) {
        let abbr1 = parts[0].split('-')[0].toUpperCase();
        let abbr2 = parts[1].split('-')[0].toUpperCase();
        teamAName = abbrToFull[abbr1] || abbr1;
        teamBName = abbrToFull[abbr2] || abbr2;
    }
    return [teamAName, teamBName];
}

export async function handleForceWin(interaction) {
    // Only staff/schedule tracker can use
    const guild = interaction.guild;
    const scheduleTrackerRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'schedule tracker');
    // Update commish role lookup to use new name and ID
    const commishRole = guild.roles.cache.find(r => r.name === 'Paradise Commish' || r.id === '1427896861934485575');
    const member = await guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(scheduleTrackerRole?.id) && !member.roles.cache.has(commishRole?.id)) {
        await interaction.reply({ content: 'Only staff, Paradise Commish, or schedule tracker can use Force Win.', ephemeral: true });
        return;
    }
    // Standardized team name autofill
    const [teamAName, teamBName] = getTeamNamesFromChannel(interaction.channel.name);
    const modal = new ModalBuilder()
        .setCustomId('force_win_modal')
        .setTitle('Force Win: Enter Result');
    const teamA = new TextInputBuilder()
        .setCustomId('team_a')
        .setLabel('Team A')
        .setStyle(TextInputStyle.Short)
        .setValue(teamAName)
        .setRequired(true);
    const teamB = new TextInputBuilder()
        .setCustomId('team_b')
        .setLabel('Team B')
        .setStyle(TextInputStyle.Short)
        .setValue(teamBName)
        .setRequired(true);
    const scoreA = new TextInputBuilder()
        .setCustomId('score_a')
        .setLabel('Team A Score')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const scoreB = new TextInputBuilder()
        .setCustomId('score_b')
        .setLabel('Team B Score')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const weekInput = new TextInputBuilder()
        .setCustomId('week')
        .setLabel('Week Number')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    modal.addComponents(
        new ActionRowBuilder().addComponents(teamA),
        new ActionRowBuilder().addComponents(teamB),
        new ActionRowBuilder().addComponents(scoreA),
        new ActionRowBuilder().addComponents(scoreB),
        new ActionRowBuilder().addComponents(weekInput)
    );
    await interaction.showModal(modal);
}

// --- Approval handling and post-approval background updates ---
export async function handleApproval(interaction, approve) {
    try {
        console.log('[submit_score] handleApproval called by', interaction.user.tag, interaction.user.id, 'approve=', approve, 'messageId=', interaction.message?.id);

        // Defer the interaction immediately to keep it alive
        try { await interaction.deferUpdate(); } catch (e) { /* already deferred/acknowledged */ }

        // Ensure we have an embed from the message to parse
        const embed = interaction.message?.embeds && interaction.message.embeds[0];
        if (!embed) {
            console.warn('[submit_score] handleApproval: no embed found on approval message');
            return;
        }

        // Robustly read fields by label when possible
        const findField = (label) => (embed.fields || []).find(f => f.name && f.name.toLowerCase().includes(label.toLowerCase()));
        const teamAField = embed.fields && embed.fields[0];
        const teamBField = embed.fields && embed.fields[1];
        const weekField = findField('week') || embed.fields && embed.fields[2];
        const submittedByField = findField('submitted by') || embed.fields && embed.fields[3];

        const teamA = teamAField ? teamAField.name : (teamAField?.name || 'Unknown');
        const scoreA = teamAField ? parseInt(teamAField.value) : NaN;
        const teamB = teamBField ? teamBField.name : (teamBField?.name || 'Unknown');
        const scoreB = teamBField ? parseInt(teamBField.value) : NaN;
        const week = weekField ? (weekField.value || 'Unknown') : 'Unknown';
        const submittedBy = submittedByField ? (submittedByField.value || `Unknown`) : `Unknown`;
        const seasonNo = 1; // default available elsewhere

        console.log('[submit_score] Approval parsed:', { teamA, scoreA, teamB, scoreB, week, submittedBy, seasonNo });

        if (approve) {
            // Load existing submissions and try to find a matching pending submission to mark approved
            const scores = readScores();
            let matched = false;
            for (const s of scores) {
                // match by teams and week and not already approved
                if (!s.approved && s.week && String(s.week) === String(week) && ((s.teamA === teamA && s.teamB === teamB) || (s.teamA === teamB && s.teamB === teamA))) {
                    s.approved = true;
                    s.approvedBy = interaction.user.id;
                    s.approvedAt = new Date().toISOString();
                    matched = true;
                    console.log('[submit_score] Matched pending submission, marking approved:', s);
                    break;
                }
            }
            if (!matched) {
                // Not found: add new approved record
                const newRec = { teamA, scoreA, teamB, scoreB, week, seasonNo, submittedBy, approved: true, approvedBy: interaction.user.id, approvedAt: new Date().toISOString() };
                scores.push(newRec);
                console.log('[submit_score] No pending submission matched; added new approved record:', newRec);
            }

            try {
                writeScores(scores);
                console.log('[submit_score] scores.json updated successfully');
            } catch (writeErr) {
                console.error('[submit_score] Failed to write scores.json:', writeErr);
            }

            // Update the approval message (ignore errors if already acknowledged)
            try {
                await interaction.editReply({ content: '✅ Score approved and logged!', embeds: interaction.message.embeds, components: [] });
            } catch (updateErr) {
                console.error('[submit_score] Failed to edit approval message:', updateErr);
            }

            // Standings update now only happens on advance week
        } else {
            try {
                await interaction.editReply({ content: '❌ Score denied. Please resubmit if needed.', embeds: interaction.message.embeds, components: [] });
            } catch (denyErr) {
                console.error('[submit_score] Failed to edit deny message:', denyErr);
            }
        }
    } catch (err) {
        console.error('[submit_score] ERROR in handleApproval:', err);
    }
}

export async function updateStandingsAndPlayoff(guild) {
    try {
        // Direct standings calculation and update
        const fs = await import('fs');
        const teams = JSON.parse(fs.default.readFileSync('./data/teams.json', 'utf8'));
        const scores = JSON.parse(fs.default.readFileSync('./data/scores.json', 'utf8'));
        // Only use approved scores, deduplicated by matchup and week
        const approvedScores = scores.filter(s => s.approved);
        // Deduplicate: key = [week, teamA, teamB] sorted
        const uniqueScoresMap = new Map();
        for (const s of approvedScores) {
            const teams = [s.teamA.trim().toUpperCase(), s.teamB.trim().toUpperCase()].sort();
            const key = `${s.week}|${teams[0]}|${teams[1]}`;
            if (!uniqueScoresMap.has(key)) {
                uniqueScoresMap.set(key, s);
            }
        }
        const uniqueScores = Array.from(uniqueScoresMap.values());
        // Initialize standings
        const standings = {};
        for (const team of teams) {
            standings[team.name] = {
                wins: 0,
                losses: 0,
                games: 0,
                pointsFor: 0,
                pointsAgainst: 0
            };
        }
        // Helper to match team names flexibly
        function matchTeam(name) {
            name = name.trim().toUpperCase();
            for (const team of teams) {
                if (team.name.toUpperCase() === name || team.abbreviation === name || team.name.toUpperCase().includes(name)) {
                    return team.name;
                }
            }
            return name;
        }
        // Calculate standings
        for (const s of uniqueScores) {
            const teamA = matchTeam(s.teamA);
            const teamB = matchTeam(s.teamB);
            if (!standings[teamA] || !standings[teamB]) continue;
            standings[teamA].games++;
            standings[teamB].games++;
            standings[teamA].pointsFor += Number(s.scoreA);
            standings[teamA].pointsAgainst += Number(s.scoreB);
            standings[teamB].pointsFor += Number(s.scoreB);
            standings[teamB].pointsAgainst += Number(s.scoreA);
            if (Number(s.scoreA) > Number(s.scoreB)) {
                standings[teamA].wins++;
                standings[teamB].losses++;
            } else {
                standings[teamB].wins++;
                standings[teamA].losses++;
            }
        }
        // Write updated standings to standings.json
        fs.default.writeFileSync('./data/standings.json', JSON.stringify(standings, null, 2));

        // Conference split
        const eastTeams = [
            'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers', 'Detroit Pistons', 'Indiana Pacers', 'Miami Heat', 'Milwaukee Bucks', 'New York Knicks', 'Orlando Magic', 'Philadelphia 76ers', 'Toronto Raptors', 'Washington Wizards'
        ];
        const westTeams = [
            'Dallas Mavericks', 'Denver Nuggets', 'Golden State Warriors', 'Houston Rockets', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'Oklahoma City Thunder', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Utah Jazz'
        ];
        // Prepare rows
        function formatRow(team, s, i) {
            const winPct = s.games > 0 ? s.wins / s.games : 0;
            return `**${i + 1}. ${team}**  ${s.wins}-${s.losses}  (.${String(Math.round(winPct * 1000)).padStart(3, '0')})`;
        }
        // Sort by wins, then winPct
        const eastSorted = eastTeams.map(t => ({ team: t, ...standings[t] })).sort((a, b) => b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games));
        const westSorted = westTeams.map(t => ({ team: t, ...standings[t] })).sort((a, b) => b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games));
        const eastRows = eastSorted.map((s, i) => formatRow(s.team, s, i)).join('\n');
        const westRows = westSorted.map((s, i) => formatRow(s.team, s, i)).join('\n');
        const standingsEmbed = new EmbedBuilder()
            .setTitle('NBA League Standings')
            .addFields(
                { name: 'Eastern Conference', value: eastRows || 'No games played', inline: false },
                { name: 'Western Conference', value: westRows || 'No games played', inline: false }
            )
            .setColor(0x1D428A)
            .setFooter({ text: 'W-L | Win%' });
        const standingsChannelId = process.env.STANDINGS_CHANNEL_ID || '1428159168904167535';
        const standingsPinnedMessageId = process.env.STANDINGS_PINNED_MESSAGE_ID || null;
        async function updatePinnedEmbed(channelId, embedArr, pinnedMessageId) {
            try {
                const channel = await guild.channels.fetch(channelId);
                if (!channel) return;
                let pinnedMsg = null;
                if (pinnedMessageId) {
                    try {
                        pinnedMsg = await channel.messages.fetch(pinnedMessageId);
                    } catch (e) {
                        console.warn('[submit_score] Could not fetch pinned message by ID:', pinnedMessageId, e);
                    }
                }
                if (!pinnedMsg) {
                    const pins = await channel.messages.fetchPinned();
                    pinnedMsg = pins.find(m => m.author?.id === guild.client.user.id);
                }
                if (pinnedMsg) {
                    await pinnedMsg.edit({ embeds: embedArr });
                } else {
                    const sentMsg = await channel.send({ embeds: embedArr });
                    await sentMsg.pin();
                }
            } catch (err) {
                console.error('[submit_score] Failed to update pinned message in channel', channelId, err);
            }
        }
        await updatePinnedEmbed(standingsChannelId, [standingsEmbed], standingsPinnedMessageId);
    } catch (err) {
        console.error('[submit_score] updateStandingsOnly error:', err);
    }
}

// Handler for Sim Result button
export async function handleSimResult(interaction) {
    // Only staff/schedule tracker can use
    const guild = interaction.guild;
    const scheduleTrackerRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'schedule tracker');
    const commishRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'commish');
    const member = await guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(scheduleTrackerRole?.id) && !member.roles.cache.has(commishRole?.id)) {
        await interaction.reply({ content: 'Only staff or schedule tracker can use Sim Result.', ephemeral: true });
        return;
    }
    // Standardized team name autofill
    const [teamAName, teamBName] = getTeamNamesFromChannel(interaction.channel.name);
    const modal = new ModalBuilder()
        .setCustomId('sim_result_modal')
        .setTitle('Sim Result: Enter Result');
    const teamA = new TextInputBuilder()
        .setCustomId('team_a')
        .setLabel('Team A')
        .setStyle(TextInputStyle.Short)
        .setValue(teamAName)
        .setRequired(true);
    const teamB = new TextInputBuilder()
        .setCustomId('team_b')
        .setLabel('Team B')
        .setStyle(TextInputStyle.Short)
        .setValue(teamBName)
        .setRequired(true);
    const scoreA = new TextInputBuilder()
        .setCustomId('score_a')
        .setLabel('Team A Score')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const scoreB = new TextInputBuilder()
        .setCustomId('score_b')
        .setLabel('Team B Score')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const weekInput = new TextInputBuilder()
        .setCustomId('week')
        .setLabel('Week Number')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    modal.addComponents(
        new ActionRowBuilder().addComponents(teamA),
        new ActionRowBuilder().addComponents(teamB),
        new ActionRowBuilder().addComponents(scoreA),
        new ActionRowBuilder().addComponents(scoreB),
        new ActionRowBuilder().addComponents(weekInput)
    );
    await interaction.showModal(modal);
}
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, ChannelType, InteractionType } from 'discord.js';
import fs from 'fs';

const SEASON_FILE = './data/season.json';
const SCORES_FILE = './data/scores.json';

// In-memory short-lived locks to prevent duplicate approval posts for the same game
const pendingSubmissionKeys = new Set();

// Helper to read/write scores
function readScores() {
    if (!fs.existsSync(SCORES_FILE)) return [];
    return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
}
function writeScores(scores) {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

export async function sendWelcomeAndButton(channel, week, seasonNo) {
    // Tag both coach roles using coachRoleMap.json and full team names
    let coachTags = [];
    try {
        const abbrToFull = {
            ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers', LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat', MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards'
        };
        const parts = channel.name.split(/-vs-/i).map(s => s.replace(/-w\d+|-week\d+/i, '').trim());
        if (parts.length === 2) {
            // Accept either abbreviation or full team name
            function getFullTeam(str) {
                const upper = str.split('-')[0].toUpperCase();
                if (abbrToFull[upper]) return abbrToFull[upper];
                // Try to match full team name
                for (const abbr in abbrToFull) {
                    if (abbrToFull[abbr].toUpperCase().includes(upper)) return abbrToFull[abbr];
                }
                return str;
            }
            const team1Full = getFullTeam(parts[0]);
            const team2Full = getFullTeam(parts[1]);
            let coachRoleMap = {};
            try {
                const guildId = process.env.DISCORD_GUILD_ID;
                let coachRoleMapFile = './data/coachRoleMap.json';
                if (guildId === '1415452215044473036') {
                    coachRoleMapFile = './data/coachRoleMap.main.json';
                } else if (guildId === '1407111281147641976') {
                    coachRoleMapFile = './data/coachRoleMap.dev.json';
                }
                coachRoleMap = JSON.parse(fs.readFileSync(coachRoleMapFile, 'utf8'));
            } catch (err) { }
            const normalize = str => str.replace(/\s+/g, ' ').trim().toLowerCase();
            const guildRoles = channel.guild ? channel.guild.roles.cache : (channel.roles ? channel.roles.cache : []);
            let tag1 = coachRoleMap[team1Full] ? `<@&${coachRoleMap[team1Full]}>` : '';
            let tag2 = coachRoleMap[team2Full] ? `<@&${coachRoleMap[team2Full]}>` : '';
            if (!tag1) {
                const normalizedRoleName1 = normalize(`${team1Full} Coach`);
                const foundRole1 = guildRoles.find(r => normalize(r.name) === normalizedRoleName1);
                if (foundRole1) tag1 = `<@&${foundRole1.id}>`;
            }
            if (!tag2) {
                const normalizedRoleName2 = normalize(`${team2Full} Coach`);
                const foundRole2 = guildRoles.find(r => normalize(r.name) === normalizedRoleName2);
                if (foundRole2) tag2 = `<@&${foundRole2.id}>`;
            }
            // Deduplicate and join tags
            coachTags = Array.from(new Set([tag1, tag2].filter(Boolean)));
        }
    } catch (err) { }
    const submitBtn = new ButtonBuilder()
        .setCustomId('submit_score')
        .setLabel('Submit Score')
        .setStyle(ButtonStyle.Primary);
    const forceWinBtn = new ButtonBuilder()
        .setCustomId('force_win')
        .setLabel('Force Win')
        .setStyle(ButtonStyle.Success);
    const simResultBtn = new ButtonBuilder()
        .setCustomId('sim_result')
        .setLabel('Sim Result')
        .setStyle(ButtonStyle.Secondary);
    // 24-hour countdown from now (always from message send time)
    const deadline = Math.floor(Date.now() / 1000) + 24 * 3600;
    let content = '';
    if (coachTags.length > 0) {
        content += `Welcome ${coachTags.join(' ')}!\n`;
    } else {
        content += `Welcome coaches!\n`;
    }
    content += '**Sim Schedule & Game Results**\n';
    content += '- Sims run daily at 8:00 PM EST.\n';
    content += '- All games must be played before the next sim.\n';
    content += '- If a game isn’t played:\n';
    content += '  - **Force Win/Loss:** Awarded if one coach is active and the other is inactive.\n';
    content += '  - **Sim Result:** Used if both teams fail to play or agree to a sim.\n';
    content += '- No postponements or deferrals.\n';
    content += '- Repeated inactivity may lead to removal.\n';
    content += '- All force and sim results are final and logged.\n\n';
    content += `:alarm_clock: **Score must be submitted within <t:${deadline}:R> (<t:${deadline}:f>)**`;
    try {
        // Only include tags once: content already contains a welcome line when coachTags exist
        await channel.send({
            content: `${content}`.trim(),
            components: [new ActionRowBuilder().addComponents(submitBtn, forceWinBtn, simResultBtn)]
        });
    } catch (err) { }
}

// Modal submit handler
export async function handleModal(interaction, mode) {
    try {
        // If this modal is for Force Win or Sim Result, enforce staff-only access
        if (mode === 'Force Win' || mode === 'Sim Result') {
            const guild = interaction.guild;
            const member = await guild.members.fetch(interaction.user.id);
            const staffRoleNames = ['Commish', 'Paradise Commish', 'Schedule Tracker', 'Admin', 'Gameplay Mod', 'Trade Committee'];
            const hasStaffRole = member.roles.cache.some(r => staffRoleNames.map(n => n.toLowerCase()).includes(r.name.toLowerCase()));
            if (!hasStaffRole) {
                // Friendly message to non-staff users
                return interaction.reply({ content: `Only staff members (Commish or Schedule Tracker) can use ${mode}. If you believe this is an error, please contact a staff member.`, ephemeral: true });
            }
        }
        const teamA = interaction.fields.getTextInputValue('team_a');
        const teamB = interaction.fields.getTextInputValue('team_b');
        const scoreA = parseInt(interaction.fields.getTextInputValue('score_a'));
        const scoreB = parseInt(interaction.fields.getTextInputValue('score_b'));
        const week = interaction.fields.getTextInputValue('week') || 'Unknown';

        if (isNaN(scoreA) || isNaN(scoreB)) {
            return interaction.reply({ content: 'Scores must be numbers.', ephemeral: true });
        }
        if (scoreA === scoreB) {
            return interaction.reply({ content: 'Ties are not allowed. Please enter a valid score.', ephemeral: true });
        }

        // Save as pending submission
        const scores = readScores();
        const submission = { teamA, scoreA, teamB, scoreB, week, seasonNo: 1, submittedBy: `<@${interaction.user.id}>`, approved: false, submittedAt: new Date().toISOString() };
        scores.push(submission);
        writeScores(scores);

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
            .setTitle(`Submit Score`)
            .addFields(
                { name: teamA, value: String(scoreA), inline: true },
                { name: teamB, value: String(scoreB), inline: true },
                { name: 'Week', value: String(week), inline: true },
                { name: 'Submitted by', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setColor(0x00AE86);

        // Send approval message to the same channel (non-ephemeral) and tag Schedule Tracker
        const scheduleTrackerMention = scheduleTrackerRole ? `<@&${scheduleTrackerRole.id}>` : '';

        // Build a stable key for this submission to avoid double-posting when the modal is submitted twice
        const dedupeKey = `${interaction.channel.id}:${teamA}:${teamB}:${week}`;
        console.log(`[submit_score] MODAL SUBMIT: dedupeKey=${dedupeKey} user=${interaction.user.tag} (${interaction.user.id}) channel=${interaction.channel.id}`);
        if (pendingSubmissionKeys.has(dedupeKey)) {
            console.warn(`[submit_score] DUPLICATE IN-PROGRESS: dedupeKey=${dedupeKey} user=${interaction.user.tag}`);
            try { await interaction.reply({ content: 'Submission already in progress — please wait a moment.', ephemeral: true }); } catch (e) { console.error('[submit_score] Failed to reply duplicate in-progress:', e); }
            return;
        }
        pendingSubmissionKeys.add(dedupeKey);

        // Deduplicate: check recent bot messages in this channel for an identical approval embed
        try {
            const recent = await interaction.channel.messages.fetch({ limit: 50 });
            const botMsgs = recent.filter(m => m.author?.id === interaction.client.user.id && m.embeds && m.embeds.length);
            let found = null;
            for (const m of botMsgs.values()) {
                const e = m.embeds[0];
                if (!e) continue;
                if (e.title === embed.data.title) {
                    // compare fields by name/value pairs
                    const aFields = (e.fields || []).map(f => `${f.name}:${f.value}`).join('|');
                    const bFields = (embed.data.fields || []).map(f => `${f.name}:${f.value}`).join('|');
                    if (aFields === bFields) {
                        found = m;
                        break;
                    }
                }
            }
            if (found) {
                console.warn(`[submit_score] DEDUPE HIT: Found existing approval post for dedupeKey=${dedupeKey} messageId=${found.id} url=${found.url}`);
                // Don't post duplicate; point user to existing approval message
                try {
                    await interaction.reply({ content: `This score was already submitted for approval: ${found.url}`, ephemeral: true });
                } catch (rErr) {
                    console.error('[submit_score] Failed to send duplicate-submit reply:', rErr);
                }
                pendingSubmissionKeys.delete(dedupeKey);
                return;
            } else {
                console.log(`[submit_score] DEDUPE MISS: No existing approval post for dedupeKey=${dedupeKey}`);
            }
        } catch (fetchErr) {
            console.error('[submit_score] Failed to fetch recent messages for dedupe check:', fetchErr);
        }

        let replySucceeded = false;
        try {
            await interaction.reply({ content: 'Score submitted for approval.', ephemeral: true });
            replySucceeded = true;
        } catch (err) {
            console.error('[submit_score] ERROR replying to modal submit:', err);
        }
        if (replySucceeded) {
            try {
                const sentMsg = await interaction.channel.send({
                    content: scheduleTrackerMention,
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(approveBtn, denyBtn)],
                    allowedMentions: { parse: ['roles'] }
                });
                console.log(`[submit_score] APPROVAL POSTED: dedupeKey=${dedupeKey} messageId=${sentMsg.id} url=${sentMsg.url}`);
            } catch (sendErr) {
                console.error('[submit_score] ERROR sending approval post:', sendErr);
            }
        } else {
            console.warn('[submit_score] Skipped approval post due to failed reply (likely duplicate modal submit or expired interaction).');
        }
        pendingSubmissionKeys.delete(dedupeKey);
    } catch (err) {
        console.error('[submit_score] ERROR in handleModal:', err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'There was an error while executing this modal!', ephemeral: true });
            } else {
                await interaction.editReply({ content: 'There was an error while executing this modal!' });
            }
        } catch (replyErr) {
            console.error('[submit_score] Failed to send modal error reply:', replyErr);
        }
    }
}

export async function handleButton(interaction) {
    try {
        let threadName = interaction.channel?.name;
        let channelType = interaction.channel?.type;
        const channelId = interaction.channel?.id;
        const threadId = interaction.thread?.id || interaction.channel?.thread?.id;
        const messageId = interaction.message?.id;
        // Fallbacks for Discord.js v14+ thread/channel API
        if (!threadName && interaction.thread?.name) threadName = interaction.thread.name;
        if (!threadName && interaction.channel?.thread?.name) threadName = interaction.channel.thread.name;
        console.log('[submit_score] DEBUG: handleButton called by user:', interaction.user.tag, 'ID:', interaction.user.id, 'channelId:', channelId, 'threadId:', threadId, 'messageId:', messageId, 'channelName:', threadName, 'channelType:', channelType);
        if (!threadName) {
            await interaction.reply({ content: 'Unable to determine channel name. Please contact an admin.', ephemeral: true });
            return;
        }
        if (!threadName.toLowerCase().includes('-vs-')) {
            // Instead of blocking, allow modal to open but warn in logs
            console.warn('[submit_score] WARNING: Channel name does not contain -vs-:', threadName);
        }
        // Standardized team name autofill
        // ...existing code...
        // Use shared autofill function and avoid redeclaring threadName/channelType
        const [teamAName, teamBName] = getTeamNamesFromChannel(interaction.channel?.name || interaction.thread?.name || (interaction.channel?.thread?.name) || '');
        const modal = new ModalBuilder()
            .setCustomId('submit_score_modal')
            .setTitle('Submit Game Score');
        try {
            let threadName = interaction.channel?.name;
            let channelType = interaction.channel?.type;
            // Fallbacks for Discord.js v14+ thread/channel API
            if (!threadName && interaction.thread?.name) threadName = interaction.thread.name;
            if (!threadName && interaction.channel?.thread?.name) threadName = interaction.channel.thread.name;

            console.log('[submit_score] DEBUG: handleButton called by user:', interaction.user.tag, 'ID:', interaction.user.id, 'channelName:', threadName, 'channelType:', channelType);

            // Always try to build the modal, even if threadName is missing or can't be parsed
            if (!threadName) {
                console.warn('[submit_score] WARNING: Could not determine channel name at all.');
            }

            let team1Full = '';
            let team2Full = '';
            const abbrToFull = {
                ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers',
                DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets',
                IND: 'Indiana Pacers', LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat', MIL: 'Milwaukee Bucks',
                MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic',
                PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs',
                TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards'
            };

            if (threadName && threadName.toLowerCase().includes('-vs-')) {
                let parts = threadName.split(/-vs-/i).map(s => s.replace(/-w\d+|-week\d+/i, '').trim());
                parts = parts.filter(Boolean);
                if (parts.length < 2) {
                    console.warn('[submit_score] WARNING: Could not determine both teams from thread name:', threadName);
                }
                function getFullTeam(str) {
                    if (!str) return '';
                    const upper = str.split('-')[0].toUpperCase();
                    if (abbrToFull[upper]) return abbrToFull[upper];
                    for (const abbr in abbrToFull) {
                        if (abbrToFull[abbr].toUpperCase().includes(upper)) return abbrToFull[abbr];
                    }
                    return str;
                }
                team1Full = parts[0] ? getFullTeam(parts[0]) : '';
                team2Full = parts[1] ? getFullTeam(parts[1]) : '';
            } else {
                if (threadName) {
                    console.warn('[submit_score] WARNING: Channel name does not contain -vs-:', threadName);
                }
            }

            // Always build the modal, even if team names are blank

            // Use shared autofill and labels for consistency
            const [teamAName, teamBName] = getTeamNamesFromChannel(threadName || '');
            const modal = new ModalBuilder()
                .setCustomId('submit_score_modal')
                .setTitle('Submit Game Score');

            const teamA = new TextInputBuilder()
                .setCustomId('team_a')
                .setLabel('Team A')
                .setStyle(TextInputStyle.Short)
                .setValue(teamAName)
                .setRequired(true);

            const teamB = new TextInputBuilder()
                .setCustomId('team_b')
                .setLabel('Team B')
                .setStyle(TextInputStyle.Short)
                .setValue(teamBName)
                .setRequired(true);

            const scoreA = new TextInputBuilder()
                .setCustomId('score_a')
                .setLabel('Team A Score')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const scoreB = new TextInputBuilder()
                .setCustomId('score_b')
                .setLabel('Team B Score')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const weekInput = new TextInputBuilder()
                .setCustomId('week')
                .setLabel('Week Number')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(teamA),
                new ActionRowBuilder().addComponents(teamB),
                new ActionRowBuilder().addComponents(scoreA),
                new ActionRowBuilder().addComponents(scoreB),
                new ActionRowBuilder().addComponents(weekInput)
            );

            await interaction.showModal(modal);
            // After opening the modal we return; do not perform any further message updates here.
            return;

        } catch (e) {
            console.error('[submit_score] ERROR in handleButton:', e);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Unable to open score submission modal. Please contact an admin.', ephemeral: true });
                } else {
                    await interaction.editReply({ content: 'Unable to open score submission modal. Please contact an admin.' });
                }
            } catch (replyErr) {
                console.error('[submit_score] Failed to send error reply after modal failure:', replyErr);
            }
            return;
        }
    } // End try
    catch (err) {
        console.error('[submit_score] ERROR in handleButton:', err);
        await interaction.reply({ content: 'An error occurred while processing your request. Please contact an admin.', ephemeral: true });
    }
}
