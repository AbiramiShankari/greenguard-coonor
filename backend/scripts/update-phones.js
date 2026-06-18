const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.user.update({
      where: { email: 'admin@greenguard.tn.gov.in' },
      data: { phone: '+919092317312' }
    });
    
    await prisma.user.update({
      where: { email: 'priya@example.com' },
      data: { phone: '+918072153966' }
    });
    
    await prisma.user.update({
      where: { email: 'karthik@greenguard.tn.gov.in' },
      data: { phone: '+919025303064' }
    });
    
    console.log('Successfully updated phone numbers in DB!');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
