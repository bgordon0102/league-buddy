// Scrape team details and rosters from 2kratings.com using Puppeteer
// Usage: node scripts/scrape_2kratings_teams_puppeteer.js
import puppeteer from 'puppeteer';
import fs from 'fs';

const TEAM_LINKS_FILE = './data/teamLinks.json';
const OUTPUT_DIR = './data/teams_rosters';

async function scrapeTeamPage(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    // Team tier
    const tier = await page.$eval('span.attribute-box.bronze[data-order]', el => el.textContent.trim());
    // Team overall rating
    const ovr = await page.$eval('span.attribute-box.emerald[data-order]', el => el.textContent.trim());
    // Roster: player names and profile URLs
    const playerLinks = await page.$$eval('a[href^="https://www.2kratings.com/"]', els =>
        els.filter(el => el.href.includes('/'))
            .map(el => ({ name: el.textContent.trim(), url: el.href }))
    );
    let roster = [];
    for (const player of playerLinks) {
        const playerPage = await browser.newPage();
        await playerPage.goto(player.url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(res => setTimeout(res, 1000));
        const priorToNBA = await playerPage.evaluate(() => {
            const priorNBA = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Prior to NBA:'));
            if (priorNBA) {
                return priorNBA.textContent.replace('Prior to NBA:', '').trim();
            }
            return '';
        });
        roster.push({ name: player.name, url: player.url, prior_to_nba: priorToNBA });
        await playerPage.close();
    }
    await browser.close();
    return { tier, ovr, roster };
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
    const teamLinks = JSON.parse(fs.readFileSync(TEAM_LINKS_FILE, 'utf8'));
    for (const team of teamLinks) {
        console.log(`Scraping ${team.name}...`);
        try {
            const details = await scrapeTeamPage(team.url);
            const outPath = `${OUTPUT_DIR}/${team.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            fs.writeFileSync(outPath, JSON.stringify({ name: team.name, ...details }, null, 2));
            console.log(`Saved: ${outPath}`);
        } catch (err) {
            console.error(`Error scraping ${team.name}:`, err.message);
        }
    }
    console.log('All teams scraped.');
}

main();
