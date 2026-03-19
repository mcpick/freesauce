const BASE = 'https://thefreesauce.quest';

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
  }
}

// Test 1: Home page
await test('Home page loads', async () => {
  const r = await fetch(BASE);
  if (!r.ok) throw new Error(`Status ${r.status}`);
  const html = await r.text();
  if (!html.includes('FREE SAUCE')) throw new Error('Missing hero text');
  if (!html.includes('id="map"')) throw new Error('Missing map');
  if (!html.includes('nearMe')) throw new Error('Missing near me button');
  console.log('  Home page HTML OK, size:', html.length);
});

// Test 2: Add page
await test('Add page loads', async () => {
  const r = await fetch(`${BASE}/add`);
  if (!r.ok) throw new Error(`Status ${r.status}`);
  const html = await r.text();
  if (!html.includes('id="name"')) throw new Error('Missing name input');
  if (!html.includes('id="address"')) throw new Error('Missing address input');
  if (!html.includes('id="state"')) throw new Error('Missing state select');
  if (!html.includes('addForm')) throw new Error('Missing form');
  console.log('  Add page HTML OK');
});

// Test 3: GET /api/shops
await test('GET /api/shops', async () => {
  const r = await fetch(`${BASE}/api/shops`);
  if (!r.ok) throw new Error(`Status ${r.status}`);
  const shops = await r.json();
  if (!Array.isArray(shops)) throw new Error('Response not array: ' + JSON.stringify(shops).substring(0, 200));
  console.log(`  ${shops.length} shops returned`);
  if (shops.length > 0) {
    const s = shops[0];
    console.log(`  First: ${s.name} (${s.lat}, ${s.lng}) verified=${s.verified}`);
    if (s.lat === undefined || s.lng === undefined) throw new Error('Missing lat/lng');
  }
});

// Test 4: POST /api/shops (submit form)
await test('POST /api/shops (form submit)', async () => {
  const data = {
    name: 'Playwright Test Bakery',
    address: '1 King William St, Adelaide SA 5000',
    suburb: 'Adelaide',
    state: 'SA',
    sauce_types: 'tomato,bbq',
    submitted_by: 'Test Bot',
  };
  
  const r = await fetch(`${BASE}/api/shops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const body = await r.json();
  console.log(`  Status: ${r.status}`);
  console.log(`  Body: ${JSON.stringify(body)}`);
  
  if (!r.ok) throw new Error(`Status ${r.status}: ${JSON.stringify(body)}`);
});

// Test 5: Verify new shop appears in list
await test('New shop in GET response', async () => {
  const r = await fetch(`${BASE}/api/shops`);
  const shops = await r.json();
  const found = shops.find(s => s.name === 'Playwright Test Bakery');
  if (!found) throw new Error('Submitted shop not found in list');
  console.log(`  Found test shop at (${found.lat}, ${found.lng})`);
});

// Test 6: POST validation - missing fields
await test('POST validation rejects missing fields', async () => {
  const r = await fetch(`${BASE}/api/shops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Incomplete' }),
  });
  const body = await r.json();
  console.log(`  Status: ${r.status}, Error: ${body.error}`);
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

// Test 7: Check client-side JS for the form.name bug
await test('Client JS uses querySelector not form.name', async () => {
  const r = await fetch(`${BASE}/add`);
  const html = await r.text();
  if (html.includes("form.name.value")) throw new Error('Still using form.name.value - DOM property clash!');
  if (!html.includes("querySelector('#name')")) throw new Error('Missing querySelector fix');
  console.log('  Client JS properly uses querySelector');
});

console.log('\n=== DONE ===');
