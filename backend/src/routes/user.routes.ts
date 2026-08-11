import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.nativeEnum(Role),
});

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  role: z.nativeEnum(Role),
  password: z.string().min(6).optional().or(z.literal('')),
});

router.get('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const { name, email, password, role } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parseResult.error.issues });
      return;
    }

    const { name, email, role, password } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (email !== existing.email) {
      const emailCheck = await prisma.user.findUnique({ where: { email } });
      if (emailCheck) {
        res.status(400).json({ success: false, error: 'Email already in use' });
        return;
      }
    }

    const updateData: any = { name, email, role };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (id === req.user!.id) {
      res.status(400).json({ success: false, error: 'Cannot delete your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, data: { message: 'User deleted successfully' } });
  } catch (error) {
    next(error);
  }
});

export default router;
