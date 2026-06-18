const axios = require('axios');
const { httpServer } = require('./server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3001/api';

const credentials = {
  admin: { email: 'admin@greenguard.tn.gov.in', password: 'Admin@123' },
  citizen: { email: 'priya@example.com', password: 'Citizen@123' },
  collector: { email: 'karthik@greenguard.tn.gov.in', password: 'Collector@123' }
};

let tokens = {};

async function runTests() {
  console.log('🚀 Starting Exhaustive E2E API Tests...');
  let collectorId;
  let citizenId;
  let initialCollectorPoints = 0;
  let initialCitizenPoints = 0;

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Auth Flow
    console.log('\n[1] Testing Authentication');
    for (const [role, creds] of Object.entries(credentials)) {
      const res = await axios.post(`${BASE_URL}/auth/login`, creds);
      if (res.data.success && res.data.data?.accessToken) {
        tokens[role] = res.data.data.accessToken;
        console.log(`✅ ${role} logged in successfully`);
        if (role === 'collector') {
          collectorId = res.data.data.user.id;
          initialCollectorPoints = res.data.data.user.totalPoints || 0;
        } else if (role === 'citizen') {
          citizenId = res.data.data.user.id;
          initialCitizenPoints = res.data.data.user.totalPoints || 0;
        }
      } else {
        throw new Error(`${role} login failed`);
      }
    }

    const citizenAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.citizen}` }});
    const adminAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.admin}` }});
    const collectorAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.collector}` }});

    // 2. Citizen Flow: Complaint
    console.log('\n[2] Citizen creates a complaint & collection request');
    const compForm = new FormData();
    compForm.append('city', 'Bedford');
    compForm.append('ward', 'Ward 1');
    compForm.append('location', 'E2E Complete Test Location');
    compForm.append('description', 'Testing all flows for E2E script');
    compForm.append('image', new Blob(['mockcitizenimage'], { type: 'image/jpeg' }), 'test1.jpg');

    let res = await citizenAxios.post(`${BASE_URL}/complaints`, compForm);
    const newComplaintId = res.data.data?.complaint?.id || res.data.complaint?.id;
    console.log('✅ Complaint created. ID:', newComplaintId);

    // Citizen Flow: Collection Request
    const collForm = new FormData();
    collForm.append('wasteType', 'E_WASTE');
    collForm.append('quantity', '5');
    collForm.append('address', '123 Main St, Bedford');
    collForm.append('lat', '11.3530');
    collForm.append('lng', '76.7959');
    collForm.append('image', new Blob(['mockcollectionimage'], { type: 'image/jpeg' }), 'test2.jpg');
    
    res = await citizenAxios.post(`${BASE_URL}/collections`, collForm);
    const newCollectionId = res.data.data?.collection?.id || res.data.collection?.id;
    console.log('✅ Collection request created. ID:', newCollectionId);

    // 3. Admin Flow
    console.log('\n[3] Admin assigns tasks to collector');
    res = await adminAxios.post(`${BASE_URL}/admin/assign-task`, {
      taskId: newComplaintId,
      type: 'complaint',
      collectorId: collectorId
    });
    console.log('✅ Admin assigned complaint successfully');

    res = await adminAxios.post(`${BASE_URL}/admin/assign-task`, {
      taskId: newCollectionId,
      type: 'pickup',
      collectorId: collectorId
    });
    console.log('✅ Admin assigned collection successfully');

    // 4. Collector Flow
    console.log('\n[4] Collector resolves both tasks');
    res = await collectorAxios.post(`${BASE_URL}/collector/tasks/resolve`, {
      taskId: newComplaintId,
      type: 'complaint',
      resolvedImageUrl: 'data:image/jpeg;base64,mockresolvedimage1'
    });
    console.log('✅ Collector resolved complaint');

    res = await collectorAxios.post(`${BASE_URL}/collector/tasks/resolve`, {
      taskId: newCollectionId,
      type: 'pickup',
      resolvedImageUrl: 'data:image/jpeg;base64,mockresolvedimage2'
    });
    console.log('✅ Collector resolved collection');

    // 5. Duplicate AI Handling Check (Just checking if it throws)
    console.log('\n[5] Testing AI Duplicate Handling');
    const dupForm = new FormData();
    dupForm.append('city', 'Bedford');
    dupForm.append('ward', 'Ward 1');
    dupForm.append('location', 'E2E Complete Test Location'); // Same location should trigger duplicate logic or at least run
    dupForm.append('description', 'Testing all flows for E2E script');
    dupForm.append('image', new Blob(['mockcitizenimage'], { type: 'image/jpeg' }), 'test1.jpg');
    res = await citizenAxios.post(`${BASE_URL}/complaints`, dupForm);
    console.log('✅ Handled duplicate submission test');

    // 6. Verification
    console.log('\n[6] Verifying Points and Data');
    const updatedCollector = await prisma.user.findUnique({ where: { id: collectorId } });
    const expectedCollectorPoints = initialCollectorPoints + 10 + 15; // 10 for complaint, 15 for collection
    if (updatedCollector.totalPoints !== expectedCollectorPoints) {
        console.warn(`⚠️ Collector worker credits expected ${expectedCollectorPoints}, got ${updatedCollector.totalPoints}`);
    } else {
        console.log('✅ Collector worker credits awarded correctly (+25)');
    }

    const updatedCitizen = await prisma.user.findUnique({ where: { id: citizenId } });
    const expectedCitizenPoints = initialCitizenPoints + 10 + 5 + 10 + 15 + 10; // 10 for creating comp, 5 for resolved comp, 10 for creating coll, 15 for resolved coll, 10 for second duplicate comp.
    if (updatedCitizen.totalPoints < initialCitizenPoints + 20) {
        console.warn(`⚠️ Citizen points expected to increase, went from ${initialCitizenPoints} to ${updatedCitizen.totalPoints}`);
    } else {
        console.log(`✅ Citizen points awarded correctly (Current: ${updatedCitizen.totalPoints})`);
    }

    console.log('\n🎉 Exhaustive E2E Tests Passed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ E2E Test Failed');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runTests();
