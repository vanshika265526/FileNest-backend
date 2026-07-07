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
import {
    createShareLink,
    getFileShareLinks,
    deleteShareLink,
    getShareLinkInfo,
    requestOtp,
    verifyOtp,
    verifyFace,
    serveFileViaShareLink
} from '../controllers/shareLinkController.js';
import { upload } from '../utils/storage.js';
import { protect, optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for conditional share links (with optional user context for owner bypass)
router.get('/share-code/info/:shareCode', optionalProtect, getShareLinkInfo);
router.post('/share-code/otp/:shareCode', requestOtp);
router.post('/share-code/verify-otp/:shareCode', verifyOtp);
router.post('/share-code/verify-face/:shareCode', verifyFace);
router.get('/v/link/:shareCode', optionalProtect, serveFileViaShareLink);

// Public route for shared/public files (checked internally)
router.get('/v/:id', optionalProtect, serveFile);

// All other file routes require protect middleware
router.use(protect);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', getFiles);
router.delete('/:id', deleteFile);
router.post('/:id/share', shareFile);
router.post('/:id/public', togglePublicAccess);
router.put('/:id/permission', updateSharedPermission);

// Conditional Share Links management (Protected)
router.post('/:id/share-links', createShareLink);
router.get('/:id/share-links', getFileShareLinks);
router.delete('/share-links/:linkId', deleteShareLink);

// Share Requests Workflow
router.get('/requests', getPendingRequests); // MUST be above /:id routes
router.get('/shared/:id', checkSharedAccess);
router.post('/:id/request-access', requestAccess);
router.post('/:id/respond-request', respondToRequest);

export default router;
