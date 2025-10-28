import dotenv from 'dotenv';
import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const CHANNEL_ID = '1428097786272026736';

client.once('ready', async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const button = new ButtonBuilder()
        .setCustomId('submit_progression_button')
        .setLabel('Submit Progression')
        .setStyle(ButtonStyle.Primary);
    const embed = {
        color: 0x5865F2,
        title: '📌 Player Progression System',
        description:
            '**Player Progression System**\n' +
            'Submit your player progression using the button below.\n\n' +
            'Select a skill set below to apply your tier-based upgrade to.\n\n' +
            '**Skill-Sets (Groups of Attributes):**\n' +
            '• **Post Scoring:** Close Shot, Standing Dunk, Layup, Dunks, Post Hook, Post Fade, Post Control\n' +
            '• **Shooting:** Mid-Range, 3PT, Free Throw\n' +
            '• **Inside Defense:** Interior D, Block, Help IQ\n' +
            '• **Perimeter Defense:** Perimeter D, Steal, Pass Perception\n' +
            '• **Playmaking:** Ball Handling, Speed w/ Ball, Hands, Pass, Pass IQ, Vision\n' +
            '• **Rebounding:** Offensive/Defensive Rebounds\n' +
            '• **IQ:** Offensive/Defensive Consistency, Shot IQ, Draw Foul\n\n' +
            '**Special Options (One-Time Perks):**\n' +
            '• **Conditioning:** +5 to use on Speed, Accel, Agility, Vertical, Stamina\n' +
            '• **Weight Room:** +3 Strength, +8 lbs, -1 Speed, Accel, Vertical\n' +
            '• **Shooting Mechanics:** Adjust Shot Timing\n' +
            '• **Distributor:** Enables Play Initiator (80+ Ball Handle)\n' +
            '• **X-Factor:** +3 Potential\n\n' +
            '**Tier Values (per team):**\n' +
            '• Tier 1: 3 points\n' +
            '• Tier 2: 4 points\n' +
            '• Tier 3: 5 points\n' +
            '• Tier 4: 6 points\n' +
            '• Tier 5: 7 points\n\n' +
            '**Example:**\n' +
            'Tier 3 team = 5 pts. You choose Shooting.\n' +
            '+3 to 3PT, +2 to Free Throw\n\n' +
            '✨ New users start with 1 free tier-based upgrade!',
        footer: {
            text: '➡️ Submit using the button below'
        }
    };
    const msg = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
    await msg.pin();
    console.log('Progression button posted and pinned!');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
