const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogs() {
  const logs = await prisma.sMSLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log(logs);
}

checkLogs().catch(console.error).finally(() => prisma.$disconnect());
