// Unified Puppeteer scraper for 2kratings.com
// Usage: node scripts/scrape_2kratings_full_puppeteer.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const MAIN_URL = 'https://www.2kratings.com/current-teams';
const OUTPUT_DIR = './data/teams_rosters';
const CURRENT_TEAM_URLS = [
    'https://www.2kratings.com/teams/atlanta-hawks',
    'https://www.2kratings.com/teams/boston-celtics',
    'https://www.2kratings.com/teams/brooklyn-nets',
    'https://www.2kratings.com/teams/charlotte-hornets',
    'https://www.2kratings.com/teams/chicago-bulls',
    'https://www.2kratings.com/teams/cleveland-cavaliers',
    'https://www.2kratings.com/teams/dallas-mavericks',
    'https://www.2kratings.com/teams/denver-nuggets',
    'https://www.2kratings.com/teams/detroit-pistons',
    'https://www.2kratings.com/teams/golden-state-warriors',
    'https://www.2kratings.com/teams/houston-rockets',
    'https://www.2kratings.com/teams/indiana-pacers',
    'https://www.2kratings.com/teams/los-angeles-clippers',
    'https://www.2kratings.com/teams/los-angeles-lakers',
    'https://www.2kratings.com/teams/memphis-grizzlies',
    'https://www.2kratings.com/teams/miami-heat',
    'https://www.2kratings.com/teams/milwaukee-bucks',
    'https://www.2kratings.com/teams/minnesota-timberwolves',
    'https://www.2kratings.com/teams/new-orleans-pelicans',
    'https://www.2kratings.com/teams/new-york-knicks',
    'https://www.2kratings.com/teams/oklahoma-city-thunder',
    'https://www.2kratings.com/teams/orlando-magic',
    'https://www.2kratings.com/teams/philadelphia-76ers',
    'https://www.2kratings.com/teams/phoenix-suns',
    'https://www.2kratings.com/teams/portland-trail-blazers',
    'https://www.2kratings.com/teams/sacramento-kings',
    'https://www.2kratings.com/teams/san-antonio-spurs',
    'https://www.2kratings.com/teams/toronto-raptors',
    'https://www.2kratings.com/teams/utah-jazz',
    'https://www.2kratings.com/teams/washington-wizards',
    'https://www.2kratings.com/teams/free-agency'
];

async function scrapeMainTeamsPage(page) {
    console.log('Navigating to main teams page...');
    await page.goto(MAIN_URL, { waitUntil: 'networkidle2' });
    console.log('Waiting for team links to load...');
    await new Promise(res => setTimeout(res, 5000)); // Wait 5 seconds for Cloudflare and dynamic content
    console.log('Step: Waiting for team links selector...');
    try {
        await page.waitForSelector('a[href*="/teams/"]', { timeout: 60000 });
    } catch (err) {
        const html = await page.content();
        fs.writeFileSync('debug_teams_page.html', html);
        console.log('Step: Failed to find team links selector. Dumped HTML to debug_teams_page.html');
        throw new Error('Team links selector not found. HTML dumped to debug_teams_page.html');
    }
    console.log('Step: Extracting team links...');
    const teams = await page.$$eval('a[href*="/teams/"]', els =>
        els.filter(el => el.href.includes('/teams/') && el.textContent && el.textContent.length > 0)
            .map(el => ({ name: el.textContent.trim(), url: el.href }))
    );
    console.log(`Step: Found ${teams.length} teams.`);
    return teams;
}

