// src/commands/coach/uninvitecoach.js
import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("uninvitecoach")
    .setDescription("Remove a coach or coach role from your team channel")
    .addRoleOption(option =>
        option.setName("role").setDescription("Coach role to remove").setRequired(true)
    );

export async function execute(interaction) {
    const role = interaction.options.getRole("role");
    const channel = interaction.channel;

    try {
        await channel.permissionOverwrites.delete(role.id);
        await interaction.reply({ content: `✅ Successfully uninvited role ${role}.`, flags: 64 });
    } catch (err) {
        // Ignore 'Interaction has already been acknowledged' errors
        if (err.code === 40060) return;
        console.error(err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Failed to remove coach role.", flags: 64 });
        }
    }
}
