import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, MovementType } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Schemas
const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  unitPrice: z.number().positive('Unit price must be positive'),
  currentStock: z.number().int().nonnegative('Stock cannot be negative').default(0),
  minStockAlert: z.number().int().nonnegative('Min stock alert cannot be negative'),
  location: z.string().min(1, 'Location is required'),
});

const stockMovementSchema = z.object({
  quantityChanged: z.number().int().positive('Quantity changed must be a positive integer'),
  movementType: z.nativeEnum(MovementType),
  reason: z.string().optional(),
});

// 1. POST /products
router.post('/', requireAuth, requireRole('ADMIN', 'WAREHOUSE'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = productSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const data = parseResult.data;
    
    // Check if SKU exists
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) {
      res.status(400).json({ success: false, error: 'SKU must be unique' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        category: data.category,
        unitPrice: data.unitPrice,
        currentStock: data.currentStock,
        minStockAlert: data.minStockAlert,
        location: data.location,
      }
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// 2. PUT /products/:id
router.put('/:id', requireAuth, requireRole('ADMIN', 'WAREHOUSE'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Explicitly reject direct edits to currentStock
    if ('currentStock' in req.body) {
      res.status(400).json({ 
        success: false, 
        error: 'Cannot update currentStock directly. Please use the stock movement endpoint.' 
      });
      return;
    }

    // We can use the same schema but omit currentStock or just allow the default to pass through and ignore it.
    // A safer way is to strip currentStock, then parse.
    const { currentStock, ...bodyWithoutStock } = req.body;
    
    // Zod will fill currentStock with default 0 if missing, which is fine, we just don't include it in prisma update.
    const parseResult = productSchema.safeParse(bodyWithoutStock);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const data = parseResult.data;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    // Check SKU unique if changing
    if (data.sku !== existingProduct.sku) {
      const skuCheck = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (skuCheck) {
        res.status(400).json({ success: false, error: 'SKU must be unique' });
        return;
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        sku: data.sku,
        category: data.category,
        unitPrice: data.unitPrice,
        minStockAlert: data.minStockAlert,
        location: data.location,
        // intentionally NOT updating currentStock
      }
    });

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// 3. GET /products
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const q = (req.query.q as string) || '';
    const category = req.query.category as string | undefined;
    const lowStock = req.query.lowStock === 'true';

    const whereClause: any = {};
    
    if (q) {
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }
    
    if (category) {
      whereClause.category = category;
    }

    // Since we can't directly compare currentStock <= minStockAlert in standard Prisma where clauses easily without raw query,
    // we actually can using field references in newer Prisma if enabled, or we fetch all and filter? 
    // Wait, the prompt says "where currentStock <= minStockAlert". 
    // Actually, Prisma does not support comparing two columns in standard `where` without preview features (`fieldReferences`). 
    // Let's use Prisma's `where: { currentStock: { lte: prisma.product.fields.minStockAlert } }` ... wait, that requires a preview feature.
    // Another option: if they passed lowStock=true, maybe we should fetch and filter in memory if the dataset is small?
    // Wait, can we do raw query?
    // Let's check if we can just do raw query for just the IDs and then fetch.
    // Or simpler, let's just do a raw query for the whole pagination if lowStock=true, or use `$queryRaw`.
    // Actually, Prisma might support it. Let's see if we can just do it. If not, we'll do raw query.
    // Actually, the simplest approach for "currentStock <= minStockAlert" without `fieldReferences` is just `$queryRaw`.
    // Let's fetch the IDs of low stock products if lowStock is true.
    if (lowStock) {
      const lowStockIds = await prisma.$queryRaw<{id: string}[]>`SELECT id FROM "Product" WHERE "currentStock" <= "minStockAlert"`;
      whereClause.id = { in: lowStockIds.map(row => row.id) };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: products,
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

// 4. GET /products/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { name: true, role: true } }
          }
        }
      }
    });

    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// 5. POST /products/:id/stock-movement
router.post('/:id/stock-movement', requireAuth, requireRole('ADMIN', 'WAREHOUSE'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parseResult = stockMovementSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const { quantityChanged, movementType, reason } = parseResult.data;

    // Use a transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id },
          // Lock row? Not easily natively without raw, but we can rely on isolation if needed.
        });

        if (!product) {
          throw new Error('NOT_FOUND');
        }

        if (movementType === 'OUT' && product.currentStock < quantityChanged) {
          throw new Error('NEGATIVE_STOCK');
        }

        const newStock = movementType === 'IN' 
          ? product.currentStock + quantityChanged 
          : product.currentStock - quantityChanged;

        const updatedProduct = await tx.product.update({
          where: { id },
          data: { currentStock: newStock }
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: id,
            quantityChanged,
            movementType,
            reason: reason || null,
            createdBy: req.user!.id
          },
          include: {
            user: { select: { name: true, role: true } }
          }
        });

        return { product: updatedProduct, movement };
      }, { timeout: 15000 });

      res.status(201).json({ success: true, data: result.movement });
    } catch (txError: any) {
      if (txError.message === 'NOT_FOUND') {
        res.status(404).json({ success: false, error: 'Product not found' });
      } else if (txError.message === 'NEGATIVE_STOCK') {
        res.status(400).json({ success: false, error: 'Cannot process OUT movement: quantity exceeds current stock' });
      } else {
        throw txError;
      }
    }
  } catch (error) {
    next(error);
  }
});

export default router;
