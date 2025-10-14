


import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('deletegamechannel')
    .setDescription('Delete all game channels for a selected week (Discord only, JSON remains intact).')
    .addIntegerOption(option =>
        option.setName('week')
            .setDescription('Week number to clear')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    console.log(`[deletegamechannel] Start execute: replied=${interaction.replied}, deferred=${interaction.deferred}`);
    // Debug: List all channels in the guild
    const allChannels = interaction.guild.channels.cache.map(c => `${c.name} (${c.id})`);
    console.log(`[deletegamechannel] All channels in guild:`, allChannels);
    try {
        if (interaction.replied || interaction.deferred) return;
        await interaction.deferReply();
        let replyMsg = '';
        const week = interaction.options.getInteger('week');
        const guild = interaction.guild;
        if (!guild || !guild.channels || !guild.channels.cache) {
            replyMsg = 'Error: Guild or channels not found.';
        } else {
            const category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === `Season 1 - Week ${week}`);
            if (!category) {
                replyMsg = `No category found for Week ${week}.`;
            } else {
                const childChannels = guild.channels.cache.filter(ch => ch.parentId === category.id);
                let deleted = 0;
                for (const channel of childChannels.values()) {
                    console.log(`[deletegamechannel] Attempting to delete channel: ${channel.name} (${channel.id})`);
                    try {
                        await channel.delete();
                        deleted++;
                        console.log(`[deletegamechannel] Deleted channel: ${channel.name} (${channel.id})`);
                    } catch (e) {
                        console.error(`[deletegamechannel] Failed to delete channel ${channel.name}:`, e);
                    }
                }
                try {
                    await category.delete();
                    console.log(`[deletegamechannel] Deleted category: ${category.name} (${category.id})`);
                } catch (e) {
                    console.error(`[deletegamechannel] Failed to delete category:`, e);
                }
                replyMsg = `✅ Deleted ${deleted} channels and the category for Week ${week}.`;
            }
        }
        await interaction.editReply({ content: replyMsg });
    } catch (err) {
        console.error('[deletegamechannel] Fatal error:', err);
        if (!(interaction.replied || interaction.deferred)) {
            try {
                await interaction.reply({ content: 'Error clearing week channels.' });
            } catch (e) {
                console.error('[deletegamechannel] Failed to send reply:', e);
            }
        }
    }
}
