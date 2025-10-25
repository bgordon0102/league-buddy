import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('testbutton')
    .setDescription('Send a test button in the current thread');

export async function execute(interaction) {
    if (!interaction.channel || !interaction.channel.isThread()) {
        await interaction.reply({ content: 'Please run this command in a thread.', ephemeral: true });
        return;
    }
    const approvalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('test_approve')
            .setLabel('Test Approve')
            .setStyle(ButtonStyle.Success)
    );
    await interaction.channel.send({
        content: 'Test: Please approve.',
        components: [approvalRow]
    });
    await interaction.reply({ content: 'Test button sent.', ephemeral: true });
}