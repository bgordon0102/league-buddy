import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('clearcoachoffices')
    .setDescription("Delete the 'Coach's Office' category and all its channels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const guild = interaction.guild;
    if (!guild) return await interaction.editReply('❌ This command must be run in a server.');

    // Find the category by name
    const category = guild.channels.cache.find(
        c => c.type === 4 && c.name === "Coach's Office"
    );
    if (!category) {
        return await interaction.editReply("❌ 'Coach's Office' category not found.");
    }

    // Delete all channels under the category
    const channels = guild.channels.cache.filter(c => c.parentId === category.id);
    let deletedChannels = [];
    for (const channel of channels.values()) {
        try {
            await channel.delete('Clearing Coach Offices');
            deletedChannels.push(`Deleted: ${channel.name}`);
        } catch (err) {
            deletedChannels.push(`Error deleting ${channel.name}: ${err.message}`);
        }
    }
    // Delete the category itself
    try {
        await category.delete('Clearing Coach Offices');
        deletedChannels.push(`Deleted category: ${category.name}`);
    } catch (err) {
        deletedChannels.push(`Error deleting category: ${err.message}`);
    }
    await interaction.editReply(deletedChannels.join('\n'));
}
