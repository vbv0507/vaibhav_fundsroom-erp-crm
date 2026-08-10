import { PrismaClient, CustomerType, CustomerStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING CLEANUP ---');
  
  // 1. Delete all Challans and their Items
  const itemsDeleted = await prisma.challanItem.deleteMany({});
  const challansDeleted = await prisma.challan.deleteMany({});
  console.log(`Deleted ${itemsDeleted.count} ChallanItems and ${challansDeleted.count} Challans`);

  // 2. Delete all Products and their StockMovements
  const movementsDeleted = await prisma.stockMovement.deleteMany({});
  const productsDeleted = await prisma.product.deleteMany({});
  console.log(`Deleted ${movementsDeleted.count} StockMovements and ${productsDeleted.count} Products`);

  // 3. Delete all Customers and their CustomerNotes
  const notesDeleted = await prisma.customerNote.deleteMany({});
  const customersDeleted = await prisma.customer.deleteMany({});
  console.log(`Deleted ${notesDeleted.count} CustomerNotes and ${customersDeleted.count} Customers`);

  console.log('\n--- SEEDING NEW DATA ---');

  // Seed Customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'Ramesh Patel',
        mobile: '+919876543210',
        email: 'ramesh@rameshtraders.com',
        businessName: 'Ramesh Traders',
        gstNumber: '29ABCDE1234F1Z5',
        customerType: CustomerType.DISTRIBUTOR,
        address: '42 MG Road, Bengaluru, Karnataka 560001',
        status: CustomerStatus.ACTIVE,
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Amit Sharma',
        mobile: '+918765432109',
        businessName: 'Sharma Electronics',
        customerType: CustomerType.WHOLESALE,
        address: 'Shop 12, Lamington Road, Mumbai, Maharashtra 400004',
        status: CustomerStatus.ACTIVE,
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Priya Singh',
        mobile: '+917654321098',
        email: 'priya.singh@gmail.com',
        businessName: 'Priya Tech',
        customerType: CustomerType.RETAIL,
        address: 'C-Block, Connaught Place, New Delhi 110001',
        status: CustomerStatus.LEAD,
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Suresh Verma',
        mobile: '+919998887776',
        businessName: 'Verma & Co',
        gstNumber: '07AAAAA0000A1Z5',
        customerType: CustomerType.WHOLESALE,
        address: 'Phase 1, Industrial Area, Noida, UP 201301',
        status: CustomerStatus.ACTIVE,
      }
    })
  ]);
  console.log(`Seeded ${customers.length} realistic customers.`);

  // Seed Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Lenovo ThinkPad E14',
        sku: 'LAP-LEN-E14',
        category: 'Laptops',
        unitPrice: 55000.00,
        currentStock: 45,
        minStockAlert: 10,
        location: 'Aisle 1, Rack A',
      }
    }),
    prisma.product.create({
      data: {
        name: 'Dell P2419H 24" Monitor',
        sku: 'MON-DEL-2419',
        category: 'Displays',
        unitPrice: 12500.00,
        currentStock: 20,
        minStockAlert: 15,
        location: 'Aisle 2, Rack B',
      }
    }),
    prisma.product.create({
      data: {
        name: 'Logitech MX Master 3S',
        sku: 'ACC-LOG-MX3S',
        category: 'Accessories',
        unitPrice: 8999.00,
        currentStock: 5,  // LOW STOCK!
        minStockAlert: 10,
        location: 'Aisle 3, Rack A',
      }
    }),
    prisma.product.create({
      data: {
        name: 'Sony WH-1000XM5 Headphones',
        sku: 'AUD-SON-XM5',
        category: 'Audio',
        unitPrice: 24990.00,
        currentStock: 12,
        minStockAlert: 5,
        location: 'Secure Cabinet 1',
      }
    }),
    prisma.product.create({
      data: {
        name: 'Apple USB-C to Lightning Cable',
        sku: 'ACC-APP-USBC',
        category: 'Accessories',
        unitPrice: 1900.00,
        currentStock: 150,
        minStockAlert: 50,
        location: 'Aisle 3, Rack C',
      }
    })
  ]);
  console.log(`Seeded ${products.length} realistic products.`);

  console.log('\n--- VERIFICATION ---');
  const userCount = await prisma.user.count();
  const customerCount = await prisma.customer.count();
  const productCount = await prisma.product.count();
  const challanCount = await prisma.challan.count();

  console.log(`Users (untouched): ${userCount}`);
  console.log(`Customers: ${customerCount}`);
  console.log(`Products: ${productCount}`);
  console.log(`Challans: ${challanCount}`);

  console.log('\nDone! Demo data is ready.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
