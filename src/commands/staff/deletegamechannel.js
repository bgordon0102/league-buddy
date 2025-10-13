
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import fs from 'fs';
import path from 'path';

const SEASON_FILE = './data/season.json';

export const data = new SlashCommandBuilder()
    .setName('deletegamechannel')
    .setDescription('Delete all game channels for a selected week (Discord only, JSON remains intact).')
    .addIntegerOption(option =>
        option.setName('week')
            .setDescription('Week number to clear')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    await interaction.deferReply(); // Always first, no conditions
    const startTime = Date.now();
    try {
        const absSeasonPath = path.resolve(SEASON_FILE);
        const exists = fs.existsSync(absSeasonPath);
        console.log(`[deletegamechannel] Checking for season file at: ${absSeasonPath} (exists: ${exists})`);
        const week = interaction.options.getInteger('week');
        if (!exists) {
            console.error('[deletegamechannel] No active season file found.');
            return await interaction.editReply({ content: 'No active season found.' });
        }
        // Robust schedule read
        function safeReadJSON(file, fallback) {
            try {
                const data = fs.readFileSync(file, 'utf8');
                if (!data) throw new Error('Empty file');
                return JSON.parse(data);
            } catch {
                console.warn(`[deletegamechannel] File ${file} missing or invalid, using fallback.`);
                return fallback;
            }
        }
        const schedulePath = path.join(process.cwd(), 'data/schedule.json');
        const schedule = safeReadJSON(schedulePath, []);
        if (!Array.isArray(schedule) || schedule.length === 0) {
            console.error('[deletegamechannel] No schedule found in schedule.json.');
            return await interaction.editReply({ content: 'Error: No schedule found in schedule.json. Please start a season first.' });
        }
        // Get week matchups
        const weekMatchups = Array.isArray(schedule[week]) ? schedule[week] : [];
        if (!weekMatchups || weekMatchups.length === 0) {
            console.error(`[deletegamechannel] No games found for week ${week}.`);
            return await interaction.editReply({ content: `No games found for week ${week}.` });
        }
        if (!interaction.guild) {
            console.error('[deletegamechannel] interaction.guild is undefined.');
            return await interaction.editReply({ content: 'Error: Guild not found.' });
        }
        if (!interaction.guild.channels || !interaction.guild.channels.cache) {
            console.error('[deletegamechannel] interaction.guild.channels.cache is undefined.');
            return await interaction.editReply({ content: 'Error: Guild channels not found.' });
        }
        // Find the category for this week
        const categoryName = `Week ${week} Games`;
        const category = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === categoryName);
        if (!category) {
            console.error(`[deletegamechannel] No category found for Week ${week}.`);
            return await interaction.editReply({ content: `No category found for Week ${week}.` });
        }
        // Delete all channels under the category
        for (const channel of interaction.guild.channels.cache.filter(ch => ch.parentId === category.id).values()) {
            try {
                await channel.delete();
            } catch (e) {
                console.error(`[deletegamechannel] Failed to delete channel ${channel.name}:`, e);
            }
        }
        // Delete the category itself
        try {
            await category.delete();
        } catch (e) {
            console.error(`[deletegamechannel] Failed to delete category:`, e);
        }
        const elapsed = Date.now() - startTime;
        console.log(`[deletegamechannel] Successfully deleted week ${week} channels in ${elapsed}ms.`);
        await interaction.editReply({ content: `✅ Week ${week} game channels and category deleted from Discord.` });
    } catch (err) {
        console.error('[deletegamechannel] Fatal error:', err);
        // Only try to edit reply if still possible
        if (!interaction.replied && !interaction.deferred) {
            try { await interaction.editReply({ content: 'Error clearing week channels.' }); } catch (e) {
                console.error('[deletegamechannel] Failed to send error message:', e);
            }
        }
    }
}
