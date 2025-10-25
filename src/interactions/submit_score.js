// Handle submit score button interaction
export async function handleSubmitScore(interaction) {
    await interaction.reply({ content: 'Score submission received. (Stub handler)', ephemeral: true });
}
export const customId_submit_team_comparison = 'submit_team_comparison';
export const customId_modal_set_game_info = 'modal_set_game_info';
export async function execute_modal_set_game_info(interaction) {
    await handleSetGameInfoModal(interaction);
}

// Utility: Normalize team names to full names
const teamMap = {
    'Trail Blazers': 'Portland Trail Blazers',
    'Celtics': 'Boston Celtics',
    'Warriors': 'Golden State Warriors',
    'Lakers': 'Los Angeles Lakers',
    'Knicks': 'New York Knicks',
    'Nets': 'Brooklyn Nets',
    'Bulls': 'Chicago Bulls',
    'Heat': 'Miami Heat',
    'Suns': 'Phoenix Suns',
    'Spurs': 'San Antonio Spurs',
    'Raptors': 'Toronto Raptors',
    'Jazz': 'Utah Jazz',
    'Wizards': 'Washington Wizards',
    'Thunder': 'Oklahoma City Thunder',
    'Magic': 'Orlando Magic',
    '76ers': 'Philadelphia 76ers',
    'Pelicans': 'New Orleans Pelicans',
    'Grizzlies': 'Memphis Grizzlies',
    'Mavericks': 'Dallas Mavericks',
    'Cavaliers': 'Cleveland Cavaliers',
    'Pistons': 'Detroit Pistons',
    'Pacers': 'Indiana Pacers',
    'Rockets': 'Houston Rockets',
    'Clippers': 'Los Angeles Clippers',
    'Nuggets': 'Denver Nuggets',
    'Bucks': 'Milwaukee Bucks',
    'Hornets': 'Charlotte Hornets',
    'Kings': 'Sacramento Kings',
    'Hawks': 'Atlanta Hawks',
    'Timberwolves': 'Minnesota Timberwolves',
};
function normalize(name) {
    if (!name) return null;
    name = name.replace(/[^a-zA-Z ]/g, '').trim();
    return teamMap[name] || name;
}
import { DataManager } from '../utils/dataManager.js';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import fs from 'fs';
import Tesseract from 'tesseract.js';
import https from 'https';

const pendingScoreThreads = new Set();

function markThreadPendingScore(threadId) {
    pendingScoreThreads.add(threadId);
}

// Handle Set Game Info button (shows modal)
async function handleSetGameInfo(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_set_game_info')
        .setTitle('Set Game Info')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('2k_date')
                    .setLabel('2K In-Game Date')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
    await interaction.showModal(modal);
}

