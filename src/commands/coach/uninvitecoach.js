// src/commands/coach/uninvitecoach.js
import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("uninvitecoach")
    .setDescription("Remove a coach or coach role from your team channel")
    .addRoleOption(option =>
        option.setName("role").setDescription("Coach role to remove").setRequired(true)
    );

export async function execute(interaction) {
    let responded = false;
    try {
        await interaction.deferReply({ flags: 64 });
        responded = true;
    } catch (err) {
        console.error('Failed to defer reply in /uninvitecoach:', err?.message || err);
        return;
    }
    const role = interaction.options.getRole("role");
    const channel = interaction.channel;
    try {
        await channel.permissionOverwrites.delete(role.id);
        if (responded) await interaction.editReply({ content: `✅ Successfully uninvited role ${role}.` });
    } catch (err) {
        // Ignore 'Interaction has already been acknowledged' errors
        if (err.code === 40060) return;
        console.error('Failed to remove coach role:', err);
        if (responded) {
            await interaction.editReply({ content: "❌ Failed to remove coach role." });
        }
    }
}
