import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, ChallanStatus, MovementType } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import PDFDocument from 'pdfkit';

const router = Router();
const prisma = new PrismaClient();

const createChallanSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  items: z.array(
    z.object({
      productId: z.string().uuid('Valid product ID is required'),
      quantity: z.number().int().positive('Quantity must be positive')
    })
  ).min(1, 'At least one item is required')
});

router.post('/', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createChallanSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const { customerId, items } = parseResult.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ success: false, error: 'One or more products not found' });
      return;
    }

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

        const productIds = challan.challanItems.map(item => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } }
        });

        const productMap = new Map(products.map(p => [p.id, p]));
        const insufficientProducts: string[] = [];

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
          throw new Error(`INSUFFICIENT_STOCK||${JSON.stringify(insufficientProducts)}`);
        }

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
          const productIds = challan.challanItems.map(item => item.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } }
          });
          const productMap = new Map(products.map(p => [p.id, p]));

          for (const item of challan.challanItems) {
            const product = productMap.get(item.productId);
            if (product) {
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

router.get('/:id/pdf', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { id: true, name: true, role: true } },
        challanItems: true,
      },
    });

    if (!challan) {
      res.status(404).json({ success: false, error: 'Challan not found' });
      return;
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${challan.challanNumber}.pdf"`);
    doc.pipe(res);

    const primaryColor = '#5B21B6';
    const lightGray = '#F8FAFC';
    const darkGray = '#1E293B';
    const midGray = '#64748B';

    doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(26).font('Helvetica-Bold').text('INVOICE', 50, 30);
    doc.fontSize(10).font('Helvetica').text('FundsRoom ERP+CRM', 50, 62);
    doc.text('operations@fundsroom.com', 50, 76);

    const headerRightX = doc.page.width - 200;
    doc.fontSize(10).text(`Challan #: ${challan.challanNumber}`, headerRightX, 30, { width: 150, align: 'right' });
    doc.text(`Date: ${new Date(challan.createdAt).toLocaleDateString('en-IN')}`, headerRightX, 46, { width: 150, align: 'right' });
    doc.text(`Status: ${challan.status}`, headerRightX, 62, { width: 150, align: 'right' });
    doc.text(`Created by: ${challan.user?.name ?? '-'}`, headerRightX, 78, { width: 150, align: 'right' });

    doc.fillColor(darkGray);
    let y = 120;

    doc.rect(50, y, doc.page.width - 100, 80).fill(lightGray).stroke('#E2E8F0');
    doc.fillColor(midGray).fontSize(8).font('Helvetica-Bold').text('BILL TO', 65, y + 10);
    doc.fillColor(darkGray).fontSize(12).font('Helvetica-Bold').text(challan.customer?.name ?? '-', 65, y + 24);
    doc.fontSize(10).font('Helvetica').fillColor(midGray);
    if (challan.customer?.businessName) doc.text(challan.customer.businessName, 65, y + 40);
    if (challan.customer?.mobile) doc.text(`Phone: ${challan.customer.mobile}`, 65, y + 54);
    if (challan.customer?.gstNumber) doc.text(`GST: ${challan.customer.gstNumber}`, 65, y + 54 + (challan.customer.businessName ? 14 : 0));

    y += 96;

    const colWidths = [220, 80, 80, 70, 80];
    const colHeaders = ['Product', 'SKU', 'Unit Price', 'Qty', 'Line Total'];
    const colX = [50];
    colWidths.slice(0, -1).forEach((w, i) => colX.push(colX[i] + w));

    doc.rect(50, y, doc.page.width - 100, 24).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    colHeaders.forEach((h, i) => {
      const align = i >= 2 ? 'right' : 'left';
      doc.text(h, colX[i] + 4, y + 8, { width: colWidths[i] - 8, align });
    });

    y += 24;
    let totalAmount = 0;

    challan.challanItems.forEach((item, idx) => {
      const unitPrice = parseFloat(item.unitPriceSnapshot.toString());
      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      const rowBg = idx % 2 === 0 ? '#FFFFFF' : lightGray;
      doc.rect(50, y, doc.page.width - 100, 22).fill(rowBg).stroke('#E2E8F0');
      doc.fillColor(darkGray).fontSize(9).font('Helvetica');

      doc.text(item.productNameSnapshot, colX[0] + 4, y + 6, { width: colWidths[0] - 8 });
      doc.text(item.productSkuSnapshot, colX[1] + 4, y + 6, { width: colWidths[1] - 8, align: 'right' });
      doc.text(`Rs.${unitPrice.toFixed(2)}`, colX[2] + 4, y + 6, { width: colWidths[2] - 8, align: 'right' });
      doc.text(String(item.quantity), colX[3] + 4, y + 6, { width: colWidths[3] - 8, align: 'right' });
      doc.text(`Rs.${lineTotal.toFixed(2)}`, colX[4] + 4, y + 6, { width: colWidths[4] - 8, align: 'right' });
      y += 22;
    });

    doc.rect(50, y, doc.page.width - 100, 28).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
    doc.text('TOTAL', colX[0] + 4, y + 8, { width: colWidths[0] + colWidths[1] + colWidths[2], align: 'left' });
    doc.text(String(challan.totalQuantity), colX[3] + 4, y + 8, { width: colWidths[3] - 8, align: 'right' });
    doc.text(`Rs.${totalAmount.toFixed(2)}`, colX[4] + 4, y + 8, { width: colWidths[4] - 8, align: 'right' });
    y += 40;

    doc.fillColor(midGray).fontSize(8).font('Helvetica').text(
      'Thank you for your business. This is a system-generated document.',
      50, y, { align: 'center', width: doc.page.width - 100 }
    );

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
