# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: creativelead-e2e.spec.ts >> FLOW 3: Pipeline & Leads >> 3.2 - Create a new lead via API
- Location: e2e\creativelead-e2e.spec.ts:245:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - img "Creative Lead" [ref=e5]
      - list [ref=e6]:
        - listitem [ref=e7]:
          - link "Import" [ref=e8] [cursor=pointer]:
            - /url: /import
        - listitem [ref=e9]:
          - link "Pipeline" [ref=e10] [cursor=pointer]:
            - /url: /pipeline
        - listitem [ref=e11]:
          - link "Downloads" [ref=e12] [cursor=pointer]:
            - /url: /downloads
        - listitem [ref=e13]:
          - link "Recommendations" [ref=e14] [cursor=pointer]:
            - /url: /recommendations
        - listitem [ref=e15]:
          - link "Outreach" [ref=e16] [cursor=pointer]:
            - /url: /outreach
        - listitem [ref=e17]:
          - link "Campaigns" [ref=e18] [cursor=pointer]:
            - /url: /campaigns
        - listitem [ref=e19]:
          - link "Settings" [ref=e20] [cursor=pointer]:
            - /url: /settings
        - listitem [ref=e21]: v1.0
        - listitem [ref=e22]:
          - button "U" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: U
    - main [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e29]:
          - generic [ref=e30]: CRM Pipeline
          - heading "Your leads, all in one place" [level=1] [ref=e32]:
            - text: Your leads,
            - text: all in one place
          - paragraph [ref=e33]: All locally stored. Drag leads between stages, track history, add notes and files — everything stays on your machine.
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37]: "89"
              - generic [ref=e38]: Total Leads
            - generic [ref=e39]:
              - generic [ref=e40]: "89"
              - generic [ref=e41]: Active
            - generic [ref=e42]:
              - generic [ref=e43]: $0
              - generic [ref=e44]: Pipeline Value
            - generic [ref=e45]:
              - generic [ref=e46]: "0"
              - generic [ref=e47]: Won
            - generic [ref=e48]:
              - generic [ref=e49]: "0"
              - generic [ref=e50]: Lost
            - generic [ref=e51]:
              - generic [ref=e52]: "0"
              - generic [ref=e53]: Overdue
          - generic [ref=e54]:
            - textbox "Search leads by name, category, or city..." [ref=e56]
            - button "Follow-ups (0)" [ref=e58] [cursor=pointer]
          - generic [ref=e59]:
            - generic [ref=e60]:
              - generic [ref=e61]:
                - generic [ref=e62]: New
                - generic [ref=e63]: "89"
              - generic [ref=e64]:
                - generic [ref=e65]:
                  - generic [ref=e67]: Test Auto Garage E2E
                  - generic [ref=e68]:
                    - generic [ref=e69]: Auto Repair
                    - generic [ref=e70]: Tunis
                  - generic [ref=e72]: 3.8 Stars
                  - generic [ref=e73]: "Score: 65 · Warm"
                - generic [ref=e74]:
                  - generic [ref=e76]: Sponsorisé 
                  - generic [ref=e77]: "Score: 39 · Cold"
                - generic [ref=e80]: Sponsorisé 
                - generic [ref=e83]: Sponsorisé 
                - generic [ref=e86]: Hôtel de l'Agriculture
                - generic [ref=e89]: Hostel El Medina
                - generic [ref=e92]: Sponsorisé 
                - generic [ref=e95]: Sponsorisé 
                - generic [ref=e98]: Sponsorisé 
                - generic [ref=e101]: Sponsorisé 
                - generic [ref=e102]:
                  - generic [ref=e104]: Sponsorisé 
                  - generic [ref=e105]: "Score: 39 · Cold"
                - generic [ref=e108]: Sponsorisé 
                - generic [ref=e111]: Sponsorisé 
                - generic [ref=e114]: Sponsorisé 
                - generic [ref=e117]: Sponsorisé 
                - generic [ref=e120]: Sponsorisé 
                - generic [ref=e123]: Hôtel Le Lavoisier
                - generic [ref=e126]: Sponsorisé 
                - generic [ref=e129]: Sponsorisé 
                - generic [ref=e132]: Hôtel Léon
                - generic [ref=e135]: Sponsorisé 
                - generic [ref=e138]: Sponsorisé 
                - generic [ref=e141]: Sponsorisé 
                - generic [ref=e144]: Sponsorisé 
                - generic [ref=e147]: Sponsorisé 
                - generic [ref=e150]: Sponsorisé 
                - generic [ref=e153]: Sponsorisé 
                - generic [ref=e156]: Sponsorisé 
                - generic [ref=e159]: Sponsorisé 
                - generic [ref=e162]: Sponsorisé 
                - generic [ref=e165]: Ambassadeurs Hôtel
                - generic [ref=e168]: Sponsorisé 
                - generic [ref=e171]: Hôtel de l'Agriculture
                - generic [ref=e174]: Sponsorisé 
                - generic [ref=e177]: Sponsorisé 
                - generic [ref=e180]: Sponsorisé 
                - generic [ref=e183]: Sponsorisé 
                - generic [ref=e186]: Sponsorisé 
                - generic [ref=e189]: Sponsorisé 
                - generic [ref=e192]: Sponsorisé 
                - generic [ref=e195]: Sponsorisé 
                - generic [ref=e198]: Sponsorisé 
                - generic [ref=e201]: Sponsorisé 
                - generic [ref=e204]: Sponsorisé 
                - generic [ref=e207]: Sponsorisé 
                - generic [ref=e210]: Sponsorisé 
                - generic [ref=e213]: Sponsorisé 
                - generic [ref=e216]: Hostel El Medina
                - generic [ref=e219]: Sponsorisé 
                - generic [ref=e222]: Sponsorisé 
                - generic [ref=e225]: Sponsorisé 
                - generic [ref=e228]: Sponsorisé 
                - generic [ref=e231]: Sponsorisé 
                - generic [ref=e234]: Sponsorisé 
                - generic [ref=e237]: Sponsorisé 
                - generic [ref=e240]: Sponsorisé 
                - generic [ref=e243]: Sponsorisé 
                - generic [ref=e246]: Ambassadeurs Hôtel
                - generic [ref=e247]:
                  - generic [ref=e249]: fabricant de pieces automobiles
                  - generic [ref=e251]: Fabricant de pièces automobiles
                - generic [ref=e252]:
                  - generic [ref=e254]: Valeo Ben Arous
                  - generic [ref=e256]: Fabricant de pièces automobiles
                - generic [ref=e257]:
                  - generic [ref=e259]: DYTECH DYNAMIC FLUID TECHNOLOGIES
                  - generic [ref=e261]: Fabricant de pièces automobiles
                - generic [ref=e262]:
                  - generic [ref=e264]: Comptoir Industriel et Fournitures Automobiles. (C I F A - Depuis 1978)
                  - generic [ref=e266]: Magasin de pièces de rechange automobiles
                - generic [ref=e267]:
                  - generic [ref=e269]: boujardga
                  - generic [ref=e271]: Fabricant de pièces automobiles
                - generic [ref=e272]:
                  - generic [ref=e274]: Lear Corporation
                  - generic [ref=e276]: Fabricant de pièces automobiles
                - generic [ref=e277]:
                  - generic [ref=e279]: CAVEO AUTOMOTIVE TUNISIA
                  - generic [ref=e281]: Fabricant de pièces automobiles
                - generic [ref=e282]:
                  - generic [ref=e284]: Autopart.tn
                  - generic [ref=e286]: Magasin de pièces de rechange automobiles
                - generic [ref=e287]:
                  - generic [ref=e289]: COTUMAU, Comptoir Tunisien De Materiel Automobile
                  - generic [ref=e291]: Usine automobile
                - generic [ref=e292]:
                  - generic [ref=e294]: Société NJ pièces automobile
                  - generic [ref=e296]: Magasin d'accessoires automobiles
                - generic [ref=e297]:
                  - generic [ref=e299]: Svpa Société De Vente Des Pièces Allemande
                  - generic [ref=e301]: Magasin de pièces automobiles
                - generic [ref=e302]:
                  - generic [ref=e304]: SMPA
                  - generic [ref=e306]: Fabricant de pièces automobiles
                - generic [ref=e307]:
                  - generic [ref=e309]: PM.INDUSTRIES
                  - generic [ref=e311]: Fabricant de pièces automobiles
                - generic [ref=e312]:
                  - generic [ref=e314]: Sociétè Equipement Moderne Automotive
                  - generic [ref=e316]: Magasin de pièces de rechange automobiles
                - generic [ref=e317]:
                  - generic [ref=e319]: EPCT
                  - generic [ref=e321]: Fournisseur de pièces détachées pour camions
                - generic [ref=e322]:
                  - generic [ref=e324]: Smap
                  - generic [ref=e326]: Magasin
                - generic [ref=e327]:
                  - generic [ref=e329]: Société Industrielle d'Amortisseurs SIA
                  - generic [ref=e331]: Fabricant de pièces automobiles
                - generic [ref=e332]:
                  - generic [ref=e334]: SPVA
                  - generic [ref=e336]: Magasin de pièces de rechange automobiles
                - generic [ref=e337]:
                  - generic [ref=e339]: Établissement Dahmen
                  - generic [ref=e341]: Fabricant de pièces automobiles
                - generic [ref=e342]:
                  - generic [ref=e344]: XEFI Lyon 6
                  - generic [ref=e346]: Assistance et services informatiques
                - generic [ref=e347]:
                  - generic [ref=e349]: Dépannage informatique Lyonnais
                  - generic [ref=e351]: Assistance et services informatiques
                - generic [ref=e352]:
                  - generic [ref=e354]: XEFI Lyon Presqu’île
                  - generic [ref=e356]: Assistance et services informatiques
                - generic [ref=e357]:
                  - generic [ref=e359]: it partner
                  - generic [ref=e361]: Assistance et services informatiques
                - generic [ref=e362]:
                  - generic [ref=e364]: AIDE INFORMATIQUE LYON
                  - generic [ref=e366]: Assistance et services informatiques
                - generic [ref=e367]:
                  - generic [ref=e369]: ‍CG Depan Informatique - aide informatique, formation, communication digitale et e-reputation
                  - generic [ref=e371]: Assistance et services informatiques
                - generic [ref=e372]:
                  - generic [ref=e374]: SOWAN Lyon
                  - generic [ref=e376]: Assistance et services informatiques
                - generic [ref=e377]:
                  - generic [ref=e379]: Magellan Consulting Lyon
                  - generic [ref=e381]: Consultant informatique
                  - generic [ref=e382]: "Score: 39 · Cold"
                - generic [ref=e383]:
                  - generic [ref=e385]: ITS Group Lyon
                  - generic [ref=e387]: Assistance et services informatiques
                - generic [ref=e388]:
                  - generic [ref=e390]: AppsPanel & Nomeo - Agence d'application mobile sur mesure
                  - generic [ref=e392]: Entreprise de logiciels
                - generic [ref=e395]: Final Test
                - generic [ref=e396]:
                  - generic [ref=e398]: Test Business
                  - generic [ref=e400]: Restaurant
                  - generic [ref=e401]: "Score: 39 · Cold"
            - generic [ref=e402]:
              - generic [ref=e403]:
                - generic [ref=e404]: Contacted
                - generic [ref=e405]: "0"
              - generic [ref=e407]: No leads
            - generic [ref=e408]:
              - generic [ref=e409]:
                - generic [ref=e410]: Qualified
                - generic [ref=e411]: "0"
              - generic [ref=e413]: No leads
            - generic [ref=e414]:
              - generic [ref=e415]:
                - generic [ref=e416]: Proposal Sent
                - generic [ref=e417]: "0"
              - generic [ref=e419]: No leads
            - generic [ref=e420]:
              - generic [ref=e421]:
                - generic [ref=e422]: Negotiation
                - generic [ref=e423]: "0"
              - generic [ref=e425]: No leads
            - generic [ref=e426]:
              - generic [ref=e427]:
                - generic [ref=e428]: Won
                - generic [ref=e429]: "0"
              - generic [ref=e431]: No leads
            - generic [ref=e432]:
              - generic [ref=e433]:
                - generic [ref=e434]: Lost
                - generic [ref=e435]: "0"
              - generic [ref=e437]: No leads
    - contentinfo [ref=e438]:
      - generic [ref=e439]:
        - img "Creative Lead" [ref=e440]
        - generic [ref=e441]: © 2026 Creative Comet · CreativeLead
      - list [ref=e442]:
        - listitem [ref=e443]:
          - link "Privacy" [ref=e444] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=e445]:
          - link "Terms" [ref=e446] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=e447]:
          - link "Support" [ref=e448] [cursor=pointer]:
            - /url: mailto:support@creativecomet.tn
  - alert [ref=e449]
