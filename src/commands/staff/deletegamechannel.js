


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
    // Log all category names for debugging
    const guild = interaction.guild;
    const allCategories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => `${c.name} (${c.id})`);
    console.log(`[deletegamechannel] All categories in guild:`, allCategories);
    console.log(`[deletegamechannel] Start execute: replied=${interaction.replied}, deferred=${interaction.deferred}`);
    // Debug: List all channels in the guild
    const allChannels = guild.channels.cache.map(c => `${c.name} (${c.id})`);
    console.log(`[deletegamechannel] All channels in guild:`, allChannels);
    await interaction.deferReply();
    try {
        let replyMsg = '';
        const week = interaction.options.getInteger('week');
        const guild = interaction.guild;
        if (!guild || !guild.channels || !guild.channels.cache) {
            replyMsg = '❌ Error: Guild or channels not found.';
            console.error('[deletegamechannel] Guild or channels not found.');
            await interaction.editReply({ content: replyMsg });
            return;
        }
        const allChannels = guild.channels.cache.map(c => `${c.name} (${c.id})`);
        console.log(`[deletegamechannel] All channels in guild:`, allChannels);
        const category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === `Week ${week} Games`);
        if (!category) {
            // Truncate channel list to avoid exceeding Discord's 2000 character limit
            const maxChannels = 20;
            let channelList = allChannels.slice(0, maxChannels).join(', ');
            if (allChannels.length > maxChannels) {
                channelList += ` ...and ${allChannels.length - maxChannels} more.`;
            }
            replyMsg = `❌ No category found for Week ${week}. Channels in guild: ${channelList}`;
            console.error(`[deletegamechannel] No category found for Week ${week}.`);
            await interaction.editReply({ content: replyMsg });
            return;
        }
        const childChannels = guild.channels.cache.filter(ch => ch.parentId === category.id);
        if (childChannels.size === 0) {
            replyMsg = `⚠️ No child channels found under category '${category.name}'.`;
            console.warn(`[deletegamechannel] No child channels found under category '${category.name}'.`);
            await interaction.editReply({ content: replyMsg });
            return;
        }
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
        await interaction.editReply({ content: replyMsg });
    } catch (err) {
        console.error('[deletegamechannel] Fatal error:', err);
        if (!(interaction.replied || interaction.deferred)) {
            try {
                await interaction.followUp({ content: 'Error clearing week channels.' });
            } catch (e) {
                console.error('[deletegamechannel] Failed to send followUp reply:', e);
            }
        }
    }
}
