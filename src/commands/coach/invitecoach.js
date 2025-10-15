// src/commands/coach/invitecoach.js
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("invitecoach")
    .setDescription("Invite a coach or a coach role into your team channel")
    .addRoleOption(option =>
        option.setName("role").setDescription("Coach role to invite").setRequired(true)
    );

export async function execute(interaction) {
    const role = interaction.options.getRole("role");
    const channel = interaction.channel;

    try {
        await interaction.deferReply({ ephemeral: true });
        await channel.permissionOverwrites.edit(role.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        });
        if (!responded) {
            responded = true;
            await interaction.editReply({ content: `✅ Role ${role} has been invited to this channel.` });
        }
    } catch (err) {
        console.error(err);
        if (!responded) {
            responded = true;
            await interaction.editReply({ content: "❌ Failed to invite coach role." });
        }
    }
    let responded = false;
}
// Removed leftover CommonJS export
