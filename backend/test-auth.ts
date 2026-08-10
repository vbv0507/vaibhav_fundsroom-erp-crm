const API_URL = 'http://localhost:5000/auth';

const testUsers = [
  { role: 'ADMIN', email: 'admin@example.com', password: 'password123' },
  { role: 'SALES', email: 'sales@example.com', password: 'password123' },
  { role: 'WAREHOUSE', email: 'warehouse@example.com', password: 'password123' },
  { role: 'ACCOUNTS', email: 'accounts@example.com', password: 'password123' },
];

async function runTests() {
  console.log('--- STARTING AUTH TESTS ---\n');

  for (const user of testUsers) {
    console.log(`\n========================================`);
    console.log(`TESTING ROLE: ${user.role}`);
    console.log(`========================================`);

    // TEST LOGIN
    console.log(`\n[REQUEST 1] POST /auth/login`);
    console.log(`Payload:`, { email: user.email, password: user.password });
    
    let token = '';
    
    try {
      const loginRes = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password })
      });
      const loginData = await loginRes.json();
      
      console.log(`\n[RESPONSE 1] Status: ${loginRes.status}`);
      console.log(`Body:`, JSON.stringify(loginData, null, 2));
      
      if (!loginRes.ok) continue;
      token = loginData.data.token;
    } catch (error: any) {
      console.log(`\n[ERROR 1] ${error.message}`);
      continue;
    }

    // TEST ME
    console.log(`\n[REQUEST 2] GET /auth/me`);
    console.log(`Headers: Authorization: Bearer ${token.substring(0, 15)}...`);
    
    try {
      const meRes = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const meData = await meRes.json();
      
      console.log(`\n[RESPONSE 2] Status: ${meRes.status}`);
      console.log(`Body:`, JSON.stringify(meData, null, 2));
    } catch (error: any) {
      console.log(`\n[ERROR 2] ${error.message}`);
    }
  }
}

runTests().catch(console.error);
