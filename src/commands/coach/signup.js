

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('signup')
    .setDescription('Get your dashboard registration link to sign up as a coach or staff member.');

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const dashboardUrl = process.env.DASHBOARD_URL || 'https://league-buddy-production.up.railway.app';
        const registrationLink = `${dashboardUrl}/api/auth/discord`;
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('Welcome to LEAGUEbuddy!')
            .setDescription('Please register your coach/staff account using the link below:')
            .setURL(registrationLink)
            .addFields({ name: 'Registration Link', value: `[Click here to register](${registrationLink})` })
            .setThumbnail(`${dashboardUrl}/logo-new.png`);
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: 'Error generating registration link. Please contact staff.' });
    }
}
