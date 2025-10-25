export const customId = /^trade_dm_(approve|deny)$/;
// Handles DM Approve/Deny buttons for trade proposals
import { ButtonInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import fs from "fs";
import path from "path";

const COMMITTEE_CHANNEL_ID = "1425555499440410812"; // Committee channel
const APPROVED_CHANNEL_ID = "1425555422063890443";
const DENIED_CHANNEL_ID = "1425567560241254520";

export async function execute(interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    const customId = interaction.customId;
    // Find trade info: allow any user with the coach role for the team to approve/deny
    let tradeId = null;
    for (const id of Object.keys(global.activeTrades || {})) {
        const t = global.activeTrades[id];
        if (t && t.status === "pending") {
            // Check if user has the coach role for the team
            const guild = interaction.guild || interaction.client.guilds.cache.first();
            if (guild) {
                const roleId = t.coachBId;
                const member = guild.members.cache.get(interaction.user.id);
                if (member && member.roles.cache.has(roleId)) {
                    tradeId = id;
                    break;
                }
            }
        }
    }
    if (!tradeId) {
        await interaction.reply({ content: "Trade not found or expired.", ephemeral: true });
        return;
    }
    const trade = global.activeTrades[tradeId];
    // Check 24 hour expiry
    if (Date.now() - trade.submittedAt > 24 * 60 * 60 * 1000) {
        trade.status = "expired";
        await interaction.reply({ content: "Trade has expired.", ephemeral: true });
        return;
    }
    if (customId === "trade_dm_deny") {
        trade.status = "denied";
        // Notify Coach A
        const userA = await interaction.client.users.fetch(trade.proposerId);
        await userA.send({ content: `Your trade proposal with ${trade.otherTeam} was denied.` });
        await interaction.reply({ content: "Trade denied. Coach A has been notified.", ephemeral: true });
        return;
    }
    if (customId === "trade_dm_approve") {
        trade.status = "committee";
        // Post to committee channel
        const embed = new EmbedBuilder()
            .setTitle("Trade Committee Vote Required")
            .addFields(
                { name: "Your Team", value: trade.yourTeam, inline: true },
                { name: "Other Team", value: trade.otherTeam, inline: true },
                { name: "Assets Sent", value: trade.assetsSent },
                { name: "Assets Received", value: trade.assetsReceived }
            );
        if (trade.notes) embed.addFields({ name: "Notes", value: trade.notes });
        embed.setColor(0x5865F2);
        const committeeRoleId = "1428100787225235526";
        const approveBtn = new ButtonBuilder().setCustomId(`committee_approve_${tradeId}`).setLabel("Approve").setStyle(ButtonStyle.Success);
        const denyBtn = new ButtonBuilder().setCustomId(`committee_deny_${tradeId}`).setLabel("Deny").setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
        const committeeChannel = await interaction.client.channels.fetch(COMMITTEE_CHANNEL_ID);
        await committeeChannel.send({ content: `<@&${committeeRoleId}>`, embeds: [embed], components: [row] });
        await interaction.reply({ content: "Trade sent to committee for voting.", ephemeral: true });
        return;
    }
}
