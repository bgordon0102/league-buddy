import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    await interaction.editReply('Pong!');
  } catch (err) {
    console.error('[ping] Error:', err);
  }
}
