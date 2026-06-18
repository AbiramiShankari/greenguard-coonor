const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const credentials = {
  admin: { email: 'admin@greenguard.tn.gov.in', password: 'Admin@123' },
  citizen: { email: 'priya@example.com', password: 'Citizen@123' },
  collector: { email: 'karthik@greenguard.tn.gov.in', password: 'Collector@123' }
};

let tokens = {};

async function runTests() {
  console.log('🚀 Starting E2E API Tests...');

  try {
    // 1. Auth Flow
    console.log('\n[1] Testing Authentication');
    for (const [role, creds] of Object.entries(credentials)) {
      const res = await axios.post(`${BASE_URL}/auth/login`, creds);
      if (res.data.success && res.data.data?.accessToken) {
        tokens[role] = res.data.data.accessToken;
        console.log(`✅ ${role} logged in successfully`);
      } else {
        console.log('Login failed response:', res.data);
        throw new Error(`${role} login failed`);
      }
    }

    // 2. Citizen Flow
    console.log('\n[2] Testing Citizen Endpoints');
    const citizenAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.citizen}` }});
    
    // Check dashboard
    let res = await citizenAxios.get(`${BASE_URL}/auth/me`);
    console.log('✅ Citizen profile fetched');
    
    // Submit complaint
    res = await citizenAxios.post(`${BASE_URL}/complaints`, {
      city: 'Bedford',
      ward: 'Ward 1',
      location: 'Test Location',
      description: 'Test description of a waste dump'
    });
    const newComplaintId = res.data.data?.complaint?.id || res.data.complaint?.id;
    console.log('✅ Complaint created. ID:', newComplaintId);

    // Submit collection
    res = await citizenAxios.post(`${BASE_URL}/collections`, {
      wasteType: 'ORGANIC',
      quantity: 5.5,
      address: 'Test Address'
    });
    const newCollectionId = res.data.data?.collection?.id || res.data.collection?.id;
    console.log('✅ Collection request created. ID:', newCollectionId);

    // 3. Collector Flow
    console.log('\n[3] Testing Collector Endpoints');
    const collectorAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.collector}` }});
    
    // Fetch assigned collections
    res = await collectorAxios.get(`${BASE_URL}/collections`);
    console.log('✅ Collector fetched collections');

    // Update collection status
    if (newCollectionId) {
       const assigned = (res.data.data?.collections || res.data.collections || []).find(c => c.status === 'ASSIGNED');
       if (assigned) {
           res = await collectorAxios.put(`${BASE_URL}/collections/${assigned.id}`, { status: 'COMPLETED' });
           console.log('✅ Collector completed collection');
       }
    }

    // 4. Admin Flow
    console.log('\n[4] Testing Admin Endpoints');
    const adminAxios = axios.create({ headers: { Authorization: `Bearer ${tokens.admin}` }});
    
    // Fetch all complaints
    res = await adminAxios.get(`${BASE_URL}/complaints`);
    console.log(`✅ Admin fetched ${(res.data.data?.complaints || res.data.complaints || []).length} complaints`);

    // Update complaint status
    if (newComplaintId) {
        res = await adminAxios.put(`${BASE_URL}/complaints/${newComplaintId}`, { status: 'RESOLVED', note: 'Fixed' });
        console.log('✅ Admin resolved complaint');
    }

    // Fetch map data
    res = await adminAxios.get(`${BASE_URL}/map/complaints`);
    console.log(`✅ Admin fetched map data`);

    console.log('\n🎉 All API Tests Passed successfully!');

  } catch (error) {
    console.error('\n❌ E2E Test Failed');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runTests();
