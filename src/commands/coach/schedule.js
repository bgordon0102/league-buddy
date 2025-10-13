// commands/schedule.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";


export const data = new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Show a team's NBA season schedule")
    .addStringOption((option) =>
        option
            .setName("team")
            .setDescription("The NBA team to view the schedule for")
            .setRequired(true)
            .setAutocomplete(true)
    );
// Autocomplete handler for team names
export async function autocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused();
        const teamsPath = path.join(process.cwd(), "data/teams.json");
        let teams = [];
        if (fs.existsSync(teamsPath)) {
            try {
                teams = JSON.parse(fs.readFileSync(teamsPath, "utf8"));
                console.log(`[autocomplete] Loaded teams from teams.json:`, teams);
            } catch (e) {
                console.error('[autocomplete] Failed to parse teams.json:', e);
            }
        } else {
            console.error('[autocomplete] teams.json does not exist at', teamsPath);
        }
        const filtered = teams.filter(team => team.name && team.name.toLowerCase().includes(focusedValue.toLowerCase()));
        console.log(`[autocomplete] Focused value: '${focusedValue}', Filtered:`, filtered);
        await interaction.respond(
            filtered.map(team => ({ name: team.name, value: team.name })).slice(0, 25)
        );
        return;
    } catch (err) {
        console.error('[autocomplete] Fatal error:', err);
        // If error, respond with empty array and return
        try { await interaction.respond([]); } catch { }
        return;
    }
}

export async function execute(interaction) {
    const team = interaction.options.getString("team");

    // Path to teams and schedule files
    const teamsPath = path.join(process.cwd(), "data/teams.json");
    const schedulePath = path.join(process.cwd(), "data/schedule.json");
    const seasonPath = path.join(process.cwd(), "data/season.json");
    if (!fs.existsSync(teamsPath) || !fs.existsSync(schedulePath) || !fs.existsSync(seasonPath)) {
        return interaction.reply({
            content: "No season data found. Please run `/startseason` first.",
            ephemeral: true,
        });
    }

    const teams = JSON.parse(fs.readFileSync(teamsPath, "utf8"));
    const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
    const seasonData = JSON.parse(fs.readFileSync(seasonPath, "utf8"));
    const currentWeek = seasonData.currentWeek;

    // Build a week-by-week list for this team, showing only the opponent
    let week = 1;
    // schedule is now an array of weeks, each week is an array of games
    const gamesList = schedule
        .flat()
        .map((g) => {
            let opponent = null;
            if (g.team1 && g.team1.name === team) {
                opponent = g.team2 && g.team2.name ? g.team2.name : '';
            } else if (g.team2 && g.team2.name === team) {
                opponent = g.team1 && g.team1.name ? g.team1.name : '';
            }
            if (!opponent) return null;
            const line = week === currentWeek
                ? `➡️ **W${week}. ${opponent}**`
                : `W${week}. ${opponent}`;
            week++;
            return line;
        })
        .filter(Boolean)
        .join("\n");

    const send = async (msg) => {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(msg);
        } else {
            await interaction.reply(msg);
        }
    };

    if (!gamesList) {
        return send({
            content: `No schedule found for **${team}**.`,
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`${team} Season Schedule`)
        .setColor(0x1e90ff)
        .setDescription(gamesList)
        .setFooter({ text: `Current Week: ${currentWeek}` });

    await send({ embeds: [embed] });
}
