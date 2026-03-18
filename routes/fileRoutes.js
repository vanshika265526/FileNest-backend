import express from 'express';
import { 
    uploadFile, 
    getFiles, 
    deleteFile, 
    shareFile, 
    togglePublicAccess, 
    serveFile,
    updateSharedPermission,
    checkSharedAccess,
    requestAccess,
    getPendingRequests,
    respondToRequest
} from '../controllers/fileController.js';
import { upload } from '../utils/storage.js';
import { protect, optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for shared/public files (checked internally)
router.get('/v/:id', optionalProtect, serveFile);

router.use(protect); // All other file routes protected

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', getFiles);
router.delete('/:id', deleteFile);
router.post('/:id/share', shareFile);
router.post('/:id/public', togglePublicAccess);
router.put('/:id/permission', updateSharedPermission);

// Share Requests Workflow
router.get('/requests', getPendingRequests); // MUST be above /:id routes
router.get('/shared/:id', checkSharedAccess);
router.post('/:id/request-access', requestAccess);
router.post('/:id/respond-request', respondToRequest);

export default router;
