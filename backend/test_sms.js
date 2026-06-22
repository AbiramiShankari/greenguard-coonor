require('dotenv').config();
const { sendEventSMS } = require('./src/services/sms.service');

async function testSMS() {
  console.log("Testing Fast2SMS configuration...");
  try {
    const result = await sendEventSMS(
      'badge_earned',
      { badge: 'Green Guardian', points: 150 },
      '+919025303064',
      null, 
      false 
    );
    console.log("SMS Test Result:", result);
    process.exit(0);
  } catch (error) {
    console.error("SMS Test Failed:", error);
    process.exit(1);
  }
}

testSMS();
