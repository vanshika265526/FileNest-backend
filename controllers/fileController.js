import path from 'path';
import File from '../models/File.js';
import User from '../models/User.js';
import { upload, deleteFileFromStorage, isCloudinary } from '../utils/storage.js';
import https from 'https';
import http from 'http';

// @desc    Upload a file
// @route   POST /api/files/upload
// @access  Private
export const uploadFile = async (req, res) => {
    try {
        if (!req.user) {
            console.error('UPLOAD ERROR: No user context');
            return res.status(401).json({ message: 'Authentication required' });
        }

        console.log('--- UPLOAD ATTEMPT ---');
        console.log('User:', req.user._id);
        console.log('File Keys:', req.file ? Object.keys(req.file) : 'NONE');
        
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { originalname, size, mimetype, filename, path: cloudPath, secure_url, public_id, url: directUrl } = req.file;
        const effectiveSize = size || 0;
        console.log('Upload Stats:', { effectiveSize, originalname, mimetype });
        
        // Multer-cloudinary usually puts folder/id in 'filename' or 'public_id'
        const effectiveCloudinaryId = public_id || filename || req.file.id;
        console.log('Detected Cloudinary ID:', effectiveCloudinaryId);

        // Robust URL detection
        let fileUrl;
        const currentStorageType = (process.env.STORAGE_TYPE || 'local').trim().toLowerCase();

        if (currentStorageType === 'cloudinary' || isCloudinary) {
            // Collect all potential URL candidates from Cloudinary/multer
            const candidates = [
                secure_url,
                directUrl,
                cloudPath,
                req.file?.url,
                req.file?.path
            ].filter(Boolean);

            // Prefer absolute HTTPS URLs if available
            const absoluteCandidate = candidates.find(u => typeof u === 'string' && u.startsWith('http'));

            fileUrl = absoluteCandidate || candidates[0];

            console.log('Using Cloudinary URL candidate:', {
                chosen: fileUrl,
                candidates,
            });
        } else {
            // For local storage always expose a predictable, public path
            fileUrl = `/uploads/${filename}`;
        }

        // Determine category
        let category = 'other';
        const lowerName = (originalname || '').toLowerCase();
        const lowerMime = (mimetype || '').toLowerCase();

        if (lowerMime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(lowerName)) {
            category = 'image';
        } else if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
            category = 'pdf';
        } else if (
            lowerMime.startsWith('text/') ||
            lowerMime.includes('document') ||
            /\.(docx?|pptx?|xlsx?)$/.test(lowerName)
        ) {
            category = 'document';
        }

        const file = await File.create({
            name: originalname,
            size: (effectiveSize / (1024 * 1024)).toFixed(2) + ' MB',
            sizeBytes: effectiveSize,
            type: mimetype.split('/')[1] || 'unknown',
            url: fileUrl,
            cloudinaryId: effectiveCloudinaryId,
            owner: req.user._id,
            ownerModel: req.user.role === 'admin' ? 'Admin' : 'User',
            category
        });

        res.status(201).json(file);
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user files
// @route   GET /api/files
// @access  Private
export const getFiles = async (req, res) => {
    try {
        if (!req.user) {
            console.error('getFiles ERROR: No user context');
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Find files owned by user OR shared with user
        const files = await File.find({
            $or: [
                { owner: req.user._id },
                { "sharedWith.user": req.user._id }
            ]
        })
        .populate('owner', 'fullName email')
        .populate('sharedWith.user', 'fullName email')
        .sort({ createdAt: -1 });
        
        res.json(files);
    } catch (error) {
        console.error('getFiles CRASH:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a file
// @route   DELETE /api/files/:id
// @access  Private
export const deleteFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check ownership or edit permission
        const isOwner = file.owner.toString() === req.user._id.toString();
        const sharedMember = file.sharedWith.find(s => s.user.toString() === req.user._id.toString());
        const canEdit = sharedMember && sharedMember.permission === 'edit';

        if (!isOwner && !canEdit) {
            return res.status(401).json({ message: 'Only owner or editors can remove files' });
        }

        // Remove from storage (S3 or Local or Cloudinary)
        await deleteFileFromStorage(file.url, file.cloudinaryId);

        await file.deleteOne();
        res.json({ message: 'File removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Share file with user
// @route   POST /api/files/:id/share
// @access  Private
export const shareFile = async (req, res) => {
    try {
        const { email, permission = 'view' } = req.body;
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check ownership
        if (file.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Only owner can share files' });
        }

        const normalizedEmail = (email || '').trim().toLowerCase();
        let userToShare = await User.findOne({ email: normalizedEmail });
        let userModel = 'User';

        if (!userToShare) {
            userToShare = await Admin.findOne({ email: normalizedEmail });
            userModel = 'Admin';
        }

        if (!userToShare) {
            return res.status(404).json({ message: 'User or Admin not found' });
        }

        // Check if already shared
        const existingShare = file.sharedWith.find(s => {
            const currentUserId = s.user ? (s.user._id || s.user).toString() : s.toString();
            return currentUserId === userToShare._id.toString();
        });
        if (existingShare) {
            return res.status(400).json({ message: 'File already shared with this user' });
        }

        // Check if sharing with self
        if (userToShare._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot share a file with yourself' });
        }

        file.sharedWith.push({ 
            user: userToShare._id, 
            userModel, 
            permission 
        });
        await file.save();

        const updatedFile = await File.findById(file._id)
            .populate('owner', 'fullName email')
            .populate('sharedWith.user', 'fullName email');

        res.json(updatedFile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update shared permission
// @route   PUT /api/files/:id/permission
// @access  Private
export const updateSharedPermission = async (req, res) => {
    try {
        const { userId, permission } = req.body;
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check ownership
        if (file.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Only owner can change permissions' });
        }

        const shareIndex = file.sharedWith.findIndex(s => {
            const currentUserId = s.user ? (s.user._id || s.user).toString() : s.toString();
            return currentUserId === userId;
        });

        if (shareIndex === -1) {
            return res.status(404).json({ message: 'User not found in share list' });
        }

        if (permission === 'remove') {
            file.sharedWith.splice(shareIndex, 1);
        } else {
            file.sharedWith[shareIndex].permission = permission;
        }

        await file.save();

        const updatedFile = await File.findById(file._id)
            .populate('owner', 'fullName email')
            .populate('sharedWith.user', 'fullName email');

        res.json(updatedFile);
    } catch (error) {
        console.error('Permission Update Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle public access
// @route   POST /api/files/:id/public
// @access  Private
export const togglePublicAccess = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check ownership
        if (file.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Only owner can change public access' });
        }

        file.isPublic = !file.isPublic;
        await file.save();

        res.json(file);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Serve file based on permissions
// @route   GET /api/files/v/:id
// @access  Public (Permission checked internally)
export const serveFile = async (req, res) => {
    try {
        console.log(`SERVE: Request for file ID: ${req.params.id}`);
        const file = await File.findById(req.params.id);

        if (!file) {
            console.log('SERVE: File not found in DB');
            return res.status(404).json({ message: 'File not found' });
        }

        // Check if user is authenticated
        // optionalProtect populates req.user if token is valid
        if (!req.user && !file.isPublic) {
            console.log('SERVE: Not authorized (No user and not public)');
            return res.status(401).json({ message: 'Not authorized to view this file' });
        }

        const isOwner = req.user && file.owner.toString() === req.user._id.toString();
        const sharedMember = req.user && file.sharedWith.find(s => s.user.toString() === req.user._id.toString());
        const isAdmin = req.user && req.user.role === 'admin';

        if (file.isPublic || isOwner || sharedMember || isAdmin) {
            console.log(`SERVE: Authorization successful (Public: ${file.isPublic}, Owner: ${isOwner}, Shared: ${!!sharedMember}, Admin: ${isAdmin})`);
            
            if (file.url.startsWith('http')) {
                console.log(`SERVE: Proxying external URL: ${file.url}`);

                try {
                    const targetUrl = new URL(file.url);
                    const client = targetUrl.protocol === 'http:' ? http : https;

                    // Always hint browser to render inline, especially for PDFs
                    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);

                    const proxyReq = client.get(targetUrl, (proxyRes) => {
                        if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                            console.error('SERVE: Upstream responded with error status:', proxyRes.statusCode);
                            return res.status(proxyRes.statusCode).json({
                                message: 'Failed to load file from storage provider'
                            });
                        }

                        // Prefer upstream content type, but ensure PDFs are labeled correctly
                        const upstreamType = proxyRes.headers['content-type'];
                        const isPdf = file.category === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
                        res.setHeader('Content-Type', upstreamType || (isPdf ? 'application/pdf' : 'application/octet-stream'));

                        proxyRes.pipe(res);
                    });

                    proxyReq.on('error', (err) => {
                        console.error('SERVE: Proxy Error:', err);
                        // Fallback to direct redirect if proxy fails
                        res.redirect(file.url);
                    });
                } catch (e) {
                    console.error('SERVE: Invalid external URL, redirecting instead:', e.message);
                    return res.redirect(file.url);
                }

                return;
            }

            console.log(`SERVE: Serving local file: ${file.url}`);
            const filePath = path.join(process.cwd(), file.url);
            return res.sendFile(filePath);
        }

        console.log('SERVE: Authorization failed (Not owner/shared/public)');
        res.status(401).json({ message: 'Not authorized' });
    } catch (error) {
        console.error('SERVE: Critical Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check sharing access for a file
// @route   GET /api/files/shared/:id
// @access  Private
export const checkSharedAccess = async (req, res) => {
    try {
        const file = await File.findById(req.params.id)
            .populate('owner', 'fullName email');

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // 1. Is user the owner?
        if (file.owner._id.toString() === req.user._id.toString()) {
            return res.json({ hasAccess: true, file, role: 'owner' });
        }

        // 2. Is file public?
        if (file.isPublic) {
            return res.json({ hasAccess: true, file, role: 'public' });
        }

        // 3. Is user in the share list?
        const share = file.sharedWith.find(s => 
            (s.user._id || s.user).toString() === req.user._id.toString()
        );
        if (share) {
            return res.json({ hasAccess: true, file, role: share.permission });
        }

        // 4. Is user an admin? (Master access)
        if (req.user.role === 'admin') {
            return res.json({ hasAccess: true, file, role: 'admin' });
        }

        // 5. Default: No access, but show basic info and request status
        const request = file.accessRequests.find(r => 
            r.user.toString() === req.user._id.toString()
        );

        res.status(403).json({
            message: 'You do not have access to this file',
            requiresRequest: true,
            fileSummary: {
                name: file.name,
                owner: file.owner,
                category: file.category
            },
            requestStatus: request ? request.status : null
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request access to a file
// @route   POST /api/files/:id/request-access
// @access  Private
export const requestAccess = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found' });

        // Check if already requested
        const existingRequest = file.accessRequests.find(r => 
            r.user.toString() === req.user._id.toString()
        );

        if (existingRequest) {
            return res.status(400).json({ message: 'Request already sent' });
        }

        file.accessRequests.push({ 
            user: req.user._id,
            userModel: req.user.role === 'admin' ? 'Admin' : 'User'
        });
        await file.save();

        res.status(201).json({ message: 'Access request sent' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get pending access requests for own files
// @route   GET /api/files/requests
// @access  Private
export const getPendingRequests = async (req, res) => {
    try {
        if (!req.user) {
            console.error('PENDING REQUESTS ERROR: No user context');
            return res.status(401).json({ message: 'Authentication required' });
        }
        const filesWithRequests = await File.find({
            owner: req.user._id,
            'accessRequests.status': 'pending'
        })
        .populate('accessRequests.user', 'fullName email')
        .select('name accessRequests');

        // Flatten for frontend
        const requests = [];
        filesWithRequests.forEach(file => {
            file.accessRequests.filter(r => r.status === 'pending').forEach(request => {
                requests.push({
                    _id: request._id,
                    fileId: file._id,
                    fileName: file.name,
                    user: request.user,
                    requestedAt: request.requestedAt
                });
            });
        });

        res.json(requests);
    } catch (error) {
        console.error('getPendingRequests CRASH:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Respond to access request
// @route   POST /api/files/:id/respond-request
// @access  Private
export const respondToRequest = async (req, res) => {
    try {
        const { requestId, action } = req.body; // action: 'approve' or 'reject'
        const file = await File.findById(req.params.id);

        if (!file) return res.status(404).json({ message: 'File not found' });
        if (file.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const request = file.accessRequests.id(requestId);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        if (action === 'approve') {
            request.status = 'approved';
            // Add user to shared list
            file.sharedWith.push({ user: request.user, permission: 'view' });
        } else {
            request.status = 'rejected';
        }

        await file.save();
        res.json({ message: `Request ${action}ed successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


