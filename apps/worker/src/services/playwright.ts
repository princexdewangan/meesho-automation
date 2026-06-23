import { chromium, BrowserContext } from 'playwright';
import { config } from '../config.js';
import { fetchSettings, logEvent } from './api.js';

let context: BrowserContext | null = null;

export async function initBrowser() {
  if (context) return context;
  
  console.log('Initializing Playwright browser context with session persistence...');
  context = await chromium.launchPersistentContext(config.wishlinkSessionPath, {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    viewport: { width: 1280, height: 720 }
  });
  
  return context;
}

export async function closeBrowser() {
  if (context) {
    await context.close();
    context = null;
  }
}

/**
 * Automates Wishlink to generate an affiliate link for a raw product URL
 */
export async function generateWishlink(dealUrl: string): Promise<string> {
  const settings = await fetchSettings();
  const wishlinkUrlInput = settings.wishlinkUrlInput;
  const wishlinkGenerateBtn = settings.wishlinkGenerateBtn;
  const wishlinkShortlinkText = settings.wishlinkShortlinkText;

  const browserContext = await initBrowser();
  const page = await browserContext.newPage();

  try {
    const generatorPageUrl = 'https://www.wishlink.com/creator/link-generator';
    console.log(`Navigating to Wishlink Link Generator: ${generatorPageUrl}`);
    await page.goto(generatorPageUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // 1. Verify if user is logged in
    const isLoginPage = page.url().includes('/login') || (await page.locator("text=Login").count()) > 0;
    if (isLoginPage) {
      const screenshotPath = `C:\\Users\\ASUS\\Meesho Automation\\apps\\dashboard\\public\\wishlink_auth_error.png`;
      await page.screenshot({ path: screenshotPath });
      await logEvent(
        'ERROR',
        'Wishlink session expired or not authenticated. Re-auth required.',
        `Please open the dashboard settings to log in manually. Screenshot saved to dashboard assets.`
      );
      throw new Error('Wishlink Authentication required. Log in via dashboard or worker browser.');
    }

    // 2. Locate input URL field
    console.log(`Waiting for URL input selector: ${wishlinkUrlInput}`);
    const urlInput = page.locator(wishlinkUrlInput);
    try {
      await urlInput.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      throw new Error(`Selector timeout: Could not find Wishlink URL input field using selector "${wishlinkUrlInput}". The website UI may have changed.`);
    }

    // 3. Fill the URL and click generate
    await urlInput.fill(dealUrl);
    
    console.log(`Clicking generate button using selector: ${wishlinkGenerateBtn}`);
    const generateBtn = page.locator(wishlinkGenerateBtn);
    try {
      await generateBtn.waitFor({ state: 'visible', timeout: 5000 });
      await generateBtn.click();
    } catch {
      throw new Error(`Selector timeout: Could not find or click Wishlink generate button using selector "${wishlinkGenerateBtn}".`);
    }

    // 4. Wait for the generated affiliate link to appear
    console.log(`Waiting for generated affiliate shortlink using selector: ${wishlinkShortlinkText}`);
    const linkEl = page.locator(wishlinkShortlinkText);
    try {
      await linkEl.waitFor({ state: 'visible', timeout: 20000 });
    } catch {
      throw new Error(`Selector timeout: Failed to locate the generated shortlink output using selector "${wishlinkShortlinkText}".`);
    }

    // Extract link (either text, value, or href attribute)
    let shortlink = '';
    const tagName = await linkEl.evaluate(el => el.tagName.toLowerCase());
    
    if (tagName === 'input' || tagName === 'textarea') {
      shortlink = await linkEl.inputValue();
    } else {
      shortlink = (await linkEl.getAttribute('href')) || (await linkEl.textContent()) || '';
    }

    shortlink = shortlink.trim();
    if (!shortlink || !shortlink.includes('wishlink.com')) {
      throw new Error(`Scraped text "${shortlink}" is not a valid Wishlink URL.`);
    }

    console.log(`Successfully generated Wishlink affiliate URL: ${shortlink}`);
    return shortlink;

  } catch (err: any) {
    await logEvent('ERROR', `Playwright link generation failed: ${err.message}`, err.stack);
    throw err;
  } finally {
    await page.close();
  }
}
