

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('signup')
    .setDescription('Get your dashboard registration link to sign up as a coach or staff member.');

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const dashboardUrl = 'https://league-buddy-production.up.railway.app';
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('Welcome to LEAGUEbuddy!')
            .setDescription('Please register your coach/staff account using the dashboard link below:')
            .setURL(dashboardUrl)
            .addFields({ name: 'Dashboard Link', value: `[Click here to open the dashboard](${dashboardUrl})` })
            .setThumbnail(`${dashboardUrl}/logo-new.png`);
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: 'Error generating registration link. Please contact staff.' });
    }
}
