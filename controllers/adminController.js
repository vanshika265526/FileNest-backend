import File from '../models/File.js';
import User from '../models/User.js';
import { deleteFileFromStorage } from '../utils/storage.js';

// @desc    Get all files in the system
// @route   GET /api/admin/files
// @access  Private/Admin
export const getAllFiles = async (req, res) => {
    try {
        const files = await File.find({}).populate('owner', 'fullName email');
        res.json(files);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete any file
// @route   DELETE /api/admin/files/:id
// @access  Private/Admin
export const deleteFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (file) {
            // Remove from storage (S3 or Local or Cloudinary)
            await deleteFileFromStorage(file.url, file.cloudinaryId);
            await file.deleteOne();
            res.json({ message: 'File removed' });
        } else {
            res.status(404).json({ message: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
        const allFiles = await File.find({});
        const totalBytes = allFiles.reduce((acc, file) => acc + (file.sizeBytes || 0), 0);
        
        // Format storage
        let totalStorage = '0 B';
        if (totalBytes > 0) {
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(totalBytes) / Math.log(k));
            totalStorage = parseFloat((totalBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        res.json({
            totalUsers,
            totalFiles: allFiles.length,
            totalStorage
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } }).select('-password').lean();
        
        // Add sharing stats
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const sharedFilesCount = await File.countDocuments({
                owner: user._id,
                $or: [
                    { isPublic: true },
                    { 'sharedWith.0': { $exists: true } }
                ]
            });
            return {
                ...user,
                sharedFilesCount
            };
        }));

        res.json(usersWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userId = user._id;

        // 1. Delete all files owned by this user (from storage + DB)
        const ownedFiles = await File.find({ owner: userId });
        for (const file of ownedFiles) {
            await deleteFileFromStorage(file.url, file.cloudinaryId);
            await file.deleteOne();
        }

        // 2. Remove this user from sharedWith on any files they had access to
        await File.updateMany(
            { 'sharedWith.user': userId },
            { $pull: { sharedWith: { user: userId } } }
        );

        // 3. Remove any access requests made by this user
        await File.updateMany(
            { 'accessRequests.user': userId },
            { $pull: { accessRequests: { user: userId } } }
        );

        // 4. Delete the user
        await user.deleteOne();

        res.json({ message: 'User and all associated file data removed successfully' });
    } catch (error) {
        console.error('deleteUser error:', error.message);
        res.status(500).json({ message: error.message });
    }
};