// Handle Set Game Info modal submit (moved to top-level)
async function handleSetGameInfoModal(interaction) {
    const date = interaction.fields.getTextInputValue('2k_date');
    const threadName = interaction.channel.name || '';
    const parts = threadName.split(/-vs-/i).map(s => s.replace(/-w\d+|-week\d+/i, '').trim());
    let teamA = normalize(parts[0] || 'Team A');
    let teamB = normalize(parts[1] || 'Team B');
    let coachRoleMap = {};
    try {
        coachRoleMap = JSON.parse(fs.readFileSync('./data/coachRoleMap.json', 'utf8'));
    } catch (err) { }
    const mentions = [];
    if (coachRoleMap[teamA]) mentions.push(`<@&${coachRoleMap[teamA]}>`);
    if (coachRoleMap[teamB]) mentions.push(`<@&${coachRoleMap[teamB]}>`);
    const coachMentions = mentions.join(' & ') || `${teamA} Coach & ${teamB} Coach`;
    let content = `**Game Info: ${date}**\nWelcome ${coachMentions}!\nPlease coordinate your matchup here. Each coach must submit their own Box Score image for stat tracking.\n\n:warning: **Box Score Submission Instructions:**\n1. After your game, exit and go to your game on the calendar.\n2. Select the game on the calendar and hit 'View Box Score'.\n3. Each coach: Take a clear picture of your team's Box Score page.\n4. Winning coach: Take a clear picture of the Team Comparison page.\n5. Use your phone's gallery settings to convert all images to mono filter (grayscale photo). This is the only way for the bot to pick up the info correctly.\n6. Press your team's submit button below to send your Box Score image.\n7. Winning coach: Press the Team Comparison button below and upload the Team Comparison image.\n8. The bot will read the images and process your stats automatically.\n\n**Note:** Both Box Score images and the Team Comparison image are required for a valid submission.`;
    let components = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`submit_score_${teamA.replace(/\s+/g, '_').toLowerCase()}`)
                .setLabel(`${teamA} Submit Score`)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`submit_score_${teamB.replace(/\s+/g, '_').toLowerCase()}`)
                .setLabel(`${teamB} Submit Score`)
                .setStyle(ButtonStyle.Primary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('submit_team_comparison')
                .setLabel('Submit Team Comparison')
                .setStyle(ButtonStyle.Success)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('approve_score')
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('deny_score')
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger)
        )
    ];
    const pins = await interaction.channel.messages.fetchPinned();
    const botPin = pins.find(m => m.author.id === interaction.client.user.id);
    if (botPin) await botPin.edit({ content, components });
    await interaction.reply({ content: 'Game info set!', ephemeral: true });
}

// ...existing code for other handlers...

// Stub: handleBoxScoreImage
async function handleBoxScoreImage(message) {
    const attachment = message.attachments?.first();
    if (!attachment) {
        await message.channel.send('No image attachment found. Please upload your box score as a file.');
        return;
    }
    await message.channel.send('Processing box score image...');
    const imageUrl = attachment.url;
    try {
        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        const result = await Tesseract.recognize(Buffer.from(imageBuffer), 'eng', { logger: m => console.log(m) });
        const text = result.data.text;
        const threadId = message.channel.id;
        if (!pendingOcrResults.has(threadId)) pendingOcrResults.set(threadId, {});
        pendingOcrResults.get(threadId).boxScores = pendingOcrResults.get(threadId).boxScores || [];
        pendingOcrResults.get(threadId).boxScores.push({ user: message.author.id, text });
        await message.channel.send(`Box Score processed for ${message.author}. Text:\n\n${text}`);
    } catch (err) {
        await message.channel.send('Failed to process image. Please try again or use a clearer image.');
        console.error('[OCR ERROR]', err);
    }
}

// Stub: handleTeamComparisonImage
async function handleTeamComparisonImage(message) {
    const attachment = message.attachments?.first();
    if (!attachment) {
        await message.channel.send('No image attachment found. Please upload your team comparison as a file.');
        return;
    }
    await message.channel.send('Processing team comparison image...');
    const imageUrl = attachment.url;
    try {
        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        const result = await Tesseract.recognize(Buffer.from(imageBuffer), 'eng', { logger: m => console.log(m) });
        const text = result.data.text;
        const threadId = message.channel.id;
        if (!pendingOcrResults.has(threadId)) pendingOcrResults.set(threadId, {});
        pendingOcrResults.get(threadId).teamComparison = { user: message.author.id, text };
        await message.channel.send(`Team Comparison processed for ${message.author}. Text:\n\n${text}`);
    } catch (err) {
        await message.channel.send('Failed to process image. Please try again or use a clearer image.');
        console.error('[OCR ERROR]', err);
    }
}

// ...existing code for exports...
export const customId_set_game_info = 'set_game_info';
export async function execute_set_game_info(interaction) {
    await handleSetGameInfo(interaction);
}
export {
    markThreadPendingScore,
    handleSetGameInfo,
    handleSetGameInfoModal,
    handleBoxScoreImage,
    handleTeamComparisonImage,
};