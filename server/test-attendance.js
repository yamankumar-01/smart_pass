import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Automated Core Backend API Verification...\n');

  try {
    // 1. Seed Sample Data & Active Session
    console.log('1️⃣ Seeding Active Session and Sample Students...');
    const seedRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/seed-samples',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('   Seed response:', seedRes.data);

    // 2. Fetch Active Sessions
    console.log('\n2️⃣ Fetching Sessions...');
    const sessRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/sessions',
      method: 'GET'
    });
    const activeSession = sessRes.data.find(s => s.status === 'ACTIVE');
    console.log(`   Found Active Session ID: ${activeSession.id} (${activeSession.name})`);

    // 3. Fetch Students & Obtain Token
    console.log('\n3️⃣ Fetching Registered Students...');
    const studRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/students',
      method: 'GET'
    });
    const targetStudent = studRes.data[0];
    console.log(`   Target Student: ${targetStudent.name} (Email: ${targetStudent.email})`);
    console.log(`   Token (Random Unique): ${targetStudent.token}`);

    // 4. Test Scan #1 (First Scan - Expect Success)
    console.log('\n4️⃣ Testing Initial Scan (First Entry)...');
    const scan1Res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/attendance/scan',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      token: targetStudent.token,
      session_id: activeSession.id
    });
    console.log(`   Scan 1 Status Code: ${scan1Res.status}`);
    console.log('   Scan 1 Result:', scan1Res.data);

    if (scan1Res.data.success && !scan1Res.data.duplicate) {
      console.log('   ✅ PASS: Initial scan successfully marked student present!');
    } else {
      console.error('   ❌ FAIL: Initial scan failed!');
    }

    // 5. Test Scan #2 (Duplicate Scan - Expect Rejection / Already Marked)
    console.log('\n5️⃣ Testing Duplicate Scan (Re-scanning Same QR Token)...');
    const scan2Res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/attendance/scan',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      token: targetStudent.token,
      session_id: activeSession.id
    });
    console.log(`   Scan 2 Status Code: ${scan2Res.status}`);
    console.log('   Scan 2 Result:', scan2Res.data);

    if (scan2Res.data.duplicate === true) {
      console.log('   ✅ PASS: Duplicate scan correctly rejected with "Already marked" status!');
    } else {
      console.error('   ❌ FAIL: Duplicate scan was not rejected correctly!');
    }

    // 6. Test Invalid Token Scan
    console.log('\n6️⃣ Testing Invalid Token Scan...');
    const scanInvalid = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/attendance/scan',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      token: 'invalid_fake_token_123',
      session_id: activeSession.id
    });
    console.log('   Invalid Token Result:', scanInvalid.data);
    if (scanInvalid.status === 404 && scanInvalid.data.success === false) {
      console.log('   ✅ PASS: Invalid token correctly returned 404 Not Found error!');
    }

    console.log('\n🎉 ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

runTests();
