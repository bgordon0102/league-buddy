// Single-team NBA 2K ratings scraper
// Usage: node scripts/scrape_2kratings_team.js "https://www.2kratings.com/teams/charlotte-hornets"
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const OUTPUT_DIR = './data/teams_rosters';

async function scrapeTeamPage(page, url) {
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
                const details = await playerPage.evaluate(() => {
                    const name = document.querySelector('h1.header-title')?.textContent?.trim() || '';
                    let position = '';
                    const posP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Position:'));
                    if (posP) {
                        const posLinks = posP.querySelectorAll('a.text-light');
                        position = Array.from(posLinks).map(a => a.textContent.trim()).join(' / ');
                    }
                    let height = '';
                    const heightP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Height:'));
                    if (heightP) {
                        height = heightP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    let weight = '';
                    const weightP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Weight:'));
                    if (weightP) {
                        weight = weightP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    let archetype = '';
                    const archP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Archetype:'));
                    if (archP) {
                        archetype = archP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    let birthdate = '';
                    const birthP = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Birthdate:'));
                    if (birthP) {
                        birthdate = birthP.textContent.replace('Birthdate:', '').trim();
                    }
                    let yearsInNBA = '';
                    const yearsP = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Year(s) in the NBA:'));
                    if (yearsP) {
                        yearsInNBA = yearsP.textContent.replace('Year(s) in the NBA:', '').trim();
                    }
                    let salary = '';
                    const salaryP = Array.from(document.querySelectorAll('p.text-light.mb-1.my-lg-0')).find(p => p.textContent.includes('Season Salary:'));
                    if (salaryP) {
                        salary = salaryP.textContent.replace('Season Salary:', '').trim();
                    }
                    let wingspan = '';
                    const wingspanP = Array.from(document.querySelectorAll('p.mb-1.my-lg-0')).find(p => p.textContent.includes('Wingspan:'));
                    if (wingspanP) {
                        wingspan = wingspanP.querySelector('span.text-light')?.textContent?.trim() || '';
                    }
                    let imgUrl = '';
                    const imgEl = document.querySelector('img.profile-photo');
                    if (imgEl) {
                        imgUrl = imgEl.src || imgEl.getAttribute('src') || '';
                    }
                    let ovr = '';
                    const ovrSpan = document.querySelector('span.attribute-box-player.pinkdiamond')
                        || document.querySelector('span.attribute-box-player.opal')
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

(async () => {
    const teamUrl = process.argv[2];
    if (!teamUrl || !/^https:\/\/www\.2kratings\.com\/teams\//.test(teamUrl)) {
        console.error('Usage: node scripts/scrape_2kratings_team.js "https://www.2kratings.com/teams/charlotte-hornets"');
        process.exit(1);
    }
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    protocolTimeout: 180000 // 3 minutes
    try {
        const page = await browser.newPage();
        console.log(`Step: Loading team: ${teamUrl}`);
        await page.goto(teamUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(res => setTimeout(res, 7000));
        const roster = await scrapeTeamPage(page, teamUrl);
        await page.close();
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        const teamNameMatch = teamUrl.match(/teams\/([a-zA-Z0-9-]+)/);
        const teamName = teamNameMatch ? teamNameMatch[1].replace(/-/g, '_') : 'team';
        const outPath = `${OUTPUT_DIR}/${teamName}.json`;
        fs.writeFileSync(outPath, JSON.stringify(roster, null, 2));
        console.log(`Saved roster for ${teamName} to ${outPath}`);
    } catch (err) {
        console.error('Error in main process:', err);
    } finally {
        await browser.close();
    }
})();
