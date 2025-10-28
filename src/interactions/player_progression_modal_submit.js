// Handles player_progression_modal_submit modal submission
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

const PROGRESSION_CHANNEL_ID = "1425555037328773220";

export const customId = "player_progression_modal_submit";

export async function execute(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== "player_progression_modal_submit") return;
    const teamName = interaction.fields.getTextInputValue("teamName");
    const playerName = interaction.fields.getTextInputValue("playerName");
    const skillSet = interaction.fields.getTextInputValue("skillSet");
    const attributeUpgrades = interaction.fields.getTextInputValue("attributeUpgrades");
    const currentOvr = interaction.fields.getTextInputValue("currentOvr");

    // Load roster
    const fileName = teamName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() + ".json";
    const rosterPath = path.join(process.cwd(), "data/teams_rosters", fileName);
    if (!fs.existsSync(rosterPath)) {
        await interaction.reply({ content: "Roster file not found.", ephemeral: true });
        return;
    }
    const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
    const players = Array.isArray(roster) ? roster : roster.players || [];
    const norm = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idx = players.findIndex(p => norm(p.name) === norm(playerName));
    if (idx === -1) {
        await interaction.reply({ content: "Player not found in your roster.", ephemeral: true });
        return;
    }

    // Save progression details to player
    players[idx].progression = players[idx].progression || [];
    players[idx].progression.push({
        skillSet,
        attributeUpgrades,
        currentOvr,
        date: new Date().toISOString(),
        submittedBy: interaction.user.id
    });

    // Save changes
    if (Array.isArray(roster)) {
        fs.writeFileSync(rosterPath, JSON.stringify(players, null, 2));
    } else {
        roster.players = players;
        fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
    }

    // Build embed for progression request
    const embed = new EmbedBuilder()
        .setTitle("Player Progression Request")
        .addFields(
            { name: "Team", value: teamName },
            { name: "Player Name", value: playerName },
            { name: "Skill Set", value: skillSet },
            { name: "Attribute Upgrades", value: attributeUpgrades },
            { name: "Current OVR", value: currentOvr }
        )
        .setColor(0x1E90FF);

    // Add approve/deny buttons
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const approveBtn = new ButtonBuilder()
        .setCustomId(`progression_approve_${playerName}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success);
    const denyBtn = new ButtonBuilder()
        .setCustomId(`progression_deny_${playerName}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);
    const actionRow = new ActionRowBuilder().addComponents(approveBtn, denyBtn);

    // Tag staff roles
    const staffMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/staffRoleMap.main.json'), 'utf8'));
    const staffTags = [`<@&${staffMap['Schedule Tracker']}>`, `<@&${staffMap['Paradise Commish']}>`].join(' ');

    // Post to progression channel (ensure correct channel ID is used)
    // Replace PROGRESSION_CHANNEL_ID with the actual progression channel ID string if needed
    const progressionChannelId = '1428097786272026736';
    const channel = await interaction.client.channels.fetch(progressionChannelId);
    if (channel) {
        await channel.send({ content: staffTags, embeds: [embed], components: [actionRow] });
        await interaction.reply({ content: `Progression for ${playerName} submitted and saved!`, ephemeral: true });
    } else {
        await interaction.reply({ content: `Error: Progression channel not found, but progression was saved.`, ephemeral: true });
    }
}
