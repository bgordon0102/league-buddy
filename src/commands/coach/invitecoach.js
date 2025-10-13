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
        await channel.permissionOverwrites.edit(role.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        });

        await interaction.reply({ content: `✅ Role ${role} has been invited to this channel.`, flags: 64 });
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: "❌ Failed to invite coach role.", flags: 64 });
    }
}
// Removed leftover CommonJS export
