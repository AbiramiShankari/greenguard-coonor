// GreenGuard — Database Seed
// Creates: 1 ADMIN, 2 CITIZENs, 1 COLLECTOR, sample complaints, collections
// Run: node seed.js

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding GreenGuard database...\n');

  await prisma.upcycleItem.deleteMany();
  await prisma.redemptionHistory.deleteMany();
  await prisma.rewardItem.deleteMany();
  await prisma.smartBin.deleteMany();
  await prisma.sMSLog.deleteMany();
  await prisma.aILog.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.upvote.deleteMany();
  await prisma.collectionRequest.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Cleared existing data');

  // ─── Create Users ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  const citizenPassword = await bcrypt.hash('Citizen@123', SALT_ROUNDS);
  const collectorPassword = await bcrypt.hash('Collector@123', SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      name: 'Rajesh Kumar',
      email: 'admin@greenguard.tn.gov.in',
      phone: '+919876543210',
      password: adminPassword,
      role: 'ADMIN',
      city: 'Bedford',
      smsOptIn: true,
      totalPoints: 0,
    },
  });
  console.log(`✅ Created ADMIN: ${admin.email}`);

  const citizen1 = await prisma.user.create({
    data: {
      name: 'Priya Subramaniam',
      email: 'priya@example.com',
      phone: '+919444123456',
      password: citizenPassword,
      role: 'CITIZEN',
      city: 'Wellington',
      smsOptIn: true,
      totalPoints: 85,
      currentBadge: 'Silver Guardian 🥈',
    },
  });
  console.log(`✅ Created CITIZEN: ${citizen1.email}`);

  const citizen2 = await prisma.user.create({
    data: {
      name: 'Murugan Pillai',
      email: 'murugan@example.com',
      phone: '+919876012345',
      password: citizenPassword,
      role: 'CITIZEN',
      city: 'Bedford',
      smsOptIn: true,
      totalPoints: 45,
      currentBadge: 'Bronze Citizen 🥉',
    },
  });
  console.log(`✅ Created CITIZEN: ${citizen2.email}`);

  const citizen3 = await prisma.user.create({
    data: {
      name: 'Test User A',
      email: 'testA@example.com',
      phone: '+919025303064',
      password: citizenPassword,
      role: 'CITIZEN',
      city: 'Bedford',
      smsOptIn: true,
      totalPoints: 100,
      currentBadge: 'Silver Guardian 🥈',
    },
  });
  console.log(`✅ Created CITIZEN: ${citizen3.phone}`);

  const citizen4 = await prisma.user.create({
    data: {
      name: 'Test User B',
      email: 'testB@example.com',
      phone: '+919092317312',
      password: citizenPassword,
      role: 'CITIZEN',
      city: 'Wellington',
      smsOptIn: true,
      totalPoints: 20,
    },
  });
  console.log(`✅ Created CITIZEN: ${citizen4.phone}`);

  const citizen5 = await prisma.user.create({
    data: {
      name: 'Test User C',
      email: 'testC@example.com',
      phone: '+918072153966',
      password: citizenPassword,
      role: 'CITIZEN',
      city: 'Bedford',
      smsOptIn: true,
      totalPoints: 50,
    },
  });
  console.log(`✅ Created CITIZEN: ${citizen5.phone}`);

  const collector = await prisma.user.create({
    data: {
      name: 'Karthik Selvam',
      email: 'karthik@greenguard.tn.gov.in',
      phone: '+919765432198',
      password: collectorPassword,
      role: 'COLLECTOR',
      city: 'Bedford',
      smsOptIn: true,
      totalPoints: 120,
      currentBadge: 'Green Champion 🥇',
    },
  });
  console.log(`✅ Created COLLECTOR: ${collector.email}`);

  // ─── Create Sample Complaints ─────────────────────────────────────────────────
  const complaint1 = await prisma.complaint.create({
    data: {
      userId: citizen1.id,
      city: 'Bedford',
      ward: 'Ward 3 - Bedford',
      location: 'Bedford Road, near bus stop',
      description: 'Large garbage pile has been accumulating near the bus stop for over a week. Overflowing bins are causing health hazards and bad smell in the area.',
      imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b',
      imageHash: 'mock-hash-1',
      street: 'Bedford Road',
      lat: 11.3601,
      lng: 76.7932,
      aiCategory: 'overflow',
      aiConfidence: 0.92,
      aiSeverity: 'high',
      aiSeverityScore: 0.8,
      aiSummary: 'Overflowing garbage bin near public transport stop',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      upvoteCount: 5,
    },
  });

  const complaint2 = await prisma.complaint.create({
    data: {
      userId: citizen2.id,
      city: 'Wellington',
      ward: 'Ward 2 - Barracks',
      location: 'Wellington Barracks near market',
      description: 'Someone has dumped construction debris and mixed waste near the park entrance. This is blocking the footpath.',
      imageUrl: 'https://images.unsplash.com/photo-1528323273322-d81458248d40',
      imageHash: 'mock-hash-2',
      street: 'Market Road',
      lat: 11.3653,
      lng: 76.7865,
      aiCategory: 'waste_dumping',
      aiConfidence: 0.88,
      aiSeverity: 'critical',
      aiSeverityScore: 0.95,
      aiSummary: 'Construction waste dump blocking public footpath',
      priority: 'CRITICAL',
      status: 'NEW',
      upvoteCount: 12,
    },
  });

  const complaint3 = await prisma.complaint.create({
    data: {
      userId: citizen1.id,
      city: 'Bedford',
      ward: 'Ward 5 - Bandishola',
      location: 'Bandishola junction near tea stall',
      description: 'Drainage is blocked and sewage water is overflowing onto the road. The area smells terrible and is a health risk.',
      imageUrl: 'https://images.unsplash.com/photo-1605646969248-2b8d0092c68e',
      imageHash: 'mock-hash-3',
      street: 'Bandishola Junction',
      lat: 11.3590,
      lng: 76.8115,
      aiCategory: 'drainage',
      aiConfidence: 0.95,
      aiSeverity: 'high',
      aiSeverityScore: 0.85,
      aiSummary: 'Blocked drainage causing sewage overflow on main road',
      priority: 'HIGH',
      status: 'RESOLVED',
      upvoteCount: 8,
    },
  });
  console.log(`✅ Created 3 sample complaints`);

  // ─── Create Sample Collection Requests ────────────────────────────────────────
  const collection1 = await prisma.collectionRequest.create({
    data: {
      citizenId: citizen1.id,
      collectorId: collector.id,
      wasteType: 'RECYCLABLE',
      quantity: 15.5,
      address: '42, Bedford Road, Bedford',
      street: 'Bedford Road',
      imageUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4',
      lat: 11.3601,
      lng: 76.7932,
      status: 'ASSIGNED',
    },
  });

  const collection2 = await prisma.collectionRequest.create({
    data: {
      citizenId: citizen2.id,
      wasteType: 'ORGANIC',
      quantity: 8.0,
      address: '15, Anna Nagar, Wellington',
      street: 'Anna Nagar',
      imageUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88',
      lat: 11.3653,
      lng: 76.7865,
      status: 'PENDING',
    },
  });
  console.log(`✅ Created 2 sample collection requests`);

  // ─── Create Sample Rewards ────────────────────────────────────────────────────
  await prisma.reward.createMany({
    data: [
      { userId: citizen1.id, points: 10, reason: 'complaint_submitted', complaintId: complaint1.id },
      { userId: citizen1.id, points: 5, reason: 'complaint_resolved', complaintId: complaint3.id },
      { userId: citizen1.id, points: 5, reason: 'collection_submitted', collectionId: collection1.id },
      { userId: citizen1.id, points: 0, reason: 'badge_earned', badge: 'Silver Guardian 🥈' },
      { userId: citizen2.id, points: 10, reason: 'complaint_submitted', complaintId: complaint2.id },
      { userId: citizen2.id, points: 5, reason: 'collection_submitted', collectionId: collection2.id },
      { userId: collector.id, points: 10, reason: 'collection_completed_collector' },
    ],
  });
  console.log(`✅ Created sample reward history`);

  // ─── Create Settings ──────────────────────────────────────────────────────────
  await prisma.settings.createMany({
    data: [
      { key: 'sms_enabled', value: 'true' },
      {
        key: 'ai_weekly_insight',
        value: JSON.stringify({
          topIssue: 'Drainage blockage and overflow',
          hotspot: 'Ward 12 - Gandhipuram',
          avgResolutionTime: '2.3 days',
          urgentCount: 3,
          weeklyTrend: 'stable',
          recommendation: 'Increase drainage inspection frequency in Gandhipuram ward before monsoon season.',
        }),
      },
    ],
  });
  console.log(`✅ Created default settings`);

  // ─── Create SMS Log Samples ───────────────────────────────────────────────────
  await prisma.sMSLog.createMany({
    data: [
      {
        userId: citizen1.id, phone: citizen1.phone,
        event: 'complaint_submitted', status: 'SENT',
        message: 'GreenGuard✅ Complaint received in Bedford. Category: overflow. Earned 10pts!',
        twilioSid: 'SM_DEMO_001',
      },
      {
        userId: citizen2.id, phone: citizen2.phone,
        event: 'complaint_submitted', status: 'SENT',
        message: 'GreenGuard✅ Complaint received in Wellington. Category: waste_dumping. Earned 10pts!',
        twilioSid: 'SM_DEMO_002',
      },
      {
        userId: citizen1.id, phone: citizen1.phone,
        event: 'complaint_resolved', status: 'FAILED',
        message: 'GreenGuard🎉 Complaint RESOLVED! +5pts earned.',
        error: 'Twilio credentials not configured',
      },
    ],
  });
  console.log(`✅ Created sample SMS logs`);

  // ─── Create Society Betterment Data ─────────────────────────────────────────

  await prisma.smartBin.createMany({
    data: [
      { location: 'Sims Park Entrance', street: 'Cantonment Road', ward: 'Ward 1', lat: 11.350, lng: 76.790, fillLevel: 85.0 },
      { location: 'Bedford Junction', street: 'Bedford Road', ward: 'Ward 3 - Bedford', lat: 11.360, lng: 76.793, fillLevel: 20.0 },
      { location: 'Wellington Market', street: 'Market Road', ward: 'Ward 2 - Barracks', lat: 11.365, lng: 76.786, fillLevel: 95.0 },
    ]
  });

  const rewardItem1 = await prisma.rewardItem.create({
    data: { name: '10% Discount at Crown Bakery', description: 'Get a 10% off on all baked goods.', pointCost: 50, partnerName: 'Crown Bakery', imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff' }
  });
  const rewardItem2 = await prisma.rewardItem.create({
    data: { name: 'Free Bus Pass (1 Day)', description: 'Unlimited rides on local transit for a day.', pointCost: 100, partnerName: 'TNSTC', imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957' }
  });

  await prisma.redemptionHistory.create({
    data: { userId: citizen1.id, rewardItemId: rewardItem1.id, pointsSpent: 50 }
  });

  await prisma.upcycleItem.createMany({
    data: [
      { donorId: citizen1.id, title: 'Old Study Table', description: 'Wooden study table, slightly scratched but sturdy.', category: 'FURNITURE', imageUrl: 'https://images.unsplash.com/photo-1506898667547-42e22a46e125' },
      { donorId: citizen2.id, title: 'Working CRT TV', description: 'Old TV, works fine.', category: 'ELECTRONICS', imageUrl: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620' }
    ]
  });
  console.log(`✅ Created Society Betterment & Gamification records`);

  console.log('\n🎉 GreenGuard database seeded successfully!\n');
  console.log('─────────────────────────────────────────');
  console.log('Test Credentials:');
  console.log(`  ADMIN:     admin@greenguard.tn.gov.in / Admin@123`);
  console.log(`  CITIZEN 1: priya@example.com / Citizen@123`);
  console.log(`  CITIZEN 2: murugan@example.com / Citizen@123`);
  console.log(`  COLLECTOR: karthik@greenguard.tn.gov.in / Collector@123`);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
