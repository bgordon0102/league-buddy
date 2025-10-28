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

    // Update embed with approval/denial
    const status = isApprove ? '✅ Approved by Staff' : '❌ Denied by Staff';
    const updatedEmbed = EmbedBuilder.from(embed).addFields({ name: 'Status', value: status });

    // Edit message to show status and remove buttons
    await message.edit({ embeds: [updatedEmbed], components: [] });
    await interaction.reply({ content: `Progression for ${playerName} ${isApprove ? 'approved' : 'denied'}!`, ephemeral: true });

    // Track regression count per player per skill set if approved
    if (isApprove) {
        const teamName = embed.fields.find(f => f.name === 'Team')?.value;
        const skillSet = embed.fields.find(f => f.name === 'Skill Set')?.value;
        if (playerName && skillSet) {
            const regressionPath = path.join(process.cwd(), 'data/regressionCounts.json');
            let regressionCounts = {};
            if (fs.existsSync(regressionPath)) {
                regressionCounts = JSON.parse(fs.readFileSync(regressionPath, 'utf8'));
            }
            regressionCounts[playerName] = regressionCounts[playerName] || {};
            regressionCounts[playerName][skillSet] = (regressionCounts[playerName][skillSet] || 0) - 1;
            fs.writeFileSync(regressionPath, JSON.stringify(regressionCounts, null, 2));

            // Post/update summary in regression channel
            const regressionChannelId = '1428097711436992704';
            const regressionChannel = await interaction.client.channels.fetch(regressionChannelId);
            if (regressionChannel) {
                let summary = `Regression summary for ${playerName} (${teamName}):\n`;
                for (const [set, count] of Object.entries(regressionCounts[playerName])) {
                    summary += `• ${set}: ${count}\n`;
                }
                await regressionChannel.send({ content: summary });
            }
        }
    }
}
