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
        content: `📌 This is where you can progress your players.\n\nPROGRESSION SYSTEM\n\nFor every five games played, you earn upgrade points to use on upgrading 2 players’ <#1428851094133542933>\n**Eligible players must play 15+ minutes per game**\n\n**YOUR PLAYERS OVR CAN’T EXCEED THEIR POTENTIAL RATING**\n\n• Each upgrade costs points and improves one skill set attribute\n• Max 2 upgrades per player per season\n• Players age 30+ must finish top 3 in award voting to qualify\n• Commissioners verify all stats using league data\n\n📤 HOW TO SUBMIT UPGRADE REQUESTS\n\nUse the button below and fill out the form.\n\n**All new users get an upgrade based on tiers to apply to a skill set!**\n\n**Tier 5 - 7 points\nTier 4 - 6 points\nTier 3 - 5 points\nTier 2 - 4 points\nTier 1 - 3 points**`,
        components: [new ActionRowBuilder().addComponents(button)]
    });
    await msg.pin();
    console.log('Progression button posted and pinned!');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
