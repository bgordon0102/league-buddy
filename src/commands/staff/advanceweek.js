function writeJSON(file, data) {
    try {
        if (typeof data === 'undefined') {
            console.error(`[writeJSON] Tried to write undefined data to ${file}`);
            return;
        }
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        // Confirm file write
        const confirm = fs.readFileSync(file, 'utf8');
        if (!confirm || confirm.length === 0) {
            console.error(`[writeJSON] File ${file} written but is empty!`);
        } else {
            console.log(`[writeJSON] Successfully wrote to ${file}. Length: ${confirm.length}`);
        }
    } catch (err) {
        console.error(`[writeJSON] Failed to write to ${file}:`, err);
        throw err;
    }
}

function safeReadJSON(file, fallback) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        if (!data) throw new Error('Empty file');
        return JSON.parse(data);
    } catch {
        console.warn(`[advanceweek] File ${file} missing or invalid, using fallback.`);
        writeJSON(file, fallback);
        return fallback;
    }
}
export const data = new SlashCommandBuilder()
    .setName('advanceweek')
    .setDescription('Advance the current week by 1, or specify a week to advance to')
    .addIntegerOption(option =>
        option.setName('week')
            .setDescription('The week number to advance to (optional)')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { sendWelcomeAndButton } from '../../interactions/submit_score.js';
// ...existing code...
import { EmbedBuilder } from 'discord.js';


const SEASON_FILE = './data/season.json';


function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: false });
        // Restore: read season.json, calculate weekNum, validate
        const season = safeReadJSON(SEASON_FILE, { currentWeek: 1, seasonNo: 1, coachRoleMap: {} });
        if (!season.currentWeek || season.currentWeek < 1) {
            season.currentWeek = 1;
        }
        let weekNum = interaction.options.getInteger('week') || season.currentWeek;
        const totalWeeks = 29;
        if (weekNum < 1 || weekNum > totalWeeks) {
            await interaction.editReply({ content: `Invalid week number. Must be between 1 and ${totalWeeks}.` });
            return;
        }
        await interaction.editReply({ content: `Advanceweek: weekNum is ${weekNum}, currentWeek in season.json is ${season.currentWeek}` });
    } catch (err) {
        console.error('[advanceweek] Error:', err);
    }
}

