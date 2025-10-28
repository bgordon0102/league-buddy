// commands/roster.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";

export const data = new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Show a team's NBA 2K roster")
    .addStringOption((option) =>
        option
            .setName("team")
            .setDescription("The NBA team to view the roster for")
            .setRequired(true)
            .setAutocomplete(true)
    );

// Autocomplete handler for team names (from teams.json)
export async function autocomplete(interaction) {
    try {
        console.log('[DEBUG] roster autocomplete called');
        const focusedValue = interaction.options.getFocused() || "";
        console.log(`[DEBUG] focusedValue: '${focusedValue}'`);
        const teamsPath = path.join(process.cwd(), "data/teams.json");
        let teams = [];
        if (fs.existsSync(teamsPath)) {
            try {
                teams = JSON.parse(fs.readFileSync(teamsPath, "utf8"));
                console.log(`[DEBUG] Loaded teams: ${teams.length}`);
            } catch (e) {
                console.error('[roster autocomplete] Failed to parse teams.json:', e);
            }
        } else {
            console.error(`[DEBUG] teams.json does not exist at ${teamsPath}`);
        }
        // Support searching by name or abbreviation
        const filtered = teams.filter(team => {
            const name = team.name?.toLowerCase() || "";
            const abbr = team.abbreviation?.toLowerCase() || "";
            const search = focusedValue.toLowerCase();
            return name.includes(search) || abbr.includes(search);
        });
        console.log(`[DEBUG] Filtered teams: ${filtered.length}`);
        // If nothing matches, show all teams
        const options = (filtered.length ? filtered : teams)
            .map(team => ({ name: `${team.name} (${team.abbreviation})`, value: team.name }))
            .slice(0, 25);
        console.log('[DEBUG] Autocomplete options:', options);
        await interaction.respond(options);
        return;
    } catch (err) {
        console.error('[roster autocomplete] Fatal error:', err);
        try { await interaction.respond([{ name: 'No teams found', value: 'none' }]); } catch { }
        return;
    }
}

export async function execute(interaction) {
    let responded = false;
    try {
        await interaction.deferReply({ ephemeral: true });
        responded = true;
        const team = interaction.options.getString("team");
        // Convert team name to file name
        const fileName = team.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() + ".json";
        const rosterPath = path.join(process.cwd(), "data/teams_rosters", fileName);
        if (!fs.existsSync(rosterPath)) {
            await interaction.editReply({ content: `No roster found for ${team}.` });
            return;
        }
        const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
        if (!Array.isArray(roster) || roster.length === 0) {
            await interaction.editReply({ content: `No players found for ${team}.` });
            return;
        }
        // Sort roster by OVR descending
        const sortedRoster = [...roster].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
        // Format roster for embed and build action rows for each player
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const lines = [];
        const actionRows = [];
        for (const player of sortedRoster) {
            lines.push(`**${player.name}** | ${player.position} | OVR: ${player.ovr}`);
            const manageId = `roster_manage_${player.id}`;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(manageId)
                    .setLabel('Manage')
                    .setStyle(ButtonStyle.Primary)
            );
            actionRows.push(row);
        }
        // Discord only allows 5 action rows per message, batch if needed
        const batchedRows = [];
        for (let i = 0; i < actionRows.length; i += 5) {
            batchedRows.push(actionRows.slice(i, i + 5));
        }

        // Load draft picks for this team
        const picksPath = path.join(process.cwd(), 'data/team_picks.json');
        let picksData = {};
        if (fs.existsSync(picksPath)) {
            try {
                picksData = JSON.parse(fs.readFileSync(picksPath, 'utf8'));
            } catch (e) { }
        }
        // Try to match team name loosely for picks
        let teamPicks = picksData[team] || [];
        // Debug: print team name and available keys
        console.log('[PICKS DEBUG] Looking up picks for team:', team);
        console.log('[PICKS DEBUG] Available keys:', Object.keys(picksData));
        if (!teamPicks.length) {
            // Try case-insensitive exact match
            const teamKeyExact = Object.keys(picksData).find(k => k.toLowerCase() === team.toLowerCase());
            if (teamKeyExact) teamPicks = picksData[teamKeyExact];
        }
        if (!teamPicks.length) {
            // Try case-insensitive partial match
            const teamKeyPartial = Object.keys(picksData).find(k => k.toLowerCase().includes(team.toLowerCase()));
            if (teamKeyPartial) teamPicks = picksData[teamKeyPartial];
        }
        // Format picks, showing original team if traded
        let pickLines = [];
        if (Array.isArray(teamPicks) && teamPicks.length) {
            pickLines = teamPicks.map(pick => {
                if (typeof pick === 'string') return pick;
                let line = `${pick.year || ''} Round ${pick.round || ''}`.trim();
                if (pick.round === 1 && pick.protection && pick.protection !== 'unprotected') {
                    line += ` (${pick.protection} protected)`;
                }
                if (pick.originalTeam && pick.originalTeam !== team) {
                    line += ` (from ${pick.originalTeam})`;
                }
                return line;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`Roster for ${team}`)
            .setDescription(lines.join("\n\n").slice(0, 4000) || "No players found.")
            .setColor(0x1E90FF);
        embed.addFields({
            name: 'Draft Picks',
            value: pickLines.length ? pickLines.join('\n').slice(0, 1024) : 'No draft picks found.'
        });
        // Debug: show sorted roster and picks in console
        console.log('[ROSTER DEBUG] Sorted roster:', sortedRoster.map(p => `${p.name} (${p.ovr})`).join(', '));
        console.log('[ROSTER DEBUG] Picks:', pickLines);
        await interaction.editReply({ embeds: [embed], components: batchedRows[0] || [] });
        // If more than 5 rows, send additional follow-up messages with only buttons
        for (let i = 1; i < batchedRows.length; i++) {
            await interaction.followUp({ components: batchedRows[i], ephemeral: true });
        }
    } catch (err) {
        console.error('Error in roster:', err);
        if (responded) {
            await interaction.editReply({ content: 'Failed to load roster.' });
        } else {
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
}
