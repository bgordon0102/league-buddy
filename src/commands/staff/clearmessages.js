import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clearmessages')
  .setDescription('Clear messages in the current thread or text channel.')
  .addStringOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to delete or "all"')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  console.log('[DEBUG] clearmessages.js execute called');
  await interaction.deferReply({ ephemeral: true });
  try {
    const amountArg = interaction.options.getString('amount').toLowerCase();
    const channel = interaction.channel;
    if (!channel || (!channel.isTextBased() && !channel.isThread())) {
      console.log('[DEBUG] Not a text or thread channel');
      await interaction.editReply({ content: 'This command can only be used in threads or text channels.' });
      return;
    }
    if (amountArg === 'all') {
      // Fetch all messages and delete in batches of 100
      let fetched;
      let totalDeleted = 0;
      do {
        fetched = await channel.messages.fetch({ limit: 100 });
        if (fetched.size > 0) {
          const deleted = await channel.bulkDelete(fetched, true).catch(err => console.error(err));
          totalDeleted += deleted?.size || 0;
          console.log(`[DEBUG] Deleted ${totalDeleted} messages so far...`);
          await interaction.followUp({ content: `Deleted ${totalDeleted} messages so far...`, ephemeral: true });
        }
      } while (fetched.size >= 2); // stop when fewer than 2 messages left
      console.log('[DEBUG] All messages deleted');
      await interaction.editReply({ content: `All messages deleted in this channel. Total: ${totalDeleted}` });
    } else {
      const amount = parseInt(amountArg);
      if (isNaN(amount) || amount < 1) {
        console.log('[DEBUG] Invalid amount');
        await interaction.editReply({ content: 'Please provide a valid number of messages to delete.' });
        return;
      }
      const deleteAmount = Math.min(amount, 100); // Discord bulkDelete limit
      const deleted = await channel.bulkDelete(deleteAmount, true);
      console.log(`[DEBUG] Deleted ${deleted?.size || deleteAmount} messages.`);
      await interaction.editReply({ content: `Deleted ${deleted?.size || deleteAmount} messages.` });
    }
  } catch (err) {
    console.error('Error deleting messages:', err);
    await interaction.editReply({ content: 'Error deleting messages.' });
  }
}
