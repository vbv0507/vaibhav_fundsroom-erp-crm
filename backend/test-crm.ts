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
  console.log('--- STARTING CRM TESTS ---\n');

  const salesToken = await getToken('sales@example.com');
  const warehouseToken = await getToken('warehouse@example.com');

  console.log(`[SALES TOKEN] ${salesToken.substring(0, 15)}...`);
  console.log(`[WAREHOUSE TOKEN] ${warehouseToken.substring(0, 15)}...\n`);

  let customerId = '';

  // 1. POST /customers (SALES)
  console.log(`========================================`);
  console.log(`1. CREATE CUSTOMER (SALES)`);
  console.log(`========================================`);
  const createRes = await fetch(`${API_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      name: 'John Doe',
      mobile: '+919876543210',
      email: 'john@doe.com',
      businessName: 'Doe Enterprises',
      customerType: 'RETAIL',
      address: '123 Main St',
      status: 'LEAD',
    })
  });
  const createData = await createRes.json();
  console.log(`Status: ${createRes.status}`);
  console.log(`Body:`, JSON.stringify(createData, null, 2));
  
  if (createData.success) {
    customerId = createData.data.id;
  }

  // 2. GET /customers (SALES) - Search
  console.log(`\n========================================`);
  console.log(`2. LIST CUSTOMERS (SALES) - Search: 'Doe'`);
  console.log(`========================================`);
  const listRes = await fetch(`${API_URL}/customers?q=Doe`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  const listData = await listRes.json();
  console.log(`Status: ${listRes.status}`);
  console.log(`Body:`, JSON.stringify(listData, null, 2));

  if (customerId) {
    // 3. PUT /customers/:id (SALES)
    console.log(`\n========================================`);
    console.log(`3. UPDATE CUSTOMER (SALES)`);
    console.log(`========================================`);
    const updateRes = await fetch(`${API_URL}/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        name: 'John Doe',
        mobile: '+919876543210',
        businessName: 'Doe Enterprises LLC',
        customerType: 'WHOLESALE',
        address: '123 Main St',
        status: 'ACTIVE',
      })
    });
    const updateData = await updateRes.json();
    console.log(`Status: ${updateRes.status}`);
    console.log(`Body:`, JSON.stringify(updateData, null, 2));

    // 4. POST /customers/:id/notes (SALES)
    console.log(`\n========================================`);
    console.log(`4. ADD NOTE TO CUSTOMER (SALES)`);
    console.log(`========================================`);
    const noteRes = await fetch(`${API_URL}/customers/${customerId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({ text: 'Customer converted to wholesale.' })
    });
    const noteData = await noteRes.json();
    console.log(`Status: ${noteRes.status}`);
    console.log(`Body:`, JSON.stringify(noteData, null, 2));

    // 5. GET /customers/:id (SALES) - Full Detail
    console.log(`\n========================================`);
    console.log(`5. GET CUSTOMER BY ID (SALES)`);
    console.log(`========================================`);
    const getRes = await fetch(`${API_URL}/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const getData = await getRes.json();
    console.log(`Status: ${getRes.status}`);
    console.log(`Body:`, JSON.stringify(getData, null, 2));
  }

  // 6. POST /customers (WAREHOUSE) - Should fail 403
  console.log(`\n========================================`);
  console.log(`6. CREATE CUSTOMER (WAREHOUSE) - Expect 403`);
  console.log(`========================================`);
  const failRes = await fetch(`${API_URL}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${warehouseToken}` },
    body: JSON.stringify({
      name: 'Jane Smith',
      mobile: '+919876543211',
      businessName: 'Smith Co',
      customerType: 'RETAIL',
      address: '456 Side St',
    })
  });
  const failData = await failRes.json();
  console.log(`Status: ${failRes.status}`);
  console.log(`Body:`, JSON.stringify(failData, null, 2));
}

runTests().catch(console.error);
