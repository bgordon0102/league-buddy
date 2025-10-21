console.log('LEAGUEbuddy: Script started.');
import dotenv from 'dotenv';
import fs, { readdirSync, createWriteStream } from 'fs';
import { Client, GatewayIntentBits, Collection, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as submitScore from './src/interactions/submit_score.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

// --- Player Progression Submission System ---
const progressionRequestsPath = './data/progressionRequests.json';
function loadProgressionRequests() {
  try {
    return JSON.parse(fs.readFileSync(progressionRequestsPath, 'utf8'));
  } catch {
    return [];
  }
}
function saveProgressionRequests(reqs) {
  fs.writeFileSync(progressionRequestsPath, JSON.stringify(reqs, null, 2));
}
let progressionRequests = loadProgressionRequests();

const STAFF_ROLE_IDS = ['1428100777229942895', '1427896861934485575']; // Schedule Tracker, Paradise Commish


// Node.js v22+ compatibility: use fs.readFileSync for JSON import
// Persistent storage for pending trades
const pendingTradesPath = './data/pendingTrades.json';
function loadPendingTrades() {
  try {
    return JSON.parse(fs.readFileSync(pendingTradesPath, 'utf8'));
  } catch {
    return {};
  }
}
function savePendingTrades(trades) {
  fs.writeFileSync(pendingTradesPath, JSON.stringify(trades, null, 2));
}
let persistentPendingTrades = loadPendingTrades();

let teamRoleMap;
try {
  teamRoleMap = JSON.parse(fs.readFileSync('./data/teamRoleMap.json', 'utf8'));
} catch (e) {
  console.error('Failed to load teamRoleMap.json:', e);
  teamRoleMap = {};
}





// Reduce log spam: only log startup and critical errors in production
const logStream = createWriteStream('bot.log', { flags: 'a' });
const origLog = console.log;
const origErr = console.error;
if (process.env.NODE_ENV !== 'production') {
  console.log = (...args) => {
    origLog(...args);
    try { logStream.write(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch { }
  };
  console.error = (...args) => {
    origErr(...args);
    try { logStream.write('[ERROR] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch { }
  };
} else {
  // In production, only log startup and critical errors
  console.log = (...args) => {
    if (typeof args[0] === 'string' && (
      args[0].includes('LEAGUEbuddy is online!') ||
      args[0].includes('Logged in as') ||
      args[0].includes('Serving') ||
      args[0].includes('Loaded') ||
      args[0].includes('ENVIRONMENT:')
    )) {
      origLog(...args);
      try { logStream.write(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch { }
    }
  };
  console.error = (...args) => {
    origErr(...args);
    try { logStream.write('[ERROR] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'); } catch { }
  };
}

function normalizeTeamName(input) {
  if (!input) return null;
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/ coach$/, '').replace(/[^a-z0-9 ]/gi, '');
  // 1. Try exact full name match
  for (const fullName of Object.keys(teamRoleMap)) {
    if (cleaned === fullName.trim().toLowerCase().replace(/[^a-z0-9 ]/gi, '')) return fullName;
  }
  // 2. Try prefix or suffix match (e.g. 'mavericks' matches 'dallas mavericks', but not 'oklahoma city thunder')
  for (const fullName of Object.keys(teamRoleMap)) {
    const normalized = fullName.trim().toLowerCase().replace(/[^a-z0-9 ]/gi, '');
    if (normalized.startsWith(cleaned) || normalized.endsWith(cleaned)) return fullName;
  }
  // 3. Try each word in input as prefix/suffix only
  for (const fullName of Object.keys(teamRoleMap)) {
    const normalized = fullName.trim().toLowerCase().replace(/[^a-z0-9 ]/gi, '');
    for (const word of cleaned.split(' ')) {
      if (word && (normalized.startsWith(word) || normalized.endsWith(word))) return fullName;
    }
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
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
      // Log the file and its exports for debugging
      console.log(`[INTERACTION LOADER] File: ${filePath}`);
      console.log(`[INTERACTION LOADER] Exports:`, Object.keys(interaction));
      // Skip progression_approve and progression_deny, handled in main handler
      if (interaction.customId === 'progression_approve' || interaction.customId === 'progression_deny') {
        // Only log once, but do not register these as interactions
        continue;
      }
      if ('customId' in interaction && 'execute' in interaction) {
        client.interactions.set(interaction.customId, interaction);
        console.log(`✅ Loaded interaction:`, interaction.customId);
      } else {
        console.log(`⚠️  Interaction at ${filePath} is missing required "customId" or "execute" property.`);
      }
    } catch (error) {
      console.error(`❌ Error loading interaction ${file}:`, error && error.stack ? error.stack : error);
    }
  }
}

// Register bigboard_move interaction


client.interactions.set('submit_score', submitScore);
client.interactions.set('force_win_modal', { execute: (interaction) => submitScore.handleModal(interaction, 'Force Win') });
client.interactions.set('sim_result_modal', { execute: (interaction) => submitScore.handleModal(interaction, 'Sim Result') });
client.interactions.set('approve_score', { execute: i => submitScore.handleApproval(i, true) });
client.interactions.set('deny_score', { execute: i => submitScore.handleApproval(i, false) });
client.interactions.set('force_win', { execute: async (interaction) => { await submitScore.handleForceWin(interaction); } });
client.interactions.set('sim_result', { execute: async (interaction) => { await submitScore.handleSimResult(interaction); } });
client.interactions.set('set_game_info', { execute: async (interaction) => { await submitScore.handleSetGameInfo(interaction); } });
client.interactions.set('set_game_info_modal', { execute: async (interaction) => { await submitScore.handleSetGameInfoModal(interaction); } });

// Register progression button handler
if (client.interactions.has('submit_progression_button')) {
  console.warn('[DUPLICATE REGISTRATION] submit_progression_button handler is being registered more than once!');
} else {
  console.log('[REGISTER] submit_progression_button handler registered.');
  client.interactions.set('submit_progression_button', {
    execute: async (interaction) => {
      // Infer team from user roles
      const member = interaction.member;
      const teamRole = member.roles.cache.find(r => Object.values(teamRoleMap).includes(r.id));
      const teamName = teamRole ? Object.keys(teamRoleMap).find(k => teamRoleMap[k] === teamRole.id) : '';
      const modal = new ModalBuilder()
        .setCustomId('progression_modal')
        .setTitle('Submit Player Progression')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('team')
              .setLabel('Team')
              .setStyle(TextInputStyle.Short)
              .setValue(teamName)
              .setRequired(true)
              .setPlaceholder('Team Name')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('player')
              .setLabel('Player Name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('e.g. SF Cooper Flagg')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('skillset')
              .setLabel('Skill Set')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('e.g. Perimeter Defense')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('attributes')
              .setLabel('Attribute Upgrades')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('e.g. Perimeter Defense +3, Steal +2')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ovr')
              .setLabel('Current OVR')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('e.g. 78')
          )
        );
      await interaction.showModal(modal);
    }
  });
}

// Add the progression button to the channel (run once or on bot ready)
async function postProgressionButton(channelId) {
  const channel = await client.channels.fetch(channelId);
  const button = new ButtonBuilder()
    .setCustomId('submit_progression_button')
    .setLabel('Submit Progression')
    .setStyle(ButtonStyle.Primary);
  await channel.send({
    content: '📌 Use the button below to submit a player progression request.',
    components: [new ActionRowBuilder().addComponents(button)]
  });
}

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
  // Handle Set Game Info button and modal directly for safety
  if (interaction.isButton() && interaction.customId === 'set_game_info') {
    return submitScore.handleSetGameInfo(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === 'set_game_info_modal') {
    return submitScore.handleSetGameInfoModal(interaction);
  }
  // Improved logging: log every command usage with user and result
  if (interaction.isChatInputCommand()) {
    console.log(`[COMMAND] /${interaction.commandName} used by ${interaction.user?.tag || interaction.user?.id}`);
  } else if (interaction.isButton()) {
    console.log(`[BUTTON] ${interaction.customId} clicked by ${interaction.user?.tag || interaction.user?.id}`);
  } else if (interaction.isStringSelectMenu()) {
    console.log(`[SELECT] ${interaction.customId} used by ${interaction.user?.tag || interaction.user?.id}`);
  } else if (interaction.isAutocomplete()) {
    console.log(`[AUTOCOMPLETE] /${interaction.commandName} by ${interaction.user?.tag || interaction.user?.id}`);
  }


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
      await command.execute(interaction);
      console.log(`[SUCCESS] /${interaction.commandName} executed for ${interaction.user?.tag || interaction.user?.id}`);
    } catch (error) {
      console.error(`[FAIL] /${interaction.commandName} failed for ${interaction.user?.tag || interaction.user?.id}:`, error);
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
    // --- TRADE BUTTONS: handle these with direct string match, do not change ---
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
    if (interaction.customId === 'approve_trade_button' || interaction.customId === 'deny_trade_button') {
      // ...existing code for approve/deny trade buttons...
      const trade = client.pendingTrades && client.pendingTrades[interaction.user.id];
      if (!trade) {
        await interaction.reply({ content: 'No pending trade found for you.', flags: 64 });
        return;
      }
      if (interaction.customId === 'approve_trade_button') {
        // Only the non-submitting coach needs to approve
        const committeeChannel = await client.channels.fetch('1425555499440410812');
        if (!committeeChannel || !committeeChannel.isTextBased()) {
          await interaction.reply({ content: 'Failed to find the committee channel.', flags: 64 });
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
        await interaction.reply({ content: 'Trade approved and sent to committee for 48-hour vote.', flags: 64 });
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
        await interaction.reply({ content: 'Trade denied. Both coaches have been notified.', flags: 64 });
        // Remove from pending
        delete client.pendingTrades[interaction.user.id];
      }
      return;
    }
    // Committee voting buttons (must be top-level)
    if (interaction.isButton() && (interaction.customId === 'committee_approve_trade' || interaction.customId === 'committee_deny_trade')) {
      // ...existing code for committee voting buttons...
      const msgId = interaction.message.id;
      client.committeeVotes = client.committeeVotes || {};
      const voteData = client.committeeVotes[msgId];
      if (!voteData) {
        await interaction.reply({ content: 'Voting for this trade has ended or is invalid.', flags: 64 });
        return;
      }
      // Only allow one vote per user
      voteData.votes[interaction.user.id] = interaction.customId === 'committee_approve_trade' ? 'approve' : 'deny';
      // Tally votes
      const approveCount = Object.values(voteData.votes).filter(v => v === 'approve').length;
      const denyCount = Object.values(voteData.votes).filter(v => v === 'deny').length;
      await interaction.reply({ content: `Your vote has been recorded. Approve: ${approveCount}, Deny: ${denyCount}`, flags: 64 });
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

    // --- REGEX/GENERIC BUTTONS: try string match, then regex match ---
    let interactionHandler = client.interactions.get(interaction.customId);
    if (interaction.customId === 'progression_approve' || interaction.customId === 'progression_deny') {
      // Do nothing here, let the custom handler below process it
    } else {
      if (!interactionHandler) {
        // Try regex match for customId
        for (const [key, handler] of client.interactions.entries()) {
          if (key instanceof RegExp && key.test(interaction.customId)) {
            interactionHandler = handler;
            break;
          }
        }
      }
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
  }

  // Handle trade modal submission (DM flow)
  if (interaction.isModalSubmit() && interaction.customId === 'trade_modal') {
    console.log('[DEBUG] trade_modal submitted');
    let replied = false;
    try {
      await interaction.deferReply({ ephemeral: true });
      replied = true;
    } catch (err) {
      // Already replied or deferred
      console.error('[ERROR] Could not defer trade modal interaction:', err);
    }
    try {
      const yourTeam = interaction.fields.getTextInputValue('your_team');
      const otherTeam = interaction.fields.getTextInputValue('other_team');
      const assetsSent = interaction.fields.getTextInputValue('assets_sent');
      const assetsReceived = interaction.fields.getTextInputValue('assets_received');
      const notes = interaction.fields.getTextInputValue('notes');
      console.log('[DEBUG] Modal values:', { yourTeam, otherTeam, assetsSent, assetsReceived, notes });

      // Find the submitting user and the other coach by team name (robust, roleId-based, no full fetch)
      const guild = await client.guilds.fetch(interaction.guildId);
      let matchedTeam = normalizeTeamName(otherTeam);
      let otherCoach = null;
      let roleId = matchedTeam ? teamRoleMap[matchedTeam] : null;
      let role = roleId ? guild.roles.cache.get(roleId) : null;
      const adminRoleNames = ['Admin', 'Commish', 'Commissioner'];
      let adminRoleIds = guild.roles.cache.filter(r => adminRoleNames.includes(r.name)).map(r => r.id);
      console.log(`[TRADE DEBUG] Input team: '${otherTeam}', Matched team: '${matchedTeam}', RoleId: '${roleId}'`);
      if (role) {
        // Always fetch all members to ensure role.members is up to date
        try {
          await guild.members.fetch();
        } catch (err) {
          console.error('[TRADE DEBUG] Failed to fetch all members:', err);
        }
        let allCandidates = Array.from(role.members.values());
        if (allCandidates.length === 0) {
          const msg = `No coach assigned to team: ${matchedTeam}`;
          if (replied) {
            await interaction.editReply({ content: msg });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
          console.log(`[TRADE DEBUG] No members have the team role for '${matchedTeam}'.`);
          return;
        }
        // Prefer non-admin/commish, else fallback to first
        let nonStaff = allCandidates.filter(m => !m.roles.cache.some(r => adminRoleIds.includes(r)));
        if (nonStaff.length > 0) {
          otherCoach = nonStaff[0];
          console.log(`[TRADE DEBUG] Found coach for '${matchedTeam}': ${otherCoach.user.tag} (${otherCoach.id}) (non-staff)`);
        } else {
          otherCoach = allCandidates[0];
          console.log(`[TRADE DEBUG] All coaches for '${matchedTeam}' are staff; picking: ${otherCoach.user.tag} (${otherCoach.id})`);
        }
      }
      // Only fallback to global coach if NO team match at all
      if (!otherCoach && !matchedTeam) {
        const globalCoachRoleId = '1428119680572325929';
        let globalRole = guild.roles.cache.get(globalCoachRoleId);
        let globalCoaches = globalRole ? Array.from(globalRole.members.values()) : [];
        // Filter out admins/commish
        let filtered = globalCoaches.filter(m => !m.roles.cache.some(r => adminRoleIds.includes(r)));
        if (filtered.length === 1) {
          otherCoach = filtered[0];
          console.log(`[TRADE DEBUG] Fallback to single global coach: ${otherCoach.user.tag} (${otherCoach.id})`);
        } else if (filtered.length > 1) {
          console.log('[TRADE DEBUG] Multiple users have the global coach role, refusing to DM all.');
          otherCoach = null;
        }
      }
      if (!otherCoach) {
        const msg = `Could not find a coach for team: ${otherTeam}. Please check the team name or coach assignment.`;
        if (replied) {
          await interaction.editReply({ content: msg });
        } else {
          await interaction.reply({ content: msg, ephemeral: true });
        }
        console.log('[DEBUG] No coach found for:', otherTeam);
        return;
      }
      // DM the other coach for approval (reverse assets for their perspective)
      const submitter = interaction.user;
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
      let dmSuccess = false;
      try {
        await otherCoach.user.send({ embeds: [dmEmbed], components: [row] });
        dmSuccess = true;
      } catch (err) {
        console.error('[ERROR] Failed to DM other coach:', err);
      }
      // Store trade details in memory and persistent JSON
      client.pendingTrades = client.pendingTrades || {};
      const tradeObj = {
        yourTeam,
        otherTeam,
        assetsSent,
        assetsReceived,
        notes,
        submitterId: submitter.id,
        otherCoachId: otherCoach.id
      };
      client.pendingTrades[otherCoach.id] = tradeObj;
      persistentPendingTrades[otherCoach.id] = tradeObj;
      savePendingTrades(persistentPendingTrades);
      console.log('[DEBUG] Trade stored for approval:', tradeObj, 'for user:', otherCoach.id);
      // Always reply or editReply
      if (dmSuccess) {
        if (replied) {
          await interaction.editReply({ content: `Trade proposal sent to ${otherCoach.user.tag} for approval via DM.` });
        } else {
          await interaction.reply({ content: `Trade proposal sent to ${otherCoach.user.tag} for approval via DM.`, ephemeral: true });
        }
      } else {
        if (replied) {
          await interaction.editReply({ content: `Trade stored, but failed to DM the other coach (DMs disabled).` });
        } else {
          await interaction.reply({ content: `Trade stored, but failed to DM the other coach (DMs disabled).`, ephemeral: true });
        }
      }
    } catch (err) {
      console.error('[ERROR] Exception in trade_modal handler:', err);
      const msg = 'An error occurred while processing your trade proposal.';
      try {
        if (replied) {
          await interaction.editReply({ content: msg });
        } else {
          await interaction.reply({ content: msg, ephemeral: true });
        }
      } catch { }
      return;
    }
  }

  // Handle progression modal submission
  if (interaction.isModalSubmit() && interaction.customId === 'progression_modal') {
    let replied = false;
    // --- Runtime lock for double submit prevention ---
    try {
      await interaction.deferReply({ ephemeral: true });
      replied = true;
    } catch { }
    try {
      const team = interaction.fields.getTextInputValue('team');
      const player = interaction.fields.getTextInputValue('player');
      const skillset = interaction.fields.getTextInputValue('skillset');
      const attributes = interaction.fields.getTextInputValue('attributes');
      const ovr = interaction.fields.getTextInputValue('ovr');
      const submitter = interaction.user;

      // Debug: log every progression modal submit event
      console.log(`[DEBUG] Progression modal submitted: team=${team}, player=${player}, skillset=${skillset}, attributes=${attributes}, ovr=${ovr}, submitter=${submitter.id}`);

      // Deduplication: check for existing pending request
      function normalize(str) {
        return (str || '').replace(/\s+/g, '').toLowerCase();
      }
      function upgradesMatch(jsonUpgrades, embedUpgrades) {
        const normJson = normalize((jsonUpgrades || '').replace(/\n/g, ''));
        const normEmbed = normalize((embedUpgrades || '').replace(/\n/g, ''));
        return normJson.includes(normEmbed) || normEmbed.includes(normJson);
      }
      const existing = progressionRequests.find(r =>
        normalize(r.team) === normalize(team) &&
        normalize(r.player) === normalize(player) &&
        normalize(r.skillset) === normalize(skillset) &&
        upgradesMatch(r.attributes, attributes) &&
        normalize(r.ovr) === normalize(ovr) &&
        r.status === 'pending'
      );
      if (existing) {
        await interaction.editReply({ content: `A pending progression request for this player/upgrade already exists and is awaiting staff review.` });
        return;
      }

      // Save to persistent storage
      const reqObj = {
        team, player, skillset, attributes, ovr, submitterId: submitter.id, submitterTag: submitter.tag, status: 'pending', submittedAt: new Date().toISOString()
      };
      progressionRequests.push(reqObj);
      saveProgressionRequests(progressionRequests);
      // Post embed in channel tagging staff
      const channel = interaction.channel;
      const embed = new EmbedBuilder()
        .setTitle('Player Progression Request')
        .setDescription(`**Team:** ${team}\n**Player:** ${player}\n**Skill Set:** ${skillset}\n**Upgrades:** ${attributes}\n**Current OVR:** ${ovr}`)
        .setFooter({ text: `Submitted by ${submitter.tag}` })
        .setTimestamp();
      const approveBtn = new ButtonBuilder().setCustomId('progression_approve').setLabel('Approve').setStyle(ButtonStyle.Success);
      const denyBtn = new ButtonBuilder().setCustomId('progression_deny').setLabel('Deny').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
      await channel.send({
        content: `${STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(' ')} New progression request submitted!`,
        embeds: [embed],
        components: [row]
      });
      if (replied) {
        await interaction.editReply({ content: 'Progression request submitted and posted for staff review.' });
      } else {
        await interaction.reply({ content: 'Progression request submitted and posted for staff review.', flags: 1 << 6 });
      }
    } catch (err) {
      if (replied) {
        await interaction.editReply({ content: 'Failed to submit progression request.' });
      } else {
        await interaction.reply({ content: 'Failed to submit progression request.', flags: 1 << 6 });
      }
    }
  }


  // Handle progression approve/deny buttons (single handler only!)

  if (interaction.isButton() && (interaction.customId === 'progression_approve' || interaction.customId === 'progression_deny')) {
    try {
      console.log('[DEBUG] Progression button interaction received:', {
        user: interaction.user?.tag,
        customId: interaction.customId,
        messageId: interaction.message?.id
      });
      // Only allow staff roles
      const memberRoles = interaction.member.roles.cache;
      const isStaff = STAFF_ROLE_IDS.some(id => memberRoles.has(id));
      console.log('[DEBUG] Staff check:', { isStaff, memberRoles: Array.from(memberRoles.keys()) });
      if (!isStaff) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('You do not have permission to approve or deny progression requests.');
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [embed], flags: 1 << 6 });
        }
        console.log('[DEBUG] Not staff, replied with error.');
        return;
      }

      // Find the original embed and details
      const message = interaction.message;
      const embed = message.embeds[0];
      if (!embed) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('Could not find progression request details.');
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [errEmbed], flags: 1 << 6 });
        }
        console.log('[DEBUG] No embed found in message.');
        return;
      }

      // Extract details from embed
      const teamMatch = embed.description.match(/\*\*Team:\*\* (.*)/);
      const playerMatch = embed.description.match(/\*\*Player:\*\* (.*)/);
      const skillsetMatch = embed.description.match(/\*\*Skill Set:\*\* (.*)/);
      const upgradesFieldMatch = embed.description.match(/\*\*Upgrades:\*\* (.*)/);
      const ovrMatch = embed.description.match(/\*\*Current OVR:\*\* (.*)/);
      const submitterTag = embed.footer?.text?.replace('Submitted by ', '') || '';

      const team = teamMatch ? teamMatch[1].split('\n')[0] : '';
      const player = playerMatch ? playerMatch[1].split('\n')[0] : '';
      const skillset = skillsetMatch ? skillsetMatch[1].split('\n')[0] : '';
      const upgradesField = upgradesFieldMatch ? upgradesFieldMatch[1].split('\n')[0] : '';
      const ovr = ovrMatch ? ovrMatch[1].split('\n')[0] : '';
      console.log('[DEBUG] Parsed embed details:', { team, player, skillset, upgrades: upgradesField, ovr });

      // Find the submitter by tag in progressionRequests
      function normalize(str) {
        return (str || '').replace(/\s+/g, '').toLowerCase();
      }
      function upgradesMatch(jsonUpgrades, embedUpgrades) {
        // Remove whitespace and line breaks, check if embedUpgrades is a substring of jsonUpgrades
        const normJson = normalize(jsonUpgrades.replace(/\n/g, ''));
        const normEmbed = normalize(embedUpgrades.replace(/\n/g, ''));
        return normJson.includes(normEmbed) || normEmbed.includes(normJson);
      }
      const req = progressionRequests.find(r =>
        normalize(r.team) === normalize(team) &&
        normalize(r.player) === normalize(player) &&
        normalize(r.skillset) === normalize(skillset) &&
        upgradesMatch(r.attributes, upgradesField) &&
        normalize(r.ovr) === normalize(ovr) &&
        r.status === 'pending'
      );
      console.log('[DEBUG] Matched progression request:', req);
      if (req) {
        req.status = interaction.customId === 'progression_approve' ? 'approved' : 'denied';
        req.reviewedBy = interaction.user.tag;
        req.reviewedAt = new Date().toISOString();
        saveProgressionRequests(progressionRequests);
        console.log('[DEBUG] Updated progression request status and saved.');

        // Only post regression if approving
        if (interaction.customId === 'progression_approve') {
          // --- REGRESSION LOGIC (final: -1 per upgrade, from highest attribute) ---
          let upgradeList = [];
          let upgradesForRegression = req ? req.attributes : upgradesField;
          if (upgradesForRegression) {
            const parts = upgradesForRegression.includes(',') ? upgradesForRegression.split(',') : upgradesForRegression.split('\n');
            upgradeList = parts.map(s => {
              const match = s.trim().match(/(.+?)\s*\+([0-9]+)/i);
              if (match) {
                return { attr: match[1].trim(), value: parseInt(match[2], 10) };
              } else if (s.trim()) {
                return { attr: s.trim(), value: null };
              }
              return null;
            }).filter(Boolean);
          }
          const sortedUpgrades = upgradeList
            .filter(u => typeof u.value === 'number')
            .sort((a, b) => b.value - a.value || 0)
            .concat(upgradeList.filter(u => typeof u.value !== 'number'));
          const numProgressions = 1;
          const regression = -1;
          let regressListStr = `-1 to **${skillset}**`;
          let teamRoleId = teamRoleMap && teamRoleMap[team] ? teamRoleMap[team] : null;
          let teamTag = teamRoleId ? `<@&${teamRoleId}>` : '';
          let commishTag = '<@&1427896861934485575>';
          let tagString = `${teamTag} ${commishTag}`.trim();
          try {
            const regressionChannel = await interaction.client.channels.fetch('1428097711436992704');
            if (regressionChannel && regressionChannel.isTextBased()) {
              const regressionEmbed = new EmbedBuilder()
                .setTitle('Player Regression Notice')
                .setColor(0xED4245)
                .setDescription(
                  `**Team:** ${team}\n` +
                  `**Player:** ${player}\n` +
                  `**Skill Set:** ${skillset}\n` +
                  `**Regression:** -1 to **${skillset}**`
                )
                .setFooter({ text: 'Regression is -1 per upgrade.' });
              await regressionChannel.send({ content: `${tagString} regression update:`, embeds: [regressionEmbed] });
            }
          } catch (regErr) {
            console.error('❌ Failed to post regression update:', regErr);
          }
        }

        // DM the submitter as an embed
        try {
          const user = await interaction.client.users.fetch(req.submitterId);
          let dmEmbed;
          if (interaction.customId === 'progression_approve') {
            dmEmbed = new EmbedBuilder()
              .setColor(0x43B581)
              .setTitle('✅ Progression Request Approved')
              .setDescription(`Your progression request for **${player}** (${team}) has been approved!`)
              .addFields(
                { name: 'Skill Set', value: skillset, inline: false },
                { name: 'Upgrades', value: upgradesField, inline: false },
                { name: 'Current OVR', value: ovr, inline: false }
              );
          } else {
            dmEmbed = new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Progression Request Denied')
              .setDescription(`Your progression request for **${player}** (${team}) has been denied.`)
              .addFields(
                { name: 'Skill Set', value: skillset, inline: false },
                { name: 'Upgrades', value: upgradesField, inline: false },
                { name: 'Current OVR', value: ovr, inline: false }
              );
          }
          await user.send({ embeds: [dmEmbed] });
          console.log('[DEBUG] DM sent to submitter:', req.submitterId);
        } catch (dmErr) {
          console.error('❌ Failed to DM progression submitter:', dmErr);
        }
      }

      // Update the embed in the channel
      const newEmbed = EmbedBuilder.from(embed)
        .setColor(interaction.customId === 'progression_approve' ? 0x43B581 : 0xED4245)
        .setFooter({ text: `${embed.footer?.text || ''} | ${interaction.customId === 'progression_approve' ? 'Approved' : 'Denied'} by ${interaction.user.tag}` })
        .setTimestamp();
      await message.edit({ embeds: [newEmbed], components: [] });
      console.log('[DEBUG] Edited message embed and removed buttons.');

      // Reply to staff as an embed
      const replyEmbed = new EmbedBuilder()
        .setColor(interaction.customId === 'progression_approve' ? 0x43B581 : 0xED4245)
        .setDescription(`Progression request has been **${interaction.customId === 'progression_approve' ? 'approved' : 'denied'}** and the submitter has been notified.`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [replyEmbed], flags: 1 << 6 });
      }
      console.log('[DEBUG] Replied to staff with confirmation embed.');
      return;
    } catch (err) {
      console.error('❌ Error in progression approve/deny handler:', err);
      if (!interaction.replied && !interaction.deferred) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('An error occurred while processing this progression request. Please try again or contact staff.');
        await interaction.reply({ embeds: [errEmbed], flags: 1 << 6 });
      }
      return;
    }
  }



});

// --- BOT STARTUP CODE (must be at root, not inside any handler) ---
console.log('Bot is starting...');
// Extra: Log token presence for debugging
const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is not set in environment. Exiting.');
  process.exit(1);
} else {
  console.log('✅ Discord token found (not shown for security).');
}

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

