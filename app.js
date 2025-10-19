
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readdirSync, createWriteStream } from 'fs';
import coachRoleMap from './data/coachRoleMap.json' assert { type: 'json' };

// Redirect console.log and console.error to both console and bot.log
const logStream = createWriteStream('bot.log', { flags: 'a' });
const origLog = console.log;
const origErr = console.error;
console.log = (...args) => {
  origLog(...args);
  try { logStream.write(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch { }
};
console.error = (...args) => {
  origErr(...args);
  try { logStream.write('[ERROR] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch { }
};

function normalizeTeamName(input) {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  // Try full name first (case-insensitive)
  for (const fullName of Object.keys(coachRoleMap)) {
    if (cleaned === fullName.trim().toLowerCase()) return fullName;
  }
  // Try short name (case-insensitive)
  for (const [short, full] of Object.entries(teamShortNames)) {
    if (cleaned === short.toLowerCase()) return full;
    if (cleaned.includes(short.toLowerCase())) return full;
  }
  return null;
}

// Load environment variables
dotenv.config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Initialize commands and interactions collections
client.commands = new Collection();
client.interactions = new Collection();

// Get current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to dynamically load all commands
async function loadCommands() {
  const commandFolders = ['staff', 'coach']; // Only load final folders

  for (const folder of commandFolders) {
    const commandsPath = join(__dirname, 'src', 'commands', folder);
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const fileURL = pathToFileURL(filePath).href;

      try {
        const imported = await import(fileURL);
        const cmd = imported.default || imported; // Support both default and named exports
        if ('data' in cmd && 'execute' in cmd) {
          client.commands.set(cmd.data.name, cmd);
          console.log(`✅ Loaded ${folder} command: ${cmd.data.name}`);
        } else {
          console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
        }
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error);
      }
    }
  }

  // After loading commands
  console.log('Registered commands:', Array.from(client.commands.keys()));
}

// Function to dynamically load all interaction handlers
async function loadInteractions() {
  const interactionsPath = join(__dirname, 'src', 'interactions');
  const interactionFiles = readdirSync(interactionsPath).filter(file => file.endsWith('.js'));

  for (const file of interactionFiles) {
    const filePath = join(interactionsPath, file);
    const fileURL = pathToFileURL(filePath).href;

    try {
      const interaction = await import(fileURL);

      if ('customId' in interaction && 'execute' in interaction) {
        client.interactions.set(interaction.customId, interaction);
        console.log(`✅ Loaded interaction: ${interaction.customId}`);
      } else {
        console.log(`⚠️  Interaction at ${filePath} is missing required "customId" or "execute" property.`);
      }
    } catch (error) {
      console.error(`❌ Error loading interaction ${file}:`, error);
    }
  }
}

// Register bigboard_move interaction


// Register submit_score button/modal/approval handlers
import * as submitScore from './src/interactions/submit_score.js';
client.interactions.set('submit_score', submitScore);
client.interactions.set('force_win_modal', { execute: (interaction) => submitScore.handleModal(interaction, 'Force Win') });
client.interactions.set('sim_result_modal', { execute: (interaction) => submitScore.handleModal(interaction, 'Sim Result') });
client.interactions.set('approve_score', { execute: i => submitScore.handleApproval(i, true) });
client.interactions.set('deny_score', { execute: i => submitScore.handleApproval(i, false) });

// Register force_win and sim_result button handlers
import * as submitScoreButtons from './src/interactions/submit_score.js';
client.interactions.set('force_win', {
  execute: async (interaction) => {
    await submitScoreButtons.handleForceWin(interaction);
  }
});
client.interactions.set('sim_result', {
  execute: async (interaction) => {
    await submitScoreButtons.handleSimResult(interaction);
  }
});

// Bot clientReady event (Discord.js v15+)
client.once('clientReady', (readyClient) => {
  console.log(`ENVIRONMENT: ${process.env.NODE_ENV || 'undefined'}`);
  console.log('🏀 LEAGUEbuddy is online!');
  console.log(`📊 Logged in as ${readyClient.user.tag}`);
  console.log(`🏟️  Serving ${readyClient.guilds.cache.size} server(s)`);
  console.log(`⚡ Loaded ${client.commands.size} commands`);
});

// Emoji reaction handling for game channel welcome messages
client.on('messageReactionAdd', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;
  // Only handle reactions in game channels
  const channel = reaction.message.channel;
  if (!channel.name || !channel.name.includes('-vs-')) return;
  // Only handle reactions on bot's welcome message
  if (!reaction.message.author || reaction.message.author.id !== client.user.id) return;
  // Emoji logic
  let button, customId, label;
  if (reaction.emoji.name === '📝') {
    customId = 'submit_score_react';
    label = 'Open Submit Score Modal';
  } else if (reaction.emoji.name === '✅') {
    customId = 'force_win_react';
    label = 'Open Force Win Modal';
  } else if (reaction.emoji.name === '🎲') {
    customId = 'sim_result_react';
    label = 'Open Sim Result Modal';
  }
  if (customId) {
    button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);
    await channel.send({
      content: `<@${user.id}> Click the button below to continue.`,
      components: [new ActionRowBuilder().addComponents(button)],
      ephemeral: true
    });
  }
});
// Handle button clicks from ephemeral messages to open modals
client.interactions.set('submit_score_react', {
  execute: async (interaction) => {
    await submitScore.handleButton(interaction);
  }
});
client.interactions.set('force_win_react', {
  execute: async (interaction) => {
    await submitScore.handleForceWin(interaction);
  }
});
client.interactions.set('sim_result_react', {
  execute: async (interaction) => {
    await submitScore.handleSimResult(interaction);
  }
});

