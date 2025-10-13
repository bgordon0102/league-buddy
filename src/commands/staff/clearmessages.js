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
  const amountArg = interaction.options.getString('amount').toLowerCase();
  const channel = interaction.channel;

  if (!channel || !channel.isTextBased()) {
    return interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
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
      await interaction.reply({ content: 'All messages deleted in this channel.', ephemeral: false });
    } else {
      const amount = parseInt(amountArg);
      if (isNaN(amount) || amount < 1) {
        return interaction.reply({ content: 'Please provide a valid number of messages to delete.', ephemeral: true });
      }

      const deleteAmount = Math.min(amount, 100); // Discord bulkDelete limit
      await channel.bulkDelete(deleteAmount, true);
      await interaction.reply({ content: `Deleted ${deleteAmount} messages.`, ephemeral: false });
    }
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Error deleting messages.', ephemeral: true });
  }
}
