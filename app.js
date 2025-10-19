
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readdirSync, createWriteStream } from 'fs';
import fs from 'fs';
const coachRoleMap = JSON.parse(fs.readFileSync('./data/coachRoleMap.json', 'utf8'));

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
    if (command && typeof command.autocomplete === 'function') {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`[Autocomplete] Error executing autocomplete for ${interaction.commandName}:`, err);
      }
    }
    return;
  }

  // Handle slash command interactions
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: 'Command not found.', ephemeral: true });
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Command] Error executing ${interaction.commandName}:`, err);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'There was an error while executing this command!' });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      } catch (replyError) {
        console.error('❌ Failed to send error message for command:', replyError);
      }
    }
    return;
  }

  // Handle button interactions (including trade flow and regex customId)
  let interactionHandler = client.interactions.get(interaction.customId);
  // If not found, try regex match
  if (!interactionHandler) {
    for (const [key, handler] of client.interactions.entries()) {
      if (key instanceof RegExp && key.test(interaction.customId)) {
        interactionHandler = handler;
        break;
      }
    }
  }
  if (interactionHandler && typeof interactionHandler.execute === 'function') {
    try {
      await interactionHandler.execute(interaction);
    } catch (err) {
      console.error(`[Button Interaction] Error executing handler for customId ${interaction.customId}:`, err);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'There was an error while executing this button interaction!' });
        } else {
          await interaction.reply({ content: 'There was an error while executing this button interaction!', flags: 64 });
        }
      } catch (replyError) {
        console.error('❌ Failed to send error message for button interaction:', replyError);
      }
    }
    return;
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

