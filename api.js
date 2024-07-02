const express = require('express');
const bodyParser = require('body-parser');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');

const app = express();
app.use(bodyParser.json());
const PORT = 3000;

async function loginAndScrape(limit = 20) {
    const options = new chrome.Options();
    options.addArguments('headless'); 
    options.addArguments('disable-gpu');
    options.addArguments('no-sandbox');
    options.addArguments('disable-dev-shm-usage');
    options.addArguments('disable-setuid-sandbox');
    options.addArguments('disable-extensions');
    options.addArguments('disable-software-rasterizer');
    options.addArguments('start-maximized');
    options.addArguments('disable-infobars');
    options.addArguments('remote-debugging-port=9222'); // Necessary for headless mode

    let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();






    let records = [];
    try {
        console.log('Navigating to login page...');
        await driver.get('https://dashboard.twcako.com/account/login/');

        console.log('Waiting for login form...');
        await driver.wait(until.elementLocated(By.id('form-submit')), 10000);

        console.log('Filling login form...');
        await driver.findElement(By.id('id_login')).sendKeys('kentlucky');
        await driver.findElement(By.id('id_password')).sendKeys('TWC123456');

        console.log('Checking "Remember me" checkbox...');
        await driver.findElement(By.id('id_remember')).click();

        console.log('Submitting login form...');
        await driver.findElement(By.id('form-submit')).submit();

        console.log('Waiting for dashboard home link...');
        await driver.wait(until.elementLocated(By.css('a.nav-link.mm-active i.pe-7s-home')), 10000);

        console.log('Login successful');

        console.log('Navigating to sellers page...');
        await driver.get('https://dashboard.twcako.com/member/seller/active/');

        console.log('Waiting for the table to be visible...');
        await driver.wait(until.elementLocated(By.css('.dataTables_scrollBody')), 10000);

        async function extractTableData() {
            console.log('Extracting data from current page...');
            let rows = await driver.findElements(By.css('#seller-dt-form tbody tr'));
            console.log(`Found ${rows.length} rows`);
            for (let row of rows) {
                if (records.length >= limit) {
                    return; // Stop if the limit is reached
                }
                let columns = await row.findElements(By.css('td'));
                if (columns.length === 0) {
                    console.log('No columns found in row');
                    continue;
                }
                let rowData = {};
                rowData.dateActivated = await columns[0].getText();

                let sellerDetails = await columns[1].getText();
                let [sellerName, mobile] = sellerDetails.split('\nMOBILE: ');
                rowData.sellerName = sellerName;
                rowData.mobile = mobile;

                let usernameEcash = await columns[2].getText();
                let [username, ecash] = usernameEcash.split('\nAvailable Ecash: ');
                rowData.username = username;
                rowData.ecash = ecash;

                let doneOnboardingHtml = await columns[3].getAttribute('innerHTML');
                rowData.doneOnboarding = doneOnboardingHtml.includes('fa-check') ? true : false;

                rowData.ecomDay1 = (await columns[4].getText()).replace('DATE: ', '');
                rowData.ecomDay2 = (await columns[5].getText()).replace('DATE: ', '');
                rowData.ecomDay3 = (await columns[6].getText()).replace('DATE: ', '');

                records.push(rowData);
                console.log('Extracted row data:', rowData);
            }
        }

        await extractTableData();

        while (records.length < limit) {
            console.log('Checking for next page...');
            let nextButtonLi = await driver.findElement(By.id('seller-dt-form_next'));
            let nextButtonClasses = await nextButtonLi.getAttribute('class');
            console.log(`Next button classes: ${nextButtonClasses}`);

            let isDisabled = nextButtonClasses.includes('disabled');
            console.log(`Is next button disabled? ${isDisabled}`);
            if (isDisabled) {
                console.log('No more pages. Exiting loop...');
                break;
            }

            console.log('Navigating to next page...');
            let nextButton = await nextButtonLi.findElement(By.css('a.page-link'));
            await driver.executeScript("arguments[0].click();", nextButton);

            await driver.wait(until.stalenessOf(nextButton));
            await driver.wait(until.elementLocated(By.css('.dataTables_scrollBody')), 10000);

            await extractTableData();
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await driver.quit();
    }

    return records;
}

app.post('/scrape', async (req, res) => {
    const { limit } = req.body;
    const records = await loginAndScrape(limit);
    res.json(records);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
