import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a file name']
    },
    size: {
        type: String,
        required: [true, 'Please add file size']
    },
    sizeBytes: {
        type: Number,
        required: [true, 'Please add file size in bytes']
    },
    type: {
        type: String,
        required: [true, 'Please add file type']
    },
    url: {
        type: String,
        required: [true, 'Please add file URL']
    },
    cloudinaryId: {
        type: String
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'ownerModel'
    },
    ownerModel: {
        type: String,
        required: true,
        enum: ['User', 'Admin'],
        default: 'User'
    },
    category: {
        type: String,
        enum: ['image', 'pdf', 'document', 'other'],
        default: 'other'
    },
    sharedWith: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'sharedWith.userModel'
        },
        userModel: {
            type: String,
            required: true,
            enum: ['User', 'Admin'],
            default: 'User'
        },
        permission: {
            type: String,
            enum: ['view', 'edit', 'download'],
            default: 'view'
        }
    }],
    accessRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'accessRequests.userModel'
        },
        userModel: {
            type: String,
            required: true,
            enum: ['User', 'Admin'],
            default: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        requestedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isPublic: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const File = mongoose.model('File', fileSchema);
export default File;
