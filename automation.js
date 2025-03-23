const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function startAutomation(chromeProfilePath, promptsFilePath, outputDirectory, imageRatio, progressCallback) {
    let browser = null;
    try {
        // Read prompts file
        const promptsContent = await fs.readFile(promptsFilePath, 'utf-8');
        const prompts = promptsContent.split('\n').filter(line => line.trim());
        
        // Launch browser with specified profile
        browser = await puppeteer.launch({
            headless: false,
            userDataDir: chromeProfilePath,
            args: ['--start-maximized']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Hailou AI
        await page.goto('https://hailouai.com/');
        
        // Process each prompt
        for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i].trim();
            if (!prompt) continue;

            progressCallback({
                percent: Math.round((i / prompts.length) * 100),
                status: `Processing prompt ${i + 1} of ${prompts.length}`,
                message: `Starting to process prompt: ${prompt.substring(0, 50)}...`,
                type: 'info'
            });

            try {
                // Wait for prompt input field and type prompt
                await page.waitForSelector('.prompt-input-box textarea, textarea[placeholder*="prompt"], textarea[placeholder*="Prompt"]', { timeout: 10000 });
                await page.evaluate(() => {
                    const textarea = document.querySelector('.prompt-input-box textarea, textarea[placeholder*="prompt"], textarea[placeholder*="Prompt"]');
                    textarea.value = '';
                });
                await page.type('.prompt-input-box textarea, textarea[placeholder*="prompt"], textarea[placeholder*="Prompt"]', prompt);

                // Select image ratio based on UI elements
                const ratioSelectors = {
                    '1:1': '[data-ratio="1:1"], button:has-text("Square"), button:has-text("1:1")',
                    '16:9': '[data-ratio="16:9"], button:has-text("16:9"), button:has-text("Landscape")',
                    '9:16': '[data-ratio="9:16"], button:has-text("9:16"), button:has-text("Portrait")',
                    '4:3': '[data-ratio="4:3"], button:has-text("4:3")',
                    '3:4': '[data-ratio="3:4"], button:has-text("3:4")'
                };

                // Wait for and click the ratio selector
                await page.waitForSelector(ratioSelectors[imageRatio], { timeout: 5000 });
                await page.click(ratioSelectors[imageRatio]);

                // Click generate button
                await page.waitForSelector('button:has-text("Generate"), button.generate-button', { timeout: 5000 });
                await page.click('button:has-text("Generate"), button.generate-button');

                // Wait for image generation
                await page.waitForSelector('img[alt*="generated"], .generated-image img', { timeout: 60000 });

                // Wait additional time for image to fully load
                await page.waitForTimeout(2000);

                // Get the image URL
                const imageUrl = await page.evaluate(() => {
                    const img = document.querySelector('img[alt*="generated"], .generated-image img');
                    return img.src;
                });

                // Download and save the image
                const response = await fetch(imageUrl);
                const buffer = await response.buffer();
                await fs.writeFile(path.join(outputDirectory, `${i + 1}.png`), buffer);

                progressCallback({
                    message: `Successfully generated and saved image ${i + 1}`,
                    type: 'success'
                });

                // Clear the prompt for next iteration
                await page.evaluate(() => {
                    const textarea = document.querySelector('.prompt-input-box textarea, textarea[placeholder*="prompt"], textarea[placeholder*="Prompt"]');
                    if (textarea) textarea.value = '';
                });

            } catch (error) {
                progressCallback({
                    message: `Error processing prompt ${i + 1}: ${error.message}`,
                    type: 'error'
                });

                // Try to recover by refreshing the page
                try {
                    await page.reload({ waitUntil: 'networkidle0' });
                    await page.waitForTimeout(2000);
                } catch (refreshError) {
                    console.error('Error recovering from failure:', refreshError);
                }
            }
        }

        progressCallback({
            percent: 100,
            status: 'Completed',
            message: 'All prompts processed successfully',
            type: 'success',
            completed: true
        });

    } catch (error) {
        throw new Error(`Automation failed: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { startAutomation };