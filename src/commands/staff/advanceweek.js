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

function safeReadJSON(file, fallback) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        if (!data) throw new Error('Empty file');
        return JSON.parse(data);
    } catch {
        console.warn(`[advanceweek] File ${file} missing or invalid, using fallback.`);
        writeJSON(file, fallback);
        return fallback;
    }
}
export const data = new SlashCommandBuilder()
    .setName('advanceweek')
    .setDescription('Advance the current week by 1, or specify a week to advance to')
    .addIntegerOption(option =>
        option.setName('week')
            .setDescription('The week number to advance to (optional)')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { sendWelcomeAndButton } from '../../interactions/submit_score.js';
// ...existing code...
import { EmbedBuilder } from 'discord.js';


const SEASON_FILE = './data/season.json';


function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function execute(interaction) {
    console.log('[advanceweek] Handler entered');
    await interaction.deferReply(); // Always first, no conditions
    try {
        console.log('[advanceweek] Checking for season file...');
        const season = safeReadJSON(SEASON_FILE, { currentWeek: 1, seasonNo: 1, coachRoleMap: {} });
        // Always start with week 1 if not set or less than 1
        if (!season.currentWeek || season.currentWeek < 1) {
            season.currentWeek = 1;
        }

        // Allow staff to specify a week number
        let weekNum = interaction.options.getInteger('week') || season.currentWeek;
        console.log('[advanceweek] Processing week:', weekNum);

        // Removed logic that forced weekNum to 1 if Week 1 Games category does not exist.

        // Delete previous week's category/channels before advancing (but not on week 1)
        if (weekNum > 1) {
            const prevCategoryName = `Week ${weekNum - 1} Games`;
            const prevCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === prevCategoryName);
            if (prevCategory) {
                for (const channel of interaction.guild.channels.cache.filter(ch => ch.parentId === prevCategory.id).values()) {
                    await channel.delete().catch(() => { });
                }
                await prevCategory.delete().catch(() => { });
            }
        }

        // Calculate week number and matchups (week-based schedule)
        const schedulePath = path.join(process.cwd(), 'data/schedule.json');
        const schedule = safeReadJSON(schedulePath, []);
        // Only support 29 weeks (NBA: 30 teams, 29 games per team)
        const totalWeeks = 29;
        if (weekNum < 1 || weekNum > totalWeeks) {
            return await interaction.editReply({ content: `Invalid week number. Must be between 1 and ${totalWeeks}.` });
        }
        // Use weekNum as index (week 0 is preseason/empty)
        const weekMatchups = Array.isArray(schedule[weekNum]) ? schedule[weekNum] : [];
        console.log('[advanceweek] Week matchups:', weekMatchups);
        if (weekMatchups.length === 0) {
            console.warn('[advanceweek] No matchups found for this week!');
        } else {
            console.log('[advanceweek] First matchup object:', JSON.stringify(weekMatchups[0], null, 2));
        }

        // Category name for this week
        const categoryName = `Week ${weekNum} Games`;

        // Create new category
        console.log('[advanceweek] Creating new category:', categoryName);
        const newCategory = await interaction.guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
        });

        // Get staff roles
        const commishRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'commish');
        const scheduleTrackerRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'schedule tracker');

        // For each matchup, create a private channel
        const coachRoleMap = season.coachRoleMap || {};
        let coachRoleMapChanged = false;
        for (const matchup of weekMatchups) {
            console.log('[advanceweek] Creating channel for matchup:', JSON.stringify(matchup, null, 2));
            const team1 = matchup.team1;
            const team2 = matchup.team2;
            if (!team1 || !team2 || !team1.name || !team2.name) {
                console.warn('[advanceweek] Skipping matchup due to missing team info:', JSON.stringify(matchup, null, 2));
                continue;
            }
            const channelName = `${team1.abbreviation.toLowerCase()}-vs-${team2.abbreviation.toLowerCase()}`;

            // --- Robust coach role logic ---
            async function ensureCoachRole(team) {
                let roleId = coachRoleMap[team.name];
                let role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
                if (!role) {
                    // Try to find by name
                    const nickname = team.name.split(' ').slice(-1)[0];
                    role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === `${nickname.toLowerCase()} coach`);
                    if (role) {
                        console.log(`[advanceweek] Found coach role by name for ${team.name}: ${role.id}`);
                        coachRoleMap[team.name] = role.id;
                        coachRoleMapChanged = true;
                        return role.id;
                    }
                    // Create role if still missing
                    try {
                        role = await interaction.guild.roles.create({
                            name: `${nickname} Coach`,
                            mentionable: true,
                            reason: `Auto-created by advanceweek for ${team.name}`
                        });
                        coachRoleMap[team.name] = role.id;
                        coachRoleMapChanged = true;
                        console.log(`[advanceweek] Created missing coach role for ${team.name}: ${role.id}`);
                        return role.id;
                    } catch (err) {
                        console.error(`[advanceweek] Failed to create coach role for ${team.name}:`, err);
                        return null;
                    }
                } else {
                    console.log(`[advanceweek] Using existing coach role for ${team.name}: ${role.id}`);
                    return role.id;
                }
            }

            // Always ensure both coach roles exist
            let team1RoleId = await ensureCoachRole(team1);
            let team2RoleId = await ensureCoachRole(team2);

            // Permissions: both coach roles, commish, schedule tracker, and the command runner
            const coachPerms = [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
            ];
            const permissionOverwrites = [
                { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
            ];
            if (team1RoleId) permissionOverwrites.push({ id: team1RoleId, allow: coachPerms });
            if (team2RoleId) permissionOverwrites.push({ id: team2RoleId, allow: coachPerms });
            if (commishRole) permissionOverwrites.push({ id: commishRole.id, allow: coachPerms });
            if (scheduleTrackerRole) permissionOverwrites.push({ id: scheduleTrackerRole.id, allow: coachPerms });
            // Always allow the command runner for debugging
            permissionOverwrites.push({ id: interaction.user.id, allow: coachPerms });

            const gameChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: newCategory.id,
                permissionOverwrites,
            });

            // Send welcome message and submit score button, with error handling
            try {
                let coachMentions = [];
                if (team1RoleId) coachMentions.push(`<@&${team1RoleId}>`);
                if (team2RoleId) coachMentions.push(`<@&${team2RoleId}>`);
                await sendWelcomeAndButton(gameChannel, weekNum, season.seasonNo || 1, coachMentions);
            } catch (e) {
                console.error('Failed to send welcome message:', e);
            }
        }
        // If coachRoleMap was changed, update season.json
        if (coachRoleMapChanged) {
            try {
                season.coachRoleMap = coachRoleMap;
                writeJSON(SEASON_FILE, season);
                console.log('[advanceweek] Updated coachRoleMap in season.json');
            } catch (err) {
                console.error('[advanceweek] Failed to update coachRoleMap in season.json:', err);
            }
        }

        // Post Top Performer for this week in the specified channel
        const performerChannelId = '1421189114912440423';
        console.log('[advanceweek] Looking up Top Performer for week:', weekNum);
        const performer = getTopPerformerForWeek(weekNum);
        console.log(`[advanceweek] Top Performer for week ${weekNum}:`, performer ? performer.name : 'None');
        if (performer) {
            let performerChannel = null;
            try {
                console.log('[advanceweek] Fetching Top Performer channel:', performerChannelId);
                performerChannel = await interaction.guild.channels.fetch(performerChannelId);
                console.log(`[advanceweek] Fetched Top Performer channel:`, performerChannel ? performerChannel.name : 'Not found');
            } catch (e) {
                console.error(`[advanceweek] Could not fetch Top Performer channel (${performerChannelId}):`, e);
            }
            if (performerChannel && performerChannel.isTextBased && performerChannel.isTextBased()) {
                try {
                    console.log('[advanceweek] Building Top Performer embed...');
                    const embed = new EmbedBuilder()
                        .setTitle(`Week ${weekNum} Top Performer`)
                        .setImage(performer.image)
                        .setDescription(
                            `${performer.position} ${performer.name}\n` +
                            `${performer.from}, ${performer.class}\n` +
                            `Physicals: ${performer.height} / ${performer.weight}\n\n` +
                            `Stats: ${performer.points} pts, ${performer.rebounds} reb, ${performer.assists} ast, ${performer.blocks} blk, ${performer.steals} stl, ${performer.turnovers} TO vs ${performer.opponent}`
                        )
                        .setColor(0x0099ff);
                    console.log('[advanceweek] Sending Top Performer embed...');
                    await performerChannel.send({ embeds: [embed] });
                    console.log('[advanceweek] Top Performer embed sent successfully.');
                } catch (e) {
                    console.error('[advanceweek] Failed to send Top Performer embed:', e);
                }
            } else {
                console.error(`[advanceweek] Top Performer channel not found or not text-based: ${performerChannelId}`);
            }
        } else {
            console.log(`[advanceweek] No Top Performer found for week ${weekNum}.`);
        }

        await interaction.editReply({ content: `Current week advanced to Week ${weekNum}. Game channels created!` });

        // Only update currentWeek in season.json
        const absSeasonPath = path.resolve(SEASON_FILE);
        let original = safeReadJSON(absSeasonPath, { currentWeek: 1, seasonNo: 1, coachRoleMap: {} });
        original.currentWeek = weekNum;
        writeJSON(absSeasonPath, original);

    } catch (err) {
        console.error(err);
        // Only try to edit reply if still possible
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.editReply({ content: 'Error advancing week.' });
            } catch (e) {
                // Ignore
            }
        }
    }
}

