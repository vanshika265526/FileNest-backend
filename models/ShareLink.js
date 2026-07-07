import mongoose from 'mongoose';

const shareLinkSchema = new mongoose.Schema({
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: true
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
    shareCode: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        default: null
    },
    maxUses: {
        type: Number,
        default: null // null means unlimited
    },
    usesCount: {
        type: Number,
        default: 0
    },
    geoRestriction: {
        type: String, // e.g., 'IN' (India)
        default: null
    },
    timeRestriction: {
        enabled: { type: Boolean, default: false },
        startHour: { type: Number, default: 9 }, // 9 AM
        endHour: { type: Number, default: 17 } // 5 PM
    },
    antiScreenshot: {
        type: Boolean,
        default: false
    },
    watermarkText: {
        type: String, // Can be recipient email or custom text
        default: null
    },
    verificationType: {
        type: String,
        enum: ['none', 'otp', 'face'],
        default: 'none'
    },
    recipientEmail: {
        type: String,
        default: null
    },
    otpCode: {
        type: String,
        default: null
    },
    otpExpiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const ShareLink = mongoose.model('ShareLink', shareLinkSchema);
export default ShareLink;
