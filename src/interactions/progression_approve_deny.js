// Handles approve/deny button interactions for player progression requests
import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';


export const customId = /^progression_(approve|deny)_.+/;

export async function execute(interaction) {
    // Button customId format: progression_approve_Player Name or progression_deny_Player Name
    const customId = interaction.customId;
    const isApprove = customId.startsWith('progression_approve_');
    const playerName = customId.replace('progression_approve_', '').replace('progression_deny_', '');

    // Find the embed message
    const message = interaction.message;
    const embed = message.embeds[0];
    if (!embed) {
        await interaction.reply({ content: 'No progression embed found.', ephemeral: true });
        return;
    }

    // Restrict to staff roles only
    const staffMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/staffRoleMap.main.json'), 'utf8'));
    const allowedRoles = [staffMap['Schedule Tracker'], staffMap['Paradise Commish']];
    const memberRoles = interaction.member.roles.cache;
    const isStaff = allowedRoles.some(roleId => memberRoles.has(roleId));
    if (!isStaff) {
        await interaction.reply({ content: 'Only Schedule Tracker or Paradise Commish can approve or deny progression requests.', ephemeral: true });
        return;
    }

    // Update embed with approval/denial
    const status = isApprove ? '✅ Approved by Staff' : '❌ Denied by Staff';
    const updatedEmbed = EmbedBuilder.from(embed).addFields({ name: 'Status', value: status });

    // Acknowledge interaction and edit message
    await interaction.deferUpdate();
    await message.edit({ embeds: [updatedEmbed], components: [] });

    // Track regression count per player per skill set if approved
    if (isApprove) {
        // No follow-up message; only update the embed
    }
}
