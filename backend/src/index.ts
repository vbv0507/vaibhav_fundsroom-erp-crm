import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import challanRoutes from './routes/challan.routes';

const app = express();
const port = process.env.PORT || 3000;

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/challans', challanRoutes);

// Standard API response shape
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Health check route
app.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: { message: 'Server is healthy' }
  };
  res.status(200).json(response);
});

// Centralized error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  const response: ApiResponse = {
    success: false,
    error: err.message || 'Internal Server Error',
  };
  res.status(500).json(response);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
