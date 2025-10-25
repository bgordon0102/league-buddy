// Puppeteer-based scraper for https://www.2kratings.com/current-teams
// Usage: node scripts/scrape_2kratings_puppeteer.js
import puppeteer from 'puppeteer';
import fs from 'fs';

const MAIN_URL = 'https://www.2kratings.com/current-teams';
const OUTPUT_FILE = './data/teamLinks.json';

async function scrapeMainTeamsPage() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(MAIN_URL, { waitUntil: 'networkidle2' });
    // Wait for team links to load
    await page.waitForSelector('a[href^="https://www.2kratings.com/teams/"]');
    // Extract team names and URLs
    const teams = await page.$$eval('a[href^="https://www.2kratings.com/teams/"]', els =>
        els.map(el => ({
            name: el.textContent.trim(),
            url: el.href
        }))
    );
    await browser.close();
    return teams;
}

scrapeMainTeamsPage()
    .then(teams => {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(teams, null, 2));
        console.log(`Scraped ${teams.length} teams. Results saved to ${OUTPUT_FILE}`);
    })
    .catch(err => {
        console.error('Scraper error:', err);
    });
