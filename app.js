// LEAGUEbuddy: Modern Discord bot entry
import dotenv from 'dotenv';
import fs, { readdirSync, createWriteStream } from 'fs';
import { Client, GatewayIntentBits, Collection, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as submitScore from './src/interactions/submit_score.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });
client.commands = new Collection();
client.interactionHandlers = [];

// Register startseason_confirm button handler
import * as startseasonConfirm from './src/interactions/startseason_confirm.js';
console.log('[DEBUG] Registering startseason_confirm button handler:', startseasonConfirm.customId);
// client.interactions.set(startseasonConfirm.customId, startseasonConfirm); // Removed to fix TypeError

// Dynamically load all interaction handlers from src/interactions
const interactionsPath = join(process.cwd(), 'src', 'interactions');
const interactionFiles = readdirSync(interactionsPath).filter(f => f.endsWith('.js'));
for (const file of interactionFiles) {
  const filePath = join(interactionsPath, file);
  const handler = await import(pathToFileURL(filePath).href);
  // Register main button/select handlers
  if (handler.customId && typeof handler.execute === 'function') {
    client.interactionHandlers.push({ customId: handler.customId, execute: handler.execute });
    console.log('[DEBUG] Registered interaction handler:', handler.customId);
  }
  // Register modal customIds if present
  for (const key of Object.keys(handler)) {
    if (key.startsWith('customId_')) {
      const customIdValue = handler[key];
      const executeFn = handler[`execute_${key.replace('customId_', '')}`] || handler[`execute_${customIdValue}`];
      if (typeof executeFn === 'function') {
        client.interactionHandlers.push({ customId: customIdValue, execute: executeFn });
        console.log('[DEBUG] Registered modal interaction handler:', customIdValue);
      }
    }
  }
}

// Listen for image uploads in threads and run OCR only if thread is pending
import { markThreadPendingScore } from './src/interactions/submit_score.js';
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  // Only process if thread is marked as waiting for score
  await handleImageOCR(message);
});

// Handle interactions (commands and autocomplete)
client.on('interactionCreate', async interaction => {
  console.log('[DEBUG] interactionCreate event:', {
    type: interaction.type,
    customId: interaction.customId,
    commandName: interaction.commandName,
    user: interaction.user?.tag,
    userId: interaction.user?.id
  });

  // All interactions are now routed through the generic handler system below

  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    console.log(`[COMMAND] /${interaction.commandName} used by ${interaction.user?.tag || interaction.user?.id}`);
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`❌ No command handler found for /${interaction.commandName}`);
      await interaction.reply({ content: 'Command not found.', ephemeral: true });
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Error executing command /${interaction.commandName}:`, error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'There was an error while executing this command!' });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      } catch (replyError) {
        console.error('❌ Failed to send error message:', replyError);
      }
    }
    return;
  }

  // Handle autocomplete interactions for slash commands
  if (interaction.isAutocomplete()) {
    console.log(`[AUTOCOMPLETE] /${interaction.commandName} triggered by ${interaction.user?.tag || interaction.user?.id}`);
    const command = client.commands.get(interaction.commandName);
    if (!command || typeof command.autocomplete !== 'function') {
      console.error(`❌ No autocomplete handler found for /${interaction.commandName}`);
      try { await interaction.respond([]); } catch { }
      return;
    }
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`❌ Error in autocomplete for /${interaction.commandName}:`, error);
      try { await interaction.respond([{ name: 'Error loading options', value: 'none' }]); } catch { }
    }
    return;
  }

  // Improved logging for other interaction types
  if (interaction.isButton()) {
    console.log(`[BUTTON] ${interaction.customId} clicked by ${interaction.user?.tag || interaction.user?.id}`);
  } else if (interaction.isStringSelectMenu()) {
    console.log(`[SELECT] ${interaction.customId} used by ${interaction.user?.tag || interaction.user?.id}`);
  } else if (interaction.isAutocomplete()) {
    // Handle trade and progression buttons, and generic interaction handlers as before
  }

  // --- REGEX/GENERIC BUTTONS: robust customId matching ---
  if (interaction.customId) {
    let foundHandler = null;
    for (const handler of client.interactionHandlers) {
      if (typeof handler.customId === 'string' && handler.customId === interaction.customId) {
        foundHandler = handler;
        break;
      }
      if (handler.customId instanceof RegExp && handler.customId.test(interaction.customId)) {
        foundHandler = handler;
        break;
      }
    }
    if (!foundHandler) {
      console.error(`❌ No interaction handler matching ${interaction.customId} was found.`);
      return;
    }
    try {
      await foundHandler.execute(interaction);
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
});

// Bot clientReady event (Discord.js v15+)
client.once('clientReady', (readyClient) => {
  console.log(`ENVIRONMENT: ${process.env.NODE_ENV || 'undefined'}`);
  console.log('🏀 LEAGUEbuddy is online!');
  console.log(`📊 Logged in as ${readyClient.user.tag}`);
  console.log(`🏟️  Serving ${readyClient.guilds.cache.size} server(s)`);
  console.log(`⚡ Loaded ${client.commands.size} commands`);
});


// Load all commands from src/commands/coach and src/commands/staff
async function loadCommands() {
  const commandFolders = ['coach', 'staff'];
  for (const folder of commandFolders) {
    const commandsPath = join(process.cwd(), 'src', 'commands', folder);
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const fileURL = pathToFileURL(filePath).href;
      try {
        const commandModule = await import(fileURL);
        const cmd = commandModule.default || commandModule;
        if (cmd.data && cmd.execute) {
          client.commands.set(cmd.data.name, cmd);
        }
      } catch (err) {
        console.error(`❌ Failed to load command ${file}:`, err);
      }
    }
  }
}

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN is not set in environment. Exiting.');
  process.exit(1);
} else {
  console.log('✅ Discord token found (not shown for security).');
}

// Robust handleImageOCR implementation
async function handleImageOCR(message) {
  // Only process if in a thread
  if (!message.channel || !message.channel.isThread()) return;
  // Only process if thread is marked as pending
  const threadKey = `${message.channel.id}:${message.channel.expectedTeam || ''}`;
  if (!submitScore.pendingScoreThreads || !submitScore.pendingScoreThreads.has(threadKey)) return;
  // Only process if there is an attachment
  if (!message.attachments || message.attachments.size === 0) return;
  // Determine expected image type
  const imageType = message.channel.expectedImageType;
  if (imageType === 'box_score' && typeof submitScore.handleBoxScoreImage === 'function') {
    await submitScore.handleBoxScoreImage(message);
  } else if (imageType === 'team_comparison' && typeof submitScore.handleTeamComparisonImage === 'function') {
    await submitScore.handleTeamComparisonImage(message);
  } else {
    // Fallback: log and ignore
    console.log('[handleImageOCR] No handler for image type:', imageType);
  }
}

(async () => {
  try {
    await loadCommands();
    await client.login(token);
    console.log('Bot login successful, process should stay alive.');
  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  }
})();

