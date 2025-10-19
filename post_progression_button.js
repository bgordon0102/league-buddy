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
    const msg = await channel.send({
        content: `📌 **PLAYER PROGRESSION SYSTEM**\n\nFor every 5 games played, you earn upgrade points to use on up to 2 players.\n\n**Key Rules:**\n• Max **+3** to any single attribute per upgrade (you cannot apply all your points to one attribute)\n• Max 2 upgrades per player per season\n• Eligible players must play 15+ minutes per game\n• Player OVR cannot exceed their potential rating\n• Players age 30+ must finish top 3 in award voting to qualify\n• Commissioners verify all stats using league data\n\n**Upgrade Tiers:**\n• Tier 1: 3 points\n• Tier 2: 4 points\n• Tier 3: 5 points\n• Tier 4: 6 points\n• Tier 5: 7 points\n\n📤 **How to Submit:**\nUse the button below and fill out the form. All new users get a tier-based upgrade to apply to a skill set!`,
        components: [new ActionRowBuilder().addComponents(button)]
    });
    await msg.pin();
    console.log('Progression button posted and pinned!');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
