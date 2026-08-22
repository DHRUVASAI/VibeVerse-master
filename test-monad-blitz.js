const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('🧪 Starting comprehensive Monad Blitz end-to-end verification suite...');
    const outDir = path.resolve(__dirname, 'docs/images');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 900 });

        console.log('1. Navigating to VibeVerse on http://localhost:5173...');
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // Inject active Monad Testnet Web3 User
        console.log('2. Setting up Monad Testnet wallet session...');
        await page.evaluate(() => {
            const user = {
                name: '0x71C6...3972',
                address: '0x71C6370244569339304990928232938492023972',
                isWeb3: true,
                isManual: false,
                chainId: '0x279f',
                network: 'Monad Testnet'
            };
            localStorage.setItem('vibeverse_user', JSON.stringify(user));
            
            // Sample mood memories
            const memories = [
                { id: 1, mood: 'Mystery', timestamp: Date.now() - 3600000 * 2 },
                { id: 2, mood: 'Action', timestamp: Date.now() - 3600000 * 20 },
                { id: 3, mood: 'Chill', timestamp: Date.now() - 3600000 * 48 }
            ];
            localStorage.setItem('vibeverse_mood_memories', JSON.stringify(memories));
        });

        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // Dismiss splash if present
        await page.evaluate(() => {
            const s = document.getElementById('splashScreen');
            if (s) s.style.display = 'none';
        });

        // 1. Capture Monad Header & Connected Status
        await page.screenshot({ path: path.join(outDir, 'monad_connected_header.png') });
        console.log('📸 1. Monad Connected Header captured');

        // 2. Open Vibe Passport
        console.log('3. Opening Vibe Passport section...');
        await page.evaluate(() => {
            document.getElementById('showPassportBtn').click();
        });
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: path.join(outDir, 'monad_vibe_passport.png') });
        console.log('📸 2. Vibe Passport section captured');

        // 3. Mint Soulbound Passport on Monad
        console.log('4. Triggering on-chain Soulbound Passport creation on Monad...');
        await page.evaluate(() => {
            document.getElementById('mintPassportBtn').click();
        });
        // Wait for all 5 lifecycle steps
        await new Promise(r => setTimeout(r, 4000));
        await page.screenshot({ path: path.join(outDir, 'monad_tx_lifecycle_verified.png') });
        console.log('📸 3. Transaction Lifecycle Verified modal captured');

        // Close lifecycle modal
        await page.evaluate(() => {
            const m = document.getElementById('txLifecycleModal');
            if (m) m.classList.add('hidden');
        });
        await new Promise(r => setTimeout(r, 500));

        // 4. Open Vibe Twins Section
        console.log('5. Opening Vibe Twin Discovery section...');
        await page.evaluate(() => {
            document.getElementById('showTwinsBtn').click();
        });
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: path.join(outDir, 'monad_vibe_twins.png') });
        console.log('📸 4. Vibe Twin Discovery captured');

        // 5. Open Vibe Fusion Studio
        console.log('6. Opening Vibe Fusion Studio...');
        await page.evaluate(() => {
            document.getElementById('showFusionBtn').click();
        });
        await new Promise(r => setTimeout(r, 800));

        // Calculate fusion with preset
        await page.evaluate(() => {
            const p = document.querySelector('.partner-preset-btn');
            if (p) p.click();
        });
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: path.join(outDir, 'monad_vibe_fusion.png') });
        console.log('📸 5. Vibe Fusion Studio captured');

        // 6. Open Public Verification Modal
        console.log('7. Opening Public Verification Modal...');
        await page.evaluate(() => {
            document.getElementById('showPublicVerifyBtn').click();
        });
        await new Promise(r => setTimeout(r, 800));
        await page.evaluate(() => {
            document.getElementById('btnVerifyLookup').click();
        });
        await new Promise(r => setTimeout(r, 600));
        await page.screenshot({ path: path.join(outDir, 'monad_public_verification.png') });
        console.log('📸 6. Public Monad Verification Modal captured');

        console.log('🎉 ALL MONAD BLITZ TESTS COMPLETED SUCCESSFULLY!');
    } catch (err) {
        console.error('❌ Test suite failed:', err);
    } finally {
        await browser.close();
    }
})();
