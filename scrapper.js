const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');
const fs = require('fs');
const path = require('path');

async function loginAndScrape() {
    let driver = await new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options()).build();
    try {
        console.log('Navigating to login page...');
        // Navigate to the login page
        await driver.get('https://dashboard.twcako.com/account/login/');

        console.log('Waiting for login form...');
        // Wait for the login form to be visible
        await driver.wait(until.elementLocated(By.id('form-submit')), 10000);

        console.log('Filling login form...');
        // Find the username and password fields and fill them
        await driver.findElement(By.id('id_login')).sendKeys('kentlucky');
        await driver.findElement(By.id('id_password')).sendKeys('TWC123456');

        console.log('Checking "Remember me" checkbox...');
        // Optionally, check the "Remember me" checkbox
        await driver.findElement(By.id('id_remember')).click();

        console.log('Submitting login form...');
        // Submit the form
        await driver.findElement(By.id('form-submit')).submit();

        console.log('Waiting for dashboard home link...');
        // Wait for the dashboard "Home" link to be visible to ensure login was successful
        await driver.wait(until.elementLocated(By.css('a.nav-link.mm-active i.pe-7s-home')), 10000);

        console.log('Login successful');

        console.log('Navigating to sellers page...');
        // Navigate to the target URL
        await driver.get('https://dashboard.twcako.com/member/seller/active/');

        console.log('Waiting for the table to be visible...');
        // Wait for the table to be visible
        await driver.wait(until.elementLocated(By.css('.dataTables_scrollBody')), 10000);

        // Array to hold all records
        let records = [];

        // Function to extract data from the current page
        async function extractTableData() {
            console.log('Extracting data from current page...');
            let rows = await driver.findElements(By.css('#seller-dt-form tbody tr'));
            console.log(`Found ${rows.length} rows`);
            for (let row of rows) {
                let columns = await row.findElements(By.css('td'));
                if (columns.length === 0) {
                    console.log('No columns found in row');
                    continue;
                }
                let rowData = {};
                rowData.dateActivated = await columns[0].getText();
                
                // Extract sellerDetails and mobile
                let sellerDetails = await columns[1].getText();
                let [sellerName, mobile] = sellerDetails.split('\nMOBILE: ');
                rowData.sellerName = sellerName;
                rowData.mobile = mobile;

                // Extract username and ecash
                let usernameEcash = await columns[2].getText();
                let [username, ecash] = usernameEcash.split('\nAvailable Ecash: ');
                rowData.username = username;
                rowData.ecash = ecash;

                // Process doneOnboarding to check for a check mark
                let doneOnboardingHtml = await columns[3].getAttribute('innerHTML');
                rowData.doneOnboarding = doneOnboardingHtml.includes('fa-check') ? true : false;

                // Process ecomDay1, ecomDay2, ecomDay3 to remove "DATE: "
                rowData.ecomDay1 = (await columns[4].getText()).replace('DATE: ', '');
                rowData.ecomDay2 = (await columns[5].getText()).replace('DATE: ', '');
                rowData.ecomDay3 = (await columns[6].getText()).replace('DATE: ', '');

                records.push(rowData);
                console.log('Extracted row data:', rowData);
            }
        }

        // Extract data from the first page
        await extractTableData();

        // Loop through each page
        while (true) {
            console.log('Checking for next page...');
            // Find the "Next" button
            let nextButtonLi = await driver.findElement(By.id('seller-dt-form_next'));
            let nextButtonClasses = await nextButtonLi.getAttribute('class');
            console.log(`Next button classes: ${nextButtonClasses}`);

            // Check if the "Next" button is disabled
            let isDisabled = nextButtonClasses.includes('disabled');
            console.log(`Is next button disabled? ${isDisabled}`);
            if (isDisabled) {
                console.log('No more pages. Exiting loop...');
                break; // Exit the loop if there are no more pages
            }

            console.log('Navigating to next page...');
            // Use JavaScript to click the "Next" button
            let nextButton = await nextButtonLi.findElement(By.css('a.page-link'));
            await driver.executeScript("arguments[0].click();", nextButton);

            // Wait for the table to refresh
            await driver.wait(until.stalenessOf(nextButton));
            await driver.wait(until.elementLocated(By.css('.dataTables_scrollBody')), 10000);

            // Extract data from the next page
            await extractTableData();
        }

        // Define the output path
        const outputPath = path.resolve(__dirname, 'scraped_data.json');

        console.log('Saving data to JSON file...');
        // Save the records to a JSON file
        fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
        console.log(`Data saved to ${outputPath}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await driver.quit();
    }
}

loginAndScrape();
