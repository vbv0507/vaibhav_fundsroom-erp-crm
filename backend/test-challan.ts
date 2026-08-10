const API_URL = 'http://localhost:5000';

async function getToken(email: string) {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  const loginData = await loginRes.json();
  return loginData.data.token;
}

async function runTests() {
  console.log('--- STARTING SALES CHALLAN TESTS ---\n');

  const salesToken = await getToken('sales@example.com');
  const adminToken = await getToken('admin@example.com'); // Admin is needed to create products if none exist

  console.log(`[SALES TOKEN] ${salesToken.substring(0, 15)}...\n`);

  // Setup: Create a customer
  const custRes = await fetch(`${API_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      name: 'Test Customer',
      mobile: '+919999999999',
      businessName: 'Test Biz',
      customerType: 'RETAIL',
      address: 'Test Addr'
    })
  });
  const custData = await custRes.json();
  const customerId = custData.data.id;

  // Setup: Create two products with stock
  const p1Res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Product A', sku: 'PA-' + Date.now(), category: 'Test', unitPrice: 10, minStockAlert: 5, location: 'A1'
    })
  });
  const p1Data = await p1Res.json();
  const p1Id = p1Data.data.id;
  await fetch(`${API_URL}/products/${p1Id}/stock-movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ quantityChanged: 50, movementType: 'IN', reason: 'Initial' })
  });

  const p2Res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Product B', sku: 'PB-' + Date.now(), category: 'Test', unitPrice: 20, minStockAlert: 5, location: 'A1'
    })
  });
  const p2Data = await p2Res.json();
  const p2Id = p2Data.data.id;
  await fetch(`${API_URL}/products/${p2Id}/stock-movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ quantityChanged: 30, movementType: 'IN', reason: 'Initial' })
  });

  // Helper to fetch stock
  const getStock = async (id: string) => {
    const res = await fetch(`${API_URL}/products/${id}`, { headers: { Authorization: `Bearer ${salesToken}` } });
    const data = await res.json();
    return data.data.currentStock;
  };

  console.log(`Initial Stock - Product A: ${await getStock(p1Id)}, Product B: ${await getStock(p2Id)}`);

  // a) Create draft challan with 2 products
  console.log(`\n========================================`);
  console.log(`a) CREATE DRAFT CHALLAN (2 items)`);
  console.log(`========================================`);
  const c1Res = await fetch(`${API_URL}/challans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId,
      items: [
        { productId: p1Id, quantity: 10 },
        { productId: p2Id, quantity: 5 }
      ]
    })
  });
  const c1Data = await c1Res.json();
  const challan1Id = c1Data.data.id;
  console.log(`Status: ${c1Res.status}`);
  console.log(`Body:`, JSON.stringify(c1Data, null, 2));

  // b) Confirm successfully & verify stock
  console.log(`\n========================================`);
  console.log(`b) CONFIRM CHALLAN 1`);
  console.log(`========================================`);
  const conf1Res = await fetch(`${API_URL}/challans/${challan1Id}/confirm`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` }
  });
  const conf1Data = await conf1Res.json();
  console.log(`Status: ${conf1Res.status}`);
  console.log(`Body:`, JSON.stringify(conf1Data, null, 2));
  console.log(`Post-Confirm Stock - Product A: ${await getStock(p1Id)}, Product B: ${await getStock(p2Id)}`);

  // c) Create second challan (insufficient stock)
  console.log(`\n========================================`);
  console.log(`c) CREATE & ATTEMPT CONFIRM OVER-STOCK CHALLAN`);
  console.log(`========================================`);
  const c2Res = await fetch(`${API_URL}/challans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      customerId,
      items: [
        { productId: p1Id, quantity: 1000 }, // Way over stock
        { productId: p2Id, quantity: 2 }
      ]
    })
  });
  const c2Data = await c2Res.json();
  const challan2Id = c2Data.data.id;
  
  const conf2Res = await fetch(`${API_URL}/challans/${challan2Id}/confirm`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` }
  });
  const conf2Data = await conf2Res.json();
  console.log(`Status: ${conf2Res.status}`);
  console.log(`Body:`, JSON.stringify(conf2Data, null, 2));
  console.log(`Post-Fail Stock - Product A: ${await getStock(p1Id)}, Product B: ${await getStock(p2Id)}`);

  // d) Cancel a confirmed challan & verify stock restored
  console.log(`\n========================================`);
  console.log(`d) CANCEL CONFIRMED CHALLAN 1`);
  console.log(`========================================`);
  const canc1Res = await fetch(`${API_URL}/challans/${challan1Id}/cancel`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` }
  });
  const canc1Data = await canc1Res.json();
  console.log(`Status: ${canc1Res.status}`);
  console.log(`Body:`, JSON.stringify(canc1Data, null, 2));
  console.log(`Post-Cancel Stock - Product A: ${await getStock(p1Id)}, Product B: ${await getStock(p2Id)}`);

  // e) Attempt to confirm an already-CANCELLED or CONFIRMED challan (Challan 1 is CANCELLED now)
  console.log(`\n========================================`);
  console.log(`e) ATTEMPT CONFIRM ON CANCELLED CHALLAN`);
  console.log(`========================================`);
  const conf3Res = await fetch(`${API_URL}/challans/${challan1Id}/confirm`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${salesToken}` }
  });
  const conf3Data = await conf3Res.json();
  console.log(`Status: ${conf3Res.status}`);
  console.log(`Body:`, JSON.stringify(conf3Data, null, 2));
}

runTests().catch(console.error);
