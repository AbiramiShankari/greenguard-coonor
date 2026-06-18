const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const storeItems = [
  {
    name: 'Moddy\'s Chocolates Voucher',
    description: 'Get Rs. 100 off on any purchase of Nilgiris famous Moddy\'s Chocolates.',
    pointCost: 500,
    partnerName: 'Moddy\'s Chocolates',
    imageUrl: 'https://via.placeholder.com/400x300.png?text=Moddys+Chocolates'
  },
  {
    name: 'Coonoor Supermarket Discount',
    description: 'Flat 5% discount on your next grocery bill at Coonoor Supermarket.',
    pointCost: 300,
    partnerName: 'Coonoor Supermarket',
    imageUrl: 'https://via.placeholder.com/400x300.png?text=Supermarket+Discount'
  },
  {
    name: 'Cafe Diem Free Coffee',
    description: 'Enjoy a free hot beverage of your choice at Cafe Diem with a beautiful view.',
    pointCost: 250,
    partnerName: 'Cafe Diem',
    imageUrl: 'https://via.placeholder.com/400x300.png?text=Cafe+Diem+Coffee'
  },
  {
    name: 'Crown Bakery Varkey Pack',
    description: 'A free 250g pack of authentic Ooty/Coonoor Varkey from Crown Bakery.',
    pointCost: 400,
    partnerName: 'Crown Bakery',
    imageUrl: 'https://via.placeholder.com/400x300.png?text=Crown+Bakery+Varkey'
  },
  {
    name: 'Nilgiris Groceries Rs. 50 Off',
    description: 'Get Rs. 50 flat off on your next purchase at Nilgiris Groceries.',
    pointCost: 200,
    partnerName: 'Nilgiris Groceries',
    imageUrl: 'https://via.placeholder.com/400x300.png?text=Nilgiris+Groceries'
  }
];

async function main() {
  console.log('Seeding store items...');
  for (const item of storeItems) {
    await prisma.rewardItem.create({
      data: item
    });
  }
  console.log('Store items seeded successfully!');

  // Generate greenguardId for existing users who don't have one
  const crypto = require('crypto');
  const users = await prisma.user.findMany({ where: { greenguardId: null } });
  
  if (users.length > 0) {
    console.log(`Generating greenguardId for ${users.length} existing users...`);
    for (const user of users) {
      const greenguardId = `GG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { greenguardId }
      });
    }
    console.log('Successfully updated existing users with greenguardId!');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