async function scrapeTeamPage(page, url) {
    console.log(`Step: Loading team page: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Step: Waiting for team page content...');
    await new Promise(res => setTimeout(res, 7000)); // Increased wait for Cloudflare/dynamic content
    let roster = [];
    try {
        const playerLinks = await page.$$eval('.entry-font a', els =>
            els
                .filter(el => {
                    const name = el.textContent.trim();
                    const url = el.href;
                    if (!name || name.length < 2) return false;
                    if (/All-Time|\d{4}-\d{2}/.test(name)) return false;
                    if (/\/teams\//.test(url)) return false;
                    return true;
                })
                .map(el => ({ name: el.textContent.trim(), url: el.href }))
        );

        const browser = page.browser();
        let playerCount = 0;
        for (const player of playerLinks) {
            playerCount++;
            console.log(`   - Scraping player [${playerCount}/${playerLinks.length}]: ${player.name}`);
            try {
                const playerPage = await browser.newPage();
                await playerPage.goto(player.url, { waitUntil: 'networkidle2', timeout: 90000 });
                try {
                    await playerPage.waitForSelector('.player-img img, .player-headshot img, .attributes-table, img.profile-photo', { timeout: 5000 });
                } catch (waitErr) {
                    // Silently ignore timeout, do not log
                }
                await new Promise(res => setTimeout(res, 1000));
                // Extract only the required fields
                const details = await playerPage.evaluate(() => {
                    // Name
                    const name = document.querySelector('h1.header-title')?.textContent?.trim() || '';
                    // Position(s)
                    let position = '';
                    const posP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Position:'));
                    if (posP) {
                        const posLinks = posP.querySelectorAll('a.text-light');
                        position = Array.from(posLinks).map(a => a.textContent.trim()).join(' / ');
                    }
                    // Height
                    let height = '';
                    const heightP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Height:'));
                    if (heightP) {
                        height = heightP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    // Weight
                    let weight = '';
                    const weightP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Weight:'));
                    if (weightP) {
                        weight = weightP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    // Archetype
                    let archetype = '';
                    const archP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Archetype:'));
                    if (archP) {
                        archetype = archP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    // Birthdate
                    let birthdate = '';
                    const birthP = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Birthdate:'));
                    if (birthP) {
                        birthdate = birthP.textContent.replace('Birthdate:', '').trim();
                    }
                    // Years in NBA
                    let yearsInNBA = '';
                    const yearsP = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Year(s) in the NBA:'));
                    if (yearsP) {
                        yearsInNBA = yearsP.textContent.replace('Year(s) in the NBA:', '').trim();
                    }
                    // Salary
                    let salary = '';
                    const salaryP = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Season Salary:'));
                    if (salaryP) {
                        salary = salaryP.textContent.replace('Season Salary:', '').trim();
                    }
                    // Wingspan
                    let wingspan = '';
                    const wingspanP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Wingspan:'));
                    if (wingspanP) {
                        wingspan = wingspanP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    // Image URL
                    let imgUrl = '';
                    const imgEl = document.querySelector('img.profile-photo');
                    if (imgEl) {
                        imgUrl = imgEl.src || imgEl.getAttribute('src') || '';
                    }
                    // Overall rating (robust: try all badge colors)
                    let ovr = '';
                    const ovrSpan = document.querySelector('span.attribute-box-player.opal')
                        || document.querySelector('span.attribute-box-player.diamond')
                        || document.querySelector('span.attribute-box-player.silver')
                        || document.querySelector('span.attribute-box-player.gold')
                        || document.querySelector('span.attribute-box-player.emerald')
                        || document.querySelector('span.attribute-box-player.ruby')
                        || document.querySelector('span.attribute-box-player.sapphire')
                        || document.querySelector('span.attribute-box-player.amethyst')
                        || document.querySelector('span.attribute-box-player.bronze');
                    if (ovrSpan) {
                        ovr = ovrSpan.textContent.trim();
                    }
                    return {
                        name,
                        position,
                        height,
                        weight,
                        archetype,
                        birthdate,
                        yearsInNBA,
                        salary,
                        wingspan,
                        imgUrl,
                        ovr
                    };
                });
                // Log missing fields in terminal
                const missing = [];
                for (const key of ['name', 'position', 'height', 'weight', 'archetype', 'birthdate', 'yearsInNBA', 'salary', 'wingspan', 'imgUrl', 'ovr']) {
                    if (!details[key]) missing.push(key);
                }
                if (missing.length) {
                    console.log(`     Not found for ${player.name}: ${missing.join(', ')}`);
                }
                roster.push(details);
                await playerPage.close();
            } catch (err) {
                console.error(`   - Error scraping player ${player.name}:`, err.message);
            }
        }
        console.log(`Step: Extracted ${roster.length} players.`);
        return roster;
    } catch (err) {
        console.error(`   - Error in scrapeTeamPage: ${err.message}`);
        return roster;
    }
}

async function scrapeAllTeams(browser) {
    // Use only CURRENT_TEAM_URLS
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    for (let i = 0; i < CURRENT_TEAM_URLS.length; i++) {
        const url = CURRENT_TEAM_URLS[i];
        const teamPage = await browser.newPage();
        console.log(`Step: Loading team [${i + 1}/${CURRENT_TEAM_URLS.length}]: ${url}`);
        const roster = await scrapeTeamPage(teamPage, url);
        await teamPage.close();
        // Extract team name from URL
        const teamNameMatch = url.match(/teams\/([a-zA-Z0-9-]+)/);
        const teamName = teamNameMatch ? teamNameMatch[1].replace(/-/g, '_') : `team_${i + 1}`;
        const outPath = `${OUTPUT_DIR}/${teamName}.json`;
        fs.writeFileSync(outPath, JSON.stringify(roster, null, 2));
        console.log(`Saved roster for ${teamName} to ${outPath}`);
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        await scrapeAllTeams(browser);
    } catch (err) {
        console.error('Error in main process:', err);
    } finally {
        await browser.close();
    }
})();
