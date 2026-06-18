// GreenGuard — Integration Test for Local Drives
const { PrismaClient } = require('@prisma/client');
const { sendEventSMS } = require('./src/services/sms.service');
const { awardPoints } = require('./src/services/reward.service');

const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting Local Drive E2E Test ---');

  // 1. Get an Admin and a Citizen
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const citizen = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });

  if (!admin || !citizen) {
    console.error('Missing required users (ADMIN or CITIZEN)');
    return;
  }

  console.log(`Using Admin: ${admin.name} | Citizen: ${citizen.name}`);

  // 2. Admin creates a drive
  const drive = await prisma.localDrive.create({
    data: {
      title: 'Sims Park Cleanup Drive',
      description: 'Cleaning up the park after the weekend rush.',
      location: 'Sims Park, Coonoor',
      city: 'Coonoor',
      ward: 'Ward 10',
      date: new Date(Date.now() + 86400000), // Tomorrow
      organizerId: admin.id,
      status: 'PLANNED',
    },
  });
  console.log(`✅ Drive created: ${drive.title} (${drive.id})`);

  // 3. Citizen joins the drive
  const participant = await prisma.driveParticipant.create({
    data: {
      driveId: drive.id,
      userId: citizen.id,
      status: 'REGISTERED',
    },
  });
  console.log(`✅ Citizen ${citizen.name} registered for the drive`);

  // Send SMS for registration
  if (citizen.phone) {
    const formattedDate = new Date(drive.date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short'
    });
    await sendEventSMS('drive_registered', { title: drive.title, date: formattedDate }, citizen.phone, citizen.id, false);
    console.log(`✅ Registration SMS queued for ${citizen.name}`);
  }

  // 4. Admin marks attendance
  await prisma.driveParticipant.update({
    where: { id: participant.id },
    data: { status: 'ATTENDED' },
  });
  
  const points = 20;
  await awardPoints(citizen.id, points, 'drive_participation', null, null, drive.id);
  console.log(`✅ Attendance marked and ${points} points awarded`);

  if (citizen.phone) {
    const updatedCitizen = await prisma.user.findUnique({ where: { id: citizen.id } });
    await sendEventSMS('drive_attended', {
      title: drive.title,
      points,
      totalPoints: updatedCitizen.totalPoints,
    }, citizen.phone, citizen.id, false);
    console.log(`✅ Attendance SMS queued for ${citizen.name}`);
  }

  // 5. Admin updates drive status to COMPLETED
  await prisma.localDrive.update({
    where: { id: drive.id },
    data: { status: 'COMPLETED' },
  });
  console.log(`✅ Drive marked as COMPLETED`);

  // 6. Verify SMS logs
  const logs = await prisma.sMSLog.findMany({
    where: { userId: citizen.id, event: { in: ['drive_registered', 'drive_attended'] } },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });

  console.log('\n--- SMS Logs ---');
  logs.forEach(log => console.log(`[${log.event}] ${log.phone} - ${log.status} : ${log.message}`));

  console.log('\n--- Test Completed Successfully ---');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
