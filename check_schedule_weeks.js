// Script to check that each week in schedule.json has exactly 15 games (ESM version)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schedulePath = path.join(__dirname, 'data', 'schedule.json');
const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

schedule.forEach((week, i) => {
    if (!Array.isArray(week)) {
        console.log(`Week ${i}: Not an array!`);
        return;
    }
    if (week.length !== 15) {
        console.log(`Week ${i}: ${week.length} games (should be 15)`);
    }
});

console.log('Check complete.');