```

# Test source

```ts
  175 |       }
  176 |     }
  177 | 
  178 |     await screenshot(page, '2.2_ai_filled');
  179 |     report('AI Provider configured with OpenRouter');
  180 |   });
  181 | 
  182 |   test('2.3 - Configure Campaign Providers (Gmail)', async ({ page }) => {
  183 |     await signIn(page);
  184 |     await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  185 |     await page.waitForTimeout(2000);
  186 | 
  187 |     // Click Providers tab
  188 |     const providersTab = page.locator('button, a, [class*="tab"]').filter({ hasText: /provider|campaign/i }).first();
  189 |     if (await providersTab.isVisible()) {
  190 |       await providersTab.click();
  191 |       await page.waitForTimeout(500);
  192 |     }
  193 |     await screenshot(page, '2.3_providers_tab');
  194 | 
  195 |     // Select Gmail from provider dropdown
  196 |     const emailProviderSelect = page.locator('select').first();
  197 |     if (await emailProviderSelect.isVisible()) {
  198 |       const options = await emailProviderSelect.evaluate(el => Array.from(el.querySelectorAll('option')).map(o => o.value));
  199 |       report(`Email provider options: ${JSON.stringify(options)}`);
  200 |       if (options.includes('gmail')) {
  201 |         await emailProviderSelect.selectOption('gmail');
  202 |         await page.waitForTimeout(300);
  203 |       }
  204 |     }
  205 | 
  206 |     await screenshot(page, '2.3_gmail_selected');
  207 |     report('Gmail provider selected');
  208 |   });
  209 | 
  210 |   test('2.4 - Configure Google Sheets Web App URL', async ({ page }) => {
  211 |     await signIn(page);
  212 |     await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  213 |     await page.waitForTimeout(2000);
  214 | 
  215 |     // Click Sheets tab
  216 |     const sheetsTab = page.locator('button, a, [class*="tab"]').filter({ hasText: /sheet|google/i }).first();
  217 |     if (await sheetsTab.isVisible()) {
  218 |       await sheetsTab.click();
  219 |       await page.waitForTimeout(500);
  220 |     }
  221 |     await screenshot(page, '2.4_sheets_tab');
  222 | 
  223 |     await page.waitForTimeout(500);
  224 |     await screenshot(page, '2.4_sheets_loaded');
  225 |     report('Sheets tab opened');
  226 |   });
  227 | });
  228 | 
  229 | // ══════════════════════════════════════════════════════════════════════
  230 | // FLOW 3: PIPELINE & LEADS
  231 | // ══════════════════════════════════════════════════════════════════════
  232 | test.describe('FLOW 3: Pipeline & Leads', () => {
  233 | 
  234 |   test('3.1 - Pipeline page loads lead table', async ({ page }) => {
  235 |     await signIn(page);
  236 |     await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
  237 |     await page.waitForTimeout(3000);
  238 |     await screenshot(page, '3.1_pipeline');
  239 | 
  240 |     // Check for lead table or lead cards
  241 |     const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 2000) || '');
  242 |     report(`Pipeline body text: ${bodyText.substring(0, 500)}`);
  243 |   });
  244 | 
  245 |   test('3.2 - Create a new lead via API', async ({ page }) => {
  246 |     await signIn(page);
  247 |     await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
  248 |     // Use POST /api/leads/bulk-import to create a single lead
  249 |     const result = await page.evaluate(async (baseUrl) => {
  250 |       try {
  251 |         const res = await fetch(`${baseUrl}/api/leads/bulk-import`, {
  252 |           method: 'POST',
  253 |           headers: { 'Content-Type': 'application/json' },
  254 |           body: JSON.stringify([{
  255 |             business_name: 'Test Auto Garage E2E',
  256 |             category: 'Auto Repair',
  257 |             website: 'https://testautogarage-e2e.com',
  258 |             phone_number: '+21650123456',
  259 |             email: 'contact@testautogarage-e2e.com',
  260 |             city: 'Tunis',
  261 |             address: '123 Test Street',
  262 |             rating: 3.8,
  263 |             review_count: 12,
  264 |           }]),
  265 |         });
  266 |         const body = await res.json();
  267 |         return { ok: res.ok, status: res.status, body };
  268 |       } catch (err) {
  269 |         return { ok: false, status: 0, body: { error: String(err) } };
  270 |       }
  271 |     }, BASE_URL);
  272 |     report(`Create lead response: ${JSON.stringify(result)}`);
  273 |     expect(result.ok).toBeTruthy();
  274 |     expect(result.body.success).toBe(true);
> 275 |     expect(result.body.count).toBe(1);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  276 |     // Fetch the lead back to get its ID
  277 |     if (result.ok) {
  278 |       const idResult = await page.evaluate(async (baseUrl) => {
  279 |         try {
  280 |           const res = await fetch(`${baseUrl}/api/leads?q=Test%20Auto%20Garage%20E2E`);
  281 |           const body = await res.json();
  282 |           return { ok: res.ok, body };
  283 |         } catch (err) {
  284 |           return { ok: false, body: { error: String(err) } };
  285 |         }
  286 |       }, BASE_URL);
  287 |       if (idResult.ok && Array.isArray(idResult.body) && idResult.body.length > 0) {
  288 |         createdLeadId = idResult.body[0].id;
  289 |         report(`Found created lead ID: ${createdLeadId}`);
  290 |       }
  291 |     }
  292 |   });
  293 | 
  294 |   test('3.3 - Lead appears in pipeline after creation', async ({ page }) => {
  295 |     await signIn(page);
  296 |     await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
  297 |     await page.waitForTimeout(3000);
  298 |     await screenshot(page, '3.3_pipeline_with_lead');
  299 | 
  300 |     const bodyText = await page.evaluate(() => document.body.textContent || '');
  301 |     report(`Pipeline contains 'Test Auto Garage': ${bodyText.includes('Test Auto Garage E2E')}`);
  302 |     // Should show the lead somewhere
  303 |   });
  304 | 
  305 |   test('3.4 - Read lead detail via API', async ({ page }) => {
  306 |     await signIn(page);
  307 |     if (!createdLeadId) {
  308 |       report('No lead ID available, skipping');
  309 |       return;
  310 |     }
  311 |     const result = await page.evaluate(async ({ baseUrl, leadId }) => {
  312 |       try {
  313 |         const res = await fetch(`${baseUrl}/api/leads/${leadId}`);
  314 |         const body = await res.json();
  315 |         return { ok: res.ok, status: res.status, body };
  316 |       } catch (err) {
  317 |         return { ok: false, status: 0, body: { error: String(err) } };
  318 |       }
  319 |     }, { baseUrl: BASE_URL, leadId: createdLeadId });
  320 |     report(`Lead detail status: ${result.status}`);
  321 |     if (result.ok) {
  322 |       report(`Lead detail: ${JSON.stringify(result.body).substring(0, 500)}`);
  323 |     }
  324 |     expect(result.ok).toBeTruthy();
  325 |     expect(result.body.businessName).toBe('Test Auto Garage E2E');
  326 |   });
  327 | });
  328 | 
  329 | // ══════════════════════════════════════════════════════════════════════
  330 | // FLOW 4: ENRICHMENT
  331 | // ══════════════════════════════════════════════════════════════════════
  332 | test.describe('FLOW 4: Enrichment & Website Intelligence', () => {
  333 | 
  334 |   async function apiPost(page: Page, url: string, data: any) {
  335 |     return page.evaluate(async ({ url, data }) => {
  336 |       try {
  337 |         const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  338 |         const text = await res.text();
  339 |         return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
  340 |       } catch (err) { return { ok: false, status: 0, body: { error: String(err) } }; }
  341 |     }, { url, data });
  342 |   }
  343 | 
  344 |   async function apiGet(page: Page, url: string) {
  345 |     return page.evaluate(async (url) => {
  346 |       try {
  347 |         const res = await fetch(url);
  348 |         const text = await res.text();
  349 |         return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
  350 |       } catch (err) { return { ok: false, status: 0, body: { error: String(err) } }; }
  351 |     }, url);
  352 |   }
  353 | 
  354 |   test('4.1 - Trigger website intelligence scan', async ({ page }) => {
  355 |     await signIn(page);
  356 |     if (!createdLeadId) { report('SKIP: No lead ID'); return; }
  357 |     const result = await apiPost(page, `${BASE_URL}/api/leads/${createdLeadId}/website-intel`, {});
  358 |     report(`Website intel response: ${JSON.stringify(result.body).substring(0, 300)}`);
  359 |   });
  360 | 
  361 |   test('4.2 - Trigger lead enrichment', async ({ page }) => {
  362 |     await signIn(page);
  363 |     if (!createdLeadId) { report('SKIP: No lead ID'); return; }
  364 |     const result = await apiPost(page, `${BASE_URL}/api/leads/${createdLeadId}/enrichment`, {});
  365 |     report(`Enrichment response: ${JSON.stringify(result.body).substring(0, 300)}`);
  366 |   });
  367 | 
  368 |   test('4.3 - Trigger opportunity/scoring', async ({ page }) => {
  369 |     await signIn(page);
  370 |     if (!createdLeadId) { report('SKIP: No lead ID'); return; }
  371 |     const result = await apiPost(page, `${BASE_URL}/api/leads/${createdLeadId}/opportunity`, {});
  372 |     report(`Opportunity/Scoring response: ${JSON.stringify(result.body).substring(0, 300)}`);
  373 |   });
  374 | 
  375 |   test('4.4 - Verify lead now has enrichment + score data', async ({ page }) => {
```