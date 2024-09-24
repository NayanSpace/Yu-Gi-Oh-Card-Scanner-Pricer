const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = 4000;

app.use(cors());

app.get('/scrape', async (req, res) => {
  const monsterName = req.query.monster;

  if (!monsterName) {
    return res.status(400).send('Monster name is required');
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to yugiohprices.com and search for the monster name
    await page.goto('https://yugiohprices.com/', { waitUntil: 'domcontentloaded' });
    await page.type('#autocomplete', monsterName);
    await page.keyboard.press('Enter');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Wait for the page to load and display results
    await page.waitForSelector('.primary-content');

    // Get the HTML content of the page after the search results are loaded
    const content = await page.content();
    const $ = cheerio.load(content);

    // Array to store all scraped data
    const cardData = [];

    // Extract the card model numbers
    $('.primary-content .primary-content .print-variant-container').each((i, elem) => {
      const versionNameElement = $(elem).find('.print-variant-header b').text().trim();
      let versionName = "No Card Module Found";
      if (versionNameElement.includes('--')) {
        versionName = versionNameElement;
      }

      // Initially add the version name to cardData
      cardData.push({
        versionName,
        lowestPrice: null,
        highestPrice: null,
        averagePrice: null
      });
    });

    // Extract prices from the specific `item_stats` table that matches the style and border
    $('table[id^="sets"]').each((i, elem) => {
      const rows = $(elem).find('table#item_stats[border="1"][style="margin-bottom: 10px"] tr');

      // Extract prices
      let lowestPrice = rows.eq(0).find('b').text().trim() || "No information available";
      let highestPrice = rows.eq(1).find('p').text().trim() || "No information available";
      let averagePrice = rows.eq(2).find('p').text().trim() || "No information available";

      // Add the extracted prices to the corresponding cardData entry
      if (cardData[i]) {
        cardData[i].lowestPrice = lowestPrice;
        cardData[i].highestPrice = highestPrice;
        cardData[i].averagePrice = averagePrice;
      }

    });

    console.log("Scraped data:", cardData);


    // Close Puppeteer
    await browser.close();

    // Return the scraped data as JSON
    res.json(cardData);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Something went wrong');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});