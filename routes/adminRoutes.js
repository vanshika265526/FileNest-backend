import express from 'express';
import { getAllFiles, deleteFile, getSystemStats, getAllUsers, deleteUser } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/files', protect, admin, getAllFiles);
router.delete('/files/:id', protect, admin, deleteFile);
router.get('/stats', protect, admin, getSystemStats);
router.get('/users', protect, admin, getAllUsers);
router.delete('/users/:id', protect, admin, deleteUser);

export default router;
