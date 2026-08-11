import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, MovementType } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

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

router.post('/', requireAuth, requireRole('ADMIN', 'WAREHOUSE'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = productSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const data = parseResult.data;

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

router.put('/:id', requireAuth, requireRole('ADMIN', 'WAREHOUSE'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    if ('currentStock' in req.body) {
      res.status(400).json({
        success: false,
        error: 'Cannot update currentStock directly. Please use the stock movement endpoint.'
      });
      return;
    }

    const { currentStock, ...bodyWithoutStock } = req.body;

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
      }
    });

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

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

router.post('/:id/stock-movement', requireAuth, requireRole('ADMIN', 'WAREHOUSE'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parseResult = stockMovementSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const { quantityChanged, movementType, reason } = parseResult.data;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id } });

        if (!product) {
          throw new Error('NOT_FOUND');
        }

        if (movementType === 'OUT' && product.currentStock < quantityChanged) {
          throw new Error('NEGATIVE_STOCK');
        }

        const newStock = movementType === 'IN'
          ? product.currentStock + quantityChanged
          : product.currentStock - quantityChanged;

        await tx.product.update({
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

        return movement;
      }, { timeout: 15000 });

      res.status(201).json({ success: true, data: result });
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

const s3Configured = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME
);

let s3Client: S3Client | null = null;
if (s3Configured) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

router.post(
  '/:id/image',
  requireAuth,
  requireRole('ADMIN', 'WAREHOUSE'),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file provided' });
        return;
      }

      if (!s3Configured || !s3Client) {
        res.status(503).json({
          success: false,
          error: 'S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME.',
        });
        return;
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const key = `products/${id}/${crypto.randomUUID()}${ext}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

      if (product.imageUrl) {
        try {
          const oldKey = product.imageUrl.split('.amazonaws.com/')[1];
          if (oldKey) {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME!,
                Key: oldKey,
              })
            );
          }
        } catch {
        }
      }

      const updated = await prisma.product.update({
        where: { id },
        data: { imageUrl },
      });

      res.json({ success: true, data: { imageUrl: updated.imageUrl } });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id/image',
  requireAuth,
  requireRole('ADMIN', 'WAREHOUSE'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      if (product.imageUrl && s3Client) {
        try {
          const oldKey = product.imageUrl.split('.amazonaws.com/')[1];
          if (oldKey) {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: oldKey })
            );
          }
        } catch {}
      }

      await prisma.product.update({ where: { id }, data: { imageUrl: null } });
      res.json({ success: true, data: { message: 'Image removed' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
