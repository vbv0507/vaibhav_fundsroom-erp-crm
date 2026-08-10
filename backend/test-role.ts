const API_URL = 'http://localhost:5000/auth';

const testUsers = [
  { role: 'ADMIN', email: 'admin@example.com', password: 'password123' },
  { role: 'SALES', email: 'sales@example.com', password: 'password123' },
];

async function runTests() {
  for (const user of testUsers) {
    console.log(`\n========================================`);
    console.log(`TESTING ROLE: ${user.role} against /test-admin-only`);
    console.log(`========================================`);

    // 1. Get Token
    const loginRes = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    // 2. Test Admin Only Route
    const res = await fetch(`${API_URL}/test-admin-only`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Body:`, JSON.stringify(data, null, 2));
  }
}

runTests().catch(console.error);
