import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, CustomerType, CustomerStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Zod Schemas
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid mobile number format'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  businessName: z.string().min(1, 'Business name is required'),
  gstNumber: z.string().optional(),
  customerType: z.nativeEnum(CustomerType),
  address: z.string().min(1, 'Address is required'),
  status: z.nativeEnum(CustomerStatus).default('LEAD'),
  followUpDate: z.string().datetime().optional().or(z.literal('')),
});

const noteSchema = z.object({
  text: z.string().min(1, 'Note text cannot be empty'),
});

// 1. POST /customers - Create a customer
router.post('/', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const data = parseResult.data;
    
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        businessName: data.businessName,
        gstNumber: data.gstNumber || null,
        customerType: data.customerType,
        address: data.address,
        status: data.status,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      }
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// 2. GET /customers - List customers with pagination, search, filter
router.get('/', requireAuth, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const q = (req.query.q as string) || '';
    const status = req.query.status as CustomerStatus | undefined;
    const type = req.query.type as CustomerType | undefined;

    const whereClause: any = {};
    
    if (q) {
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q } },
        { businessName: { contains: q, mode: 'insensitive' } }
      ];
    }
    if (status) whereClause.status = status;
    if (type) whereClause.customerType = type;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customer.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: customers,
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

// 3. GET /customers/:id - Full detail view
router.get('/:id', requireAuth, requireRole('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, role: true } }
          }
        }
      }
    });

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// 4. PUT /customers/:id - Edit customer
router.put('/:id', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const data = parseResult.data;

    // Verify exists first to return 404 cleanly
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        businessName: data.businessName,
        gstNumber: data.gstNumber || null,
        customerType: data.customerType,
        address: data.address,
        status: data.status,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      }
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// 5. POST /customers/:id/notes - Add a note
router.post('/:id/notes', requireAuth, requireRole('ADMIN', 'SALES'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parseResult = noteSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const note = await prisma.customerNote.create({
      data: {
        text: parseResult.data.text,
        customerId: id,
        createdBy: req.user!.id,
      },
      include: {
        user: { select: { name: true, role: true } }
      }
    });

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
});

export default router;
