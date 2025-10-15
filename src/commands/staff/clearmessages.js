import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clearmessages')
  .setDescription('Clear messages in the current channel.')
  .addStringOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to delete or "all"')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const amountArg = interaction.options.getString('amount').toLowerCase();
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    if (responded) await interaction.editReply({ content: 'This command can only be used in text channels.' });
    return;
  }
  try {
    if (amountArg === 'all') {
      // Fetch all messages and delete in batches of 100
      let fetched;
      do {
        fetched = await channel.messages.fetch({ limit: 100 });
        if (fetched.size > 0) {
          await channel.bulkDelete(fetched, true).catch(err => console.error(err));
        }
      } while (fetched.size >= 2); // stop when fewer than 2 messages left
      if (responded) await interaction.editReply({ content: 'All messages deleted in this channel.' });
    } else {
      const amount = parseInt(amountArg);
      if (isNaN(amount) || amount < 1) {
        if (responded) await interaction.editReply({ content: 'Please provide a valid number of messages to delete.' });
        return;
      }
      const deleteAmount = Math.min(amount, 100); // Discord bulkDelete limit
      await channel.bulkDelete(deleteAmount, true);
      if (responded) await interaction.editReply({ content: `Deleted ${deleteAmount} messages.` });
    }
  } catch (err) {
    console.error('Error deleting messages:', err);
    if (responded) await interaction.editReply({ content: 'Error deleting messages.' });
  }
}