// Handle interactions (commands and autocomplete)
client.on('interactionCreate', async interaction => {
  // DEBUG: Log every interaction
  console.log('[DEBUG] interactionCreate event fired:', {
    type: interaction.type,
    commandName: interaction.commandName,
    customId: interaction.customId,
    user: interaction.user?.tag || interaction.user?.id
  });


  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`❌ Error with autocomplete for ${interaction.commandName}:`, error);
    }
    return;
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    let interactionHandler = client.interactions.get(interaction.customId);
    if (!interactionHandler) {
      console.error(`❌ No interaction handler matching ${interaction.customId} was found.`);
      return;
    }
    try {
      await interactionHandler.execute(interaction);
    } catch (error) {
      console.error(`❌ Error executing interaction ${interaction.customId}:`, error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'There was an error while executing this interaction!' });
        } else {
          await interaction.reply({ content: 'There was an error while executing this interaction!', flags: 64 });
        }
      } catch (replyError) {
        console.error('❌ Failed to send error message:', replyError);
      }
    }
    return;
  }

  // Handle slash command interactions (TOP LEVEL)
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`❌ No command matching ${interaction.commandName} was found.`);
      return;
    }
    try {
      console.log(`[DEBUG] Executing command: ${interaction.commandName}`);
      await command.execute(interaction);
      console.log(`[DEBUG] Finished executing command: ${interaction.commandName}`);
    } catch (error) {
      console.error(`❌ Error executing ${interaction.commandName}:`, error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'There was an error while executing this command!' });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
        }
      } catch (replyError) {
        console.error('❌ Failed to send error message:', replyError);
      }
    }
    return;
  }


  // Handle button interactions (including trade flow)
  if (interaction.isButton()) {
    // Trade submission modal
    if (interaction.customId === 'trade_submit_button') {
      const modal = new ModalBuilder()
        .setCustomId('trade_modal')
        .setTitle('Submit Trade Proposal')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('your_team')
              .setLabel('Your Team (name or keyword)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('e.g. Celtics, Boston Celtics, Lakers, Timberwolves')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('other_team')
              .setLabel('Other Team (name or keyword)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('e.g. Lakers, Los Angeles Lakers, Bulls, Timberwolves')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('assets_sent')
              .setLabel('Assets Sent')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('e.g. Jayson Tatum, 2026 1st Round Pick')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('assets_received')
              .setLabel('Assets Received')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('e.g. Anthony Davis, 2027 2nd Round Pick')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('notes')
              .setLabel('Notes (optional)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setPlaceholder('e.g. Salary matching, future considerations, etc.')
          )
        );
      await interaction.showModal(modal);
      return;
    }

    // Trade approval/deny buttons in DM
    if (interaction.customId === 'approve_trade_button' || interaction.customId === 'deny_trade_button') {
      const trade = client.pendingTrades && client.pendingTrades[interaction.user.id];
      if (!trade) {
        await interaction.reply({ content: 'No pending trade found for you.', ephemeral: true });
        return;
      }
      if (interaction.customId === 'approve_trade_button') {
        // Only the non-submitting coach needs to approve
        const committeeChannel = await client.channels.fetch('1425555499440410812');
        if (!committeeChannel || !committeeChannel.isTextBased()) {
          await interaction.reply({ content: 'Failed to find the committee channel.', ephemeral: true });
          return;
        }
        const embed = {
          title: 'Trade Proposal (Committee Vote Required)',
          description: `Trade between **${trade.yourTeam}** and **${trade.otherTeam}** (submitted by <@${trade.submitterId}>, approved by <@${interaction.user.id}>)`,
          fields: [
            { name: 'Team 1', value: trade.yourTeam, inline: true },
            { name: 'Team 2', value: trade.otherTeam, inline: true },
            { name: 'Assets Sent', value: trade.assetsSent },
            { name: 'Assets Received', value: trade.assetsReceived },
            ...(trade.notes ? [{ name: 'Notes', value: trade.notes }] : [])
          ],
          color: 0xFFD700,
          footer: { text: 'Committee has 48 hours to vote.' }
        };
        const approveBtn = new ButtonBuilder().setCustomId('committee_approve_trade').setLabel('Approve').setStyle(ButtonStyle.Success);
        const denyBtn = new ButtonBuilder().setCustomId('committee_deny_trade').setLabel('Deny').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
        const msg = await committeeChannel.send({ content: '<@&1428100787225235526>', embeds: [embed], components: [row] });
        // Store vote state
        client.committeeVotes = client.committeeVotes || {};
        client.committeeVotes[msg.id] = {
          trade,
          votes: {},
          createdAt: Date.now(),
          timeout: setTimeout(async () => {
            // Tally votes after 48 hours
            const voteData = client.committeeVotes[msg.id];
            if (!voteData) return;
            const approveCount = Object.values(voteData.votes).filter(v => v === 'approve').length;
            const denyCount = Object.values(voteData.votes).filter(v => v === 'deny').length;
            let resultMsg, resultChannelId;
            if (approveCount > denyCount) {
              resultMsg = 'Trade approved by committee.';
              resultChannelId = '1425555422063890443'; // approved channel
            } else {
              resultMsg = 'Trade denied by committee.';
              resultChannelId = '1425567560241254520'; // denied channel
            }
            try {
              const resultChannel = await committeeChannel.guild.channels.fetch(resultChannelId);
              if (resultChannel && resultChannel.isTextBased()) {
                await resultChannel.send({ content: resultMsg + ` (A:${approveCount} D:${denyCount})` });
              } else {
                await committeeChannel.send({ content: resultMsg + ` (A:${approveCount} D:${denyCount})` });
              }
            } catch (err) {
              await committeeChannel.send({ content: resultMsg + ` (A:${approveCount} D:${denyCount})` });
            }
            delete client.committeeVotes[msg.id];
          }, 48 * 60 * 60 * 1000) // 48 hours
        };
        await interaction.reply({ content: 'Trade approved and sent to committee for 48-hour vote.', ephemeral: true });
        // Remove from pending
        delete client.pendingTrades[interaction.user.id];
      } else if (interaction.customId === 'deny_trade_button') {
        // Notify both coaches
        try {
          const submitterUser = await client.users.fetch(trade.submitterId);
          await submitterUser.send(`Your trade proposal with **${trade.otherTeam}** was denied by the other coach.`);
        } catch { }
        try {
          await interaction.user.send('You have denied the trade proposal. The other coach has been notified.');
        } catch { }
        await interaction.reply({ content: 'Trade denied. Both coaches have been notified.', ephemeral: true });
        // Remove from pending
        delete client.pendingTrades[interaction.user.id];
      }
      return;
    }

    // Committee voting buttons (must be top-level)
    if (interaction.isButton() && (interaction.customId === 'committee_approve_trade' || interaction.customId === 'committee_deny_trade')) {
      const msgId = interaction.message.id;
      client.committeeVotes = client.committeeVotes || {};
      const voteData = client.committeeVotes[msgId];
      if (!voteData) {
        await interaction.reply({ content: 'Voting for this trade has ended or is invalid.', ephemeral: true });
        return;
      }
      // Only allow one vote per user
      voteData.votes[interaction.user.id] = interaction.customId === 'committee_approve_trade' ? 'approve' : 'deny';
      // Tally votes
      const approveCount = Object.values(voteData.votes).filter(v => v === 'approve').length;
      const denyCount = Object.values(voteData.votes).filter(v => v === 'deny').length;
      await interaction.reply({ content: `Your vote has been recorded. Approve: ${approveCount}, Deny: ${denyCount}`, ephemeral: true });
      // End early if majority reached (3 out of 5)
      const majority = 3;
      if (approveCount >= majority || denyCount >= majority) {
        const trade = voteData.trade;
        const coachTags = `<@${trade.submitterId}> <@${trade.otherCoachId}>`;
        const ghostParadiseTag = '<@&1428119680572325929>';
        const embed = {
          title: approveCount >= majority ? 'Trade Approved by Committee' : 'Trade Denied by Committee',
          description: `Trade between **${trade.yourTeam}** and **${trade.otherTeam}**\n${coachTags}`,
          fields: [
            { name: 'Team 1', value: trade.yourTeam, inline: true },
            { name: 'Team 2', value: trade.otherTeam, inline: true },
            { name: 'Assets Sent', value: trade.assetsSent },
            { name: 'Assets Received', value: trade.assetsReceived },
            ...(trade.notes ? [{ name: 'Notes', value: trade.notes }] : [])
          ],
          color: approveCount >= majority ? 0x43B581 : 0xED4245 // green for approve, red for deny
        };
        let resultChannelId = approveCount >= majority ? '1425555422063890443' : '1425567560241254520';
        try {
          const committeeChannel = interaction.channel;
          const resultChannel = await committeeChannel.guild.channels.fetch(resultChannelId);
          if (resultChannel && resultChannel.isTextBased()) {
            await resultChannel.send({ content: ghostParadiseTag, embeds: [embed] });
          } else {
            await committeeChannel.send({ content: ghostParadiseTag, embeds: [embed] });
          }
        } catch (err) {
          await interaction.channel.send({ content: ghostParadiseTag, embeds: [embed] });
        }
        // Clear timeout and delete vote data
        if (voteData.timeout) clearTimeout(voteData.timeout);
        delete client.committeeVotes[msgId];
      }
    }
  }

  // Handle trade modal submission (DM flow)
  if (interaction.isModalSubmit() && interaction.customId === 'trade_modal') {
    console.log('[DEBUG] trade_modal submitted');
    try {
      const yourTeam = interaction.fields.getTextInputValue('your_team');
      const otherTeam = interaction.fields.getTextInputValue('other_team');
      const assetsSent = interaction.fields.getTextInputValue('assets_sent');
      const assetsReceived = interaction.fields.getTextInputValue('assets_received');
      const notes = interaction.fields.getTextInputValue('notes');
      console.log('[DEBUG] Modal values:', { yourTeam, otherTeam, assetsSent, assetsReceived, notes });

      // Find the submitting user and the other coach by team name (loose match)

      const guild = await client.guilds.fetch(interaction.guildId);
      console.log('[DEBUG] Fetched guild:', guild.id);
      // Use coachRoleMap for loose team name search
      const lowerOtherTeam = otherTeam.toLowerCase();
      let matchedTeam = null;
      for (const teamName of Object.keys(coachRoleMap)) {
        if (teamName.toLowerCase().includes(lowerOtherTeam) || lowerOtherTeam.includes(teamName.toLowerCase())) {
          matchedTeam = teamName;
          break;
        }
      }
      let otherCoach = null;
      if (matchedTeam) {
        const roleId = coachRoleMap[matchedTeam];
        const role = guild.roles.cache.get(roleId);
        if (role) {
          // Find a member with this role
          otherCoach = guild.members.cache.find(m => m.roles.cache.has(roleId));
          if (!otherCoach && guild.members.search) {
            try {
              const found = await guild.members.search({ query: matchedTeam.split(' ')[0], limit: 10 });
              otherCoach = found.find(m => m.roles.cache.has(roleId));
            } catch (err) {
              console.error('[ERROR] guild.members.search for role failed:', err);
            }
          }
        }
        console.log('[DEBUG] Found otherCoach by role:', otherCoach ? otherCoach.user.tag : null, 'for team:', matchedTeam);
      } else {
        console.log('[DEBUG] No team matched in coachRoleMap for:', otherTeam);
      }
      const submitter = interaction.user;

      if (!otherCoach) {
        await interaction.reply({ content: `Could not find a coach for team: ${otherTeam}. Please check the team name.`, ephemeral: true });
        console.log('[DEBUG] No coach found for:', otherTeam);
        return;
      }

      // DM the other coach for approval (reverse assets for their perspective)
      const dmEmbed = {
        title: 'Trade Proposal Approval',
        description: `You have a pending trade proposal from **${yourTeam}** (submitted by <@${submitter.id}>):`,
        fields: [
          { name: 'Your Team', value: otherTeam, inline: true },
          { name: 'Other Team', value: yourTeam, inline: true },
          { name: 'Assets Sent', value: assetsReceived },
          { name: 'Assets Received', value: assetsSent },
          ...(notes ? [{ name: 'Notes', value: notes }] : [])
        ],
        color: 0x1E90FF
      };
      const approveButton = new ButtonBuilder()
        .setCustomId('approve_trade_button')
        .setLabel('Approve Trade')
        .setStyle(ButtonStyle.Success);
      const denyButton = new ButtonBuilder()
        .setCustomId('deny_trade_button')
        .setLabel('Deny Trade')
        .setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(approveButton, denyButton);
      try {
        await otherCoach.user.send({ embeds: [dmEmbed], components: [row] });
        await interaction.reply({ content: `Trade proposal sent to ${otherCoach.user.tag} for approval via DM.`, ephemeral: true });
        console.log('[DEBUG] DM sent to:', otherCoach.user.tag);
      } catch (err) {
        await interaction.reply({ content: `Failed to DM the other coach. They may have DMs disabled.`, ephemeral: true });
        console.error('[ERROR] Failed to DM other coach:', err);
        return;
      }

      // Store trade details in memory for approval (in production, use a DB or file)
      client.pendingTrades = client.pendingTrades || {};
      client.pendingTrades[otherCoach.id] = {
        yourTeam,
        otherTeam,
        assetsSent,
        assetsReceived,
        notes,
        submitterId: submitter.id,
        otherCoachId: otherCoach.id
      };
      console.log('[DEBUG] Trade stored for approval:', client.pendingTrades[otherCoach.id]);
      return;
    } catch (err) {
      console.error('[ERROR] Exception in trade_modal handler:', err);
      try {
        await interaction.reply({ content: 'An error occurred while processing your trade proposal.', ephemeral: true });
      } catch { }
      return;
    }
  }

}); // end interactionCreate

console.log('Bot is starting...');

(async () => {
  try {
    await loadCommands();
    await loadInteractions();
    const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
    console.log('Loaded token:', token ? '[REDACTED]' : 'undefined');
    if (!token) {
      console.error('❌ DISCORD_TOKEN is not set in environment.');
      process.exit(1);
    }
    await client.login(token);
    console.log('Bot login successful, process should stay alive.');
  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  }
})();

