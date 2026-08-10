import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, ChallanStatus, MovementType } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Schemas
const createChallanSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  items: z.array(
    z.object({
      productId: z.string().uuid('Valid product ID is required'),
      quantity: z.number().int().positive('Quantity must be positive')
    })
  ).min(1, 'At least one item is required')
});

// 1. POST /challans (Create DRAFT)
router.post('/', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createChallanSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const { customerId, items } = parseResult.data;

    // Check customer exists
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    // Fetch products to capture snapshot
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ success: false, error: 'One or more products not found' });
      return;
    }

    // Create a map for quick lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    let totalQuantity = 0;
    const challanItemsData = items.map(item => {
      const product = productMap.get(item.productId)!;
      totalQuantity += item.quantity;
      return {
        productId: item.productId,
        productNameSnapshot: product.name,
        productSkuSnapshot: product.sku,
        unitPriceSnapshot: product.unitPrice,
        quantity: item.quantity
      };
    });

    const now = new Date();
    const challanNumber = `CH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

    const challan = await prisma.challan.create({
      data: {
        challanNumber,
        customerId,
        status: ChallanStatus.DRAFT,
        totalQuantity,
        createdBy: req.user!.id,
        challanItems: {
          create: challanItemsData
        }
      },
      include: {
        challanItems: true
      }
    });

    res.status(201).json({ success: true, data: challan });
  } catch (error) {
    next(error);
  }
});

// 2. PUT /challans/:id/confirm (Confirm Challan)
router.put('/:id/confirm', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const challanId = req.params.id as string;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const challan = await tx.challan.findUnique({
          where: { id: challanId },
          include: { challanItems: true }
        });

        if (!challan) {
          throw new Error('NOT_FOUND');
        }

        if (challan.status !== ChallanStatus.DRAFT) {
          throw new Error('NOT_DRAFT');
        }

        // Fetch current products for these items to check stock
        const productIds = challan.challanItems.map(item => item.productId);
        
        // Ensure we lock these rows for update? We can use queryRaw for FOR UPDATE if strictly necessary,
        // but let's just rely on transaction isolation and application level checks for now, or just basic fetch.
        const products = await tx.product.findMany({
          where: { id: { in: productIds } }
        });

        const productMap = new Map(products.map(p => [p.id, p]));
        const insufficientProducts: string[] = [];

        // Check stock
        for (const item of challan.challanItems) {
          const product = productMap.get(item.productId);
          if (!product) {
             throw new Error('PRODUCT_NOT_FOUND');
          }
          if (product.currentStock < item.quantity) {
             insufficientProducts.push(`${product.name} (SKU: ${product.sku}) - Requested: ${item.quantity}, Available: ${product.currentStock}`);
          }
        }

        if (insufficientProducts.length > 0) {
          // Pass the list through the error message
          throw new Error(`INSUFFICIENT_STOCK||${JSON.stringify(insufficientProducts)}`);
        }

        // Deduct stock and create StockMovement
        for (const item of challan.challanItems) {
          const product = productMap.get(item.productId)!;
          
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: product.currentStock - item.quantity }
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantityChanged: item.quantity,
              movementType: MovementType.OUT,
              reason: `Challan ${challan.challanNumber} confirmed`,
              createdBy: req.user!.id
            }
          });
        }

        const updatedChallan = await tx.challan.update({
          where: { id: challanId },
          data: { status: ChallanStatus.CONFIRMED },
          include: { challanItems: true }
        });

        return updatedChallan;
      }, { timeout: 15000 });

      res.json({ success: true, data: result });
    } catch (txError: any) {
      if (txError.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, error: 'Challan not found' });
      } else if (txError.message === 'NOT_DRAFT') {
        res.status(400).json({ success: false, error: 'Only DRAFT challans can be confirmed' });
      } else if (txError.message === 'PRODUCT_NOT_FOUND') {
        res.status(400).json({ success: false, error: 'One or more products no longer exist' });
      } else if (txError.message.startsWith('INSUFFICIENT_STOCK||')) {
        const issues = JSON.parse(txError.message.split('||')[1]);
        res.status(400).json({ 
          success: false, 
          error: 'Insufficient stock for one or more items',
          details: issues
        });
      } else {
        throw txError;
      }
    }
  } catch (error) {
    next(error);
  }
});

// 3. PUT /challans/:id/cancel (Cancel Challan)
router.put('/:id/cancel', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const challanId = req.params.id as string;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const challan = await tx.challan.findUnique({
          where: { id: challanId },
          include: { challanItems: true }
        });

        if (!challan) {
          throw new Error('NOT_FOUND');
        }

        if (challan.status === ChallanStatus.CANCELLED) {
          throw new Error('ALREADY_CANCELLED');
        }

        if (challan.status === ChallanStatus.CONFIRMED) {
          // Restore stock
          const productIds = challan.challanItems.map(item => item.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } }
          });
          const productMap = new Map(products.map(p => [p.id, p]));

          for (const item of challan.challanItems) {
            const product = productMap.get(item.productId);
            if (product) { // If product was deleted, we might skip restoring stock or throw error. Let's just restore if it exists.
              await tx.product.update({
                where: { id: item.productId },
                data: { currentStock: product.currentStock + item.quantity }
              });

              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  quantityChanged: item.quantity,
                  movementType: MovementType.IN,
                  reason: `Challan ${challan.challanNumber} cancelled`,
                  createdBy: req.user!.id
                }
              });
            }
          }
        }

        // Both DRAFT and CONFIRMED get marked as CANCELLED
        const updatedChallan = await tx.challan.update({
          where: { id: challanId },
          data: { status: ChallanStatus.CANCELLED },
          include: { challanItems: true }
        });

        return updatedChallan;
      }, { timeout: 15000 });

      res.json({ success: true, data: result });
    } catch (txError: any) {
      if (txError.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, error: 'Challan not found' });
      } else if (txError.message === 'ALREADY_CANCELLED') {
        res.status(400).json({ success: false, error: 'Challan is already cancelled' });
      } else {
        throw txError;
      }
    }
  } catch (error) {
    next(error);
  }
});

// 4. GET /challans (List)
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const status = req.query.status as ChallanStatus | undefined;
    const customerId = req.query.customerId as string | undefined;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (customerId) whereClause.customerId = customerId;

    const [challans, total] = await Promise.all([
      prisma.challan.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, businessName: true } },
          user: { select: { id: true, name: true } }
        }
      }),
      prisma.challan.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: challans,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// 5. GET /challans/:id (Detail)
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { id: true, name: true, role: true } },
        challanItems: true
      }
    });

    if (!challan) {
      res.status(404).json({ success: false, error: 'Challan not found' });
      return;
    }

    res.json({ success: true, data: challan });
  } catch (error) {
    next(error);
  }
});

export default router;
