export {};
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
  console.log('--- STARTING PRODUCT & INVENTORY TESTS ---\n');

  const adminToken = await getToken('admin@example.com');
  const salesToken = await getToken('sales@example.com');

  console.log(`[ADMIN TOKEN] ${adminToken.substring(0, 15)}...`);
  console.log(`[SALES TOKEN] ${salesToken.substring(0, 15)}...\n`);

  let productId = '';

  // 1. POST /products (ADMIN)
  console.log(`========================================`);
  console.log(`1. CREATE PRODUCT (ADMIN)`);
  console.log(`========================================`);
  const createRes = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Wireless Mouse',
      sku: 'WM-' + Date.now(), // Ensure unique
      category: 'Electronics',
      unitPrice: 25.99,
      currentStock: 0,
      minStockAlert: 10,
      location: 'Aisle 3'
    })
  });
  const createData = await createRes.json();
  console.log(`Status: ${createRes.status}`);
  console.log(`Body:`, JSON.stringify(createData, null, 2));
  
  if (createData.success) {
    productId = createData.data.id;
  } else {
    console.log("Failed to create product. Exiting tests.");
    return;
  }

  // 2. POST /products/:id/stock-movement IN (ADMIN)
  console.log(`\n========================================`);
  console.log(`2. IN MOVEMENT (ADMIN)`);
  console.log(`========================================`);
  const inRes = await fetch(`${API_URL}/products/${productId}/stock-movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      quantityChanged: 50,
      movementType: 'IN',
      reason: 'Initial Restock'
    })
  });
  const inData = await inRes.json();
  console.log(`Status: ${inRes.status}`);
  console.log(`Body:`, JSON.stringify(inData, null, 2));

  // 3. POST /products/:id/stock-movement Valid OUT (ADMIN)
  console.log(`\n========================================`);
  console.log(`3. VALID OUT MOVEMENT (ADMIN)`);
  console.log(`========================================`);
  const outRes = await fetch(`${API_URL}/products/${productId}/stock-movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      quantityChanged: 10,
      movementType: 'OUT',
      reason: 'Sold to customer'
    })
  });
  const outData = await outRes.json();
  console.log(`Status: ${outRes.status}`);
  console.log(`Body:`, JSON.stringify(outData, null, 2));

  // 4. POST /products/:id/stock-movement Invalid OUT (ADMIN)
  console.log(`\n========================================`);
  console.log(`4. INVALID OUT MOVEMENT (NEGATIVE STOCK) (ADMIN)`);
  console.log(`========================================`);
  const invOutRes = await fetch(`${API_URL}/products/${productId}/stock-movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      quantityChanged: 100, // Current stock is 40
      movementType: 'OUT',
      reason: 'Massive order'
    })
  });
  const invOutData = await invOutRes.json();
  console.log(`Status: ${invOutRes.status}`);
  console.log(`Body:`, JSON.stringify(invOutData, null, 2));

  // 5. POST /products (SALES) - Should fail 403
  console.log(`\n========================================`);
  console.log(`5. CREATE PRODUCT (SALES) - Expect 403`);
  console.log(`========================================`);
  const failRes = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      name: 'Keyboard',
      sku: 'KB-123',
      category: 'Electronics',
      unitPrice: 50.00,
      minStockAlert: 5,
      location: 'Aisle 4'
    })
  });
  const failData = await failRes.json();
  console.log(`Status: ${failRes.status}`);
  console.log(`Body:`, JSON.stringify(failData, null, 2));
}

runTests().catch(console.error);
