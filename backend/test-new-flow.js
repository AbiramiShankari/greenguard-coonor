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
  console.log('🚀 Starting New Flow E2E API Tests...');
  let collectorId;
  let citizenId;
  let initialCollectorPoints = 0;

  try {
    // Wait for server to be fully ready
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
        }
      } else {
        throw new Error(`${role} login failed`);
      }
    }

    const citizenAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.citizen}` }});
    const adminAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.admin}` }});
    const collectorAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.collector}` }});

    // 2. Citizen Flow
    console.log('\n[2] Citizen creates a complaint');
    
    const form = new FormData();
    form.append('city', 'Bedford');
    form.append('ward', 'Ward 1');
    form.append('location', 'Test Location');
    form.append('description', 'E2E Testing the assignment flow');
    form.append('image', new Blob(['mockcitizenimage'], { type: 'image/jpeg' }), 'test.jpg');

    let res = await citizenAxios.post(`${BASE_URL}/complaints`, form);
    const newComplaintId = res.data.data?.complaint?.id || res.data.complaint?.id;
    console.log('✅ Complaint created. ID:', newComplaintId);

    // 3. Admin Flow
    console.log('\n[3] Admin assigns complaint to collector');
    res = await adminAxios.get(`${BASE_URL}/admin/collectors`);
    const collectors = res.data.data?.collectors || [];
    console.log(`✅ Fetched ${collectors.length} collectors`);
    
    if (!collectors.find(c => c.id === collectorId)) {
        throw new Error('Test collector not found in admin list');
    }

    res = await adminAxios.post(`${BASE_URL}/admin/assign-task`, {
      taskId: newComplaintId,
      type: 'complaint',
      collectorId: collectorId
    });
    console.log('✅ Admin assigned task successfully');

    // 4. Collector Flow
    console.log('\n[4] Collector views and resolves task');
    res = await collectorAxios.get(`${BASE_URL}/collector/tasks`);
    const complaints = res.data.data?.complaints || [];
    const assignedTask = complaints.find(c => c.id === newComplaintId);
    if (!assignedTask) {
        throw new Error('Assigned task not found in collector dashboard');
    }
    console.log('✅ Collector saw the assigned task');

    res = await collectorAxios.post(`${BASE_URL}/collector/tasks/resolve`, {
      taskId: newComplaintId,
      type: 'complaint',
      resolvedImageUrl: 'data:image/jpeg;base64,mockresolvedimage'
    });
    console.log('✅ Collector resolved task with an image upload');

    // 5. Verification
    console.log('\n[5] Verifying database changes');
    const updatedComplaint = await prisma.complaint.findUnique({ where: { id: newComplaintId } });
    if (updatedComplaint.status !== 'RESOLVED' || updatedComplaint.resolvedImageUrl !== 'data:image/jpeg;base64,mockresolvedimage') {
        throw new Error('Complaint status or image not updated properly');
    }
    console.log('✅ Complaint status and image verified in DB');

    const updatedCollector = await prisma.user.findUnique({ where: { id: collectorId } });
    if (updatedCollector.totalPoints !== initialCollectorPoints + 10) {
        throw new Error(`Worker credits not awarded. Expected ${initialCollectorPoints + 10}, got ${updatedCollector.totalPoints}`);
    }
    console.log('✅ Collector worker credits awarded successfully');

    console.log('\n🎉 New Flow E2E Tests Passed successfully!');
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
