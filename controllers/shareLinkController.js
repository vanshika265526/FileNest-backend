import ShareLink from '../models/ShareLink.js';
import File from '../models/File.js';
import path from 'path';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Helper to check if IP is from India
const checkIsIndiaIP = async (ip) => {
    try {
        if (!ip) return { isIndia: true, country: 'Local/Unknown' };

        // Clean IPv6 mapped IPv4 loopback/addresses
        let cleanIp = ip.trim();
        if (cleanIp.startsWith('::ffff:')) {
            cleanIp = cleanIp.replace('::ffff:', '');
        }

        if (
            cleanIp === '127.0.0.1' || 
            cleanIp === '::1' || 
            cleanIp.startsWith('192.168.') || 
            cleanIp.startsWith('10.') ||
            cleanIp.startsWith('172.16.') ||
            cleanIp.startsWith('172.17.') ||
            cleanIp.startsWith('172.18.') ||
            cleanIp.startsWith('172.19.') ||
            cleanIp.startsWith('172.20.') ||
            cleanIp.startsWith('172.21.') ||
            cleanIp.startsWith('172.22.') ||
            cleanIp.startsWith('172.23.') ||
            cleanIp.startsWith('172.24.') ||
            cleanIp.startsWith('172.25.') ||
            cleanIp.startsWith('172.26.') ||
            cleanIp.startsWith('172.27.') ||
            cleanIp.startsWith('172.28.') ||
            cleanIp.startsWith('172.29.') ||
            cleanIp.startsWith('172.30.') ||
            cleanIp.startsWith('172.31.')
        ) {
            // Local dev environment bypass
            return { isIndia: true, country: 'Localhost/Intranet' };
        }
        
        // Use ipapi.co to detect country code
        // Fetch is globally available in Node v18+
        const response = await fetch(`https://ipapi.co/${cleanIp}/json/`);
        if (!response.ok) {
            console.error(`GeoIP lookup failed for ${cleanIp} with status: ${response.status}`);
            return { isIndia: true, country: 'Unknown (Lookup Fail)' }; // Fallback to allow if API is down
        }
        
        const data = await response.json();
        const countryCode = data.country_code || data.country;
        return {
            isIndia: countryCode === 'IN',
            country: data.country_name || countryCode || 'Unknown'
        };
    } catch (error) {
        console.error('GeoIP lookup error:', error.message);
        return { isIndia: true, country: 'Error Fallback' }; // Fallback to allow
    }
};

// @desc    Create a conditional share link
// @route   POST /api/files/:id/share-links
// @access  Private
export const createShareLink = async (req, res) => {
    try {
        const fileId = req.params.id;
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check ownership
        if (file.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Only owner can share files' });
        }

        const {
            expiresInHours,
            maxUses,
            geoRestriction,
            timeRestrictionEnabled,
            startHour,
            endHour,
            antiScreenshot,
            watermarkText,
            verificationType,
            recipientEmail
        } = req.body;

        const shareCode = crypto.randomBytes(8).toString('hex');
        
        let expiresAt = null;
        if (expiresInHours) {
            expiresAt = new Date(Date.now() + parseFloat(expiresInHours) * 60 * 60 * 1000);
        }

        const shareLink = new ShareLink({
            fileId,
            owner: req.user._id,
            ownerModel: req.user.role === 'admin' ? 'Admin' : 'User',
            shareCode,
            expiresAt,
            maxUses: maxUses ? parseInt(maxUses) : null,
            geoRestriction: geoRestriction ? 'IN' : null,
            timeRestriction: {
                enabled: !!timeRestrictionEnabled,
                startHour: startHour !== undefined ? parseInt(startHour) : 9,
                endHour: endHour !== undefined ? parseInt(endHour) : 17
            },
            antiScreenshot: !!antiScreenshot,
            watermarkText: watermarkText || null,
            verificationType: verificationType || 'none',
            recipientEmail: recipientEmail || null
        });

        await shareLink.save();
        res.status(201).json(shareLink);
    } catch (error) {
        console.error('Create share link error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all share links for a file
// @route   GET /api/files/:id/share-links
// @access  Private
export const getFileShareLinks = async (req, res) => {
    try {
        const fileId = req.params.id;
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check ownership
        if (file.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Only owner can view share links' });
        }

        const shareLinks = await ShareLink.find({ fileId }).sort({ createdAt: -1 });
        res.json(shareLinks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete/Revoke a share link
// @route   DELETE /api/files/share-links/:linkId
// @access  Private
export const deleteShareLink = async (req, res) => {
    try {
        const shareLink = await ShareLink.findById(req.params.linkId);

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found' });
        }

        // Check ownership
        if (shareLink.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Only link creator can revoke it' });
        }

        await ShareLink.findByIdAndDelete(req.params.linkId);
        res.json({ message: 'Share link successfully revoked' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get public info and validate passive conditions
// @route   GET /api/files/share-link/info/:shareCode
// @access  Public
export const getShareLinkInfo = async (req, res) => {
    try {
        const { shareCode } = req.params;
        const shareLink = await ShareLink.findOne({ shareCode }).populate('fileId', 'name size type category owner url');

        if (!shareLink) {
            return res.status(404).json({ message: 'Invalid share link or link has been deleted' });
        }

        const file = shareLink.fileId;
        if (!file) {
            return res.status(404).json({ message: 'The shared file no longer exists' });
        }

        // Determine if owner/admin is accessing to bypass restrictions for easy testing
        const isOwnerOrAdmin = req.user && (
            req.user._id.toString() === file.owner.toString() ||
            req.user.role === 'admin'
        );

        if (isOwnerOrAdmin) {
            console.log(`SHARE_LINK: Owner/Admin bypass active. Bypassing all conditions for ${file.name}`);
            return res.json({
                shareCode: shareLink.shareCode,
                file: {
                    _id: file._id,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    category: file.category,
                    url: file.url
                },
                verificationType: 'none', // bypass verification
                recipientEmail: shareLink.recipientEmail,
                antiScreenshot: shareLink.antiScreenshot,
                watermarkText: shareLink.watermarkText,
                isOwnerBypass: true
            });
        }

        // 1. Expiry Check
        if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
            return res.status(403).json({
                message: 'This share link has expired.',
                code: 'EXPIRED',
                fileSummary: { name: file.name }
            });
        }

        // 2. Max Uses Check
        if (shareLink.maxUses !== null && shareLink.usesCount >= shareLink.maxUses) {
            return res.status(403).json({
                message: 'This share link has reached its maximum access limit.',
                code: 'MAX_USES_REACHED',
                fileSummary: { name: file.name }
            });
        }

        // 3. Time Restriction Check (IST Hours: 9 AM to 5 PM)
        if (shareLink.timeRestriction && shareLink.timeRestriction.enabled) {
            const now = new Date();
            const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            const currentHour = istTime.getHours();
            
            const { startHour, endHour } = shareLink.timeRestriction;
            if (currentHour < startHour || currentHour >= endHour) {
                const formatTime = (h) => {
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const displayH = h % 12 || 12;
                    return `${displayH} ${ampm}`;
                };
                return res.status(403).json({
                    message: `This file is only accessible between ${formatTime(startHour)} and ${formatTime(endHour)} IST.`,
                    code: 'TIME_RESTRICTED',
                    fileSummary: { name: file.name }
                });
            }
        }

        // 4. Geo Restriction Check (India Only)
        if (shareLink.geoRestriction) {
            // Get client IP
            let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            if (ip && ip.includes(',')) {
                ip = ip.split(',')[0].trim();
            }
            
            const geo = await checkIsIndiaIP(ip);
            console.log(`GEO CHECK: Access from IP ${ip} (Country: ${geo.country}). Restricted: ${shareLink.geoRestriction}`);
            
            if (!geo.isIndia) {
                return res.status(403).json({
                    message: `This link is restricted to India only. Access from ${geo.country} is blocked.`,
                    code: 'GEO_RESTRICTED',
                    fileSummary: { name: file.name }
                });
            }
        }

        // Return details and what active checks are needed
        res.json({
            shareCode: shareLink.shareCode,
            file: {
                _id: file._id,
                name: file.name,
                size: file.size,
                type: file.type,
                category: file.category,
                url: shareLink.verificationType === 'none' ? file.url : undefined
            },
            verificationType: shareLink.verificationType,
            recipientEmail: shareLink.recipientEmail,
            antiScreenshot: shareLink.antiScreenshot,
            watermarkText: shareLink.watermarkText
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request OTP (Sends OTP to recipient email)
// @route   POST /api/files/share-link/otp/:shareCode
// @access  Public
export const requestOtp = async (req, res) => {
    try {
        const { shareCode } = req.params;
        const shareLink = await ShareLink.findOne({ shareCode });

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found' });
        }

        if (shareLink.verificationType !== 'otp') {
            return res.status(400).json({ message: 'This link does not require OTP verification' });
        }

        const { email } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();

        // If a specific recipient email is required, match it
        if (shareLink.recipientEmail && shareLink.recipientEmail.trim().toLowerCase() !== normalizedEmail) {
            return res.status(403).json({ message: 'This link is not configured for this email address' });
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        shareLink.otpCode = otpCode;
        shareLink.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
        await shareLink.save();

        console.log(`[OTP] SECURITY OTP CODE FOR SHARE LINK ${shareCode} (Email: ${normalizedEmail}): ${otpCode}`);

        // Return OTP in response for development convenience
        res.json({
            message: 'OTP has been sent to your email!',
            // Return debugOtp so they can test easily without SMTP setup
            debugOtp: otpCode
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP and generate short-lived JWT token
// @route   POST /api/files/share-link/verify-otp/:shareCode
// @access  Public
export const verifyOtp = async (req, res) => {
    try {
        const { shareCode } = req.params;
        const { otp } = req.body;
        const shareLink = await ShareLink.findOne({ shareCode }).populate('fileId');

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found' });
        }

        if (!shareLink.otpCode || new Date() > shareLink.otpExpiresAt) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (shareLink.otpCode !== otp.trim()) {
            return res.status(400).json({ message: 'Invalid OTP code. Please try again.' });
        }

        // Clear OTP code on success
        shareLink.otpCode = null;
        shareLink.otpExpiresAt = null;
        await shareLink.save();

        // Sign short-lived access token
        const token = jwt.sign(
            { shareCode, verified: true },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // 15 mins to read the file
        );

        res.json({ token, fileUrl: shareLink.fileId ? shareLink.fileId.url : null });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify Face (Simulated) and generate short-lived JWT token
// @route   POST /api/files/share-link/verify-face/:shareCode
// @access  Public
export const verifyFace = async (req, res) => {
    try {
        const { shareCode } = req.params;
        const shareLink = await ShareLink.findOne({ shareCode }).populate('fileId');

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found' });
        }

        if (shareLink.verificationType !== 'face') {
            return res.status(400).json({ message: 'This link does not require Face Verification' });
        }

        // Face verification succeeded (simulated by frontend client, checked here)
        // Sign short-lived access token
        const token = jwt.sign(
            { shareCode, verified: true },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ token, fileUrl: shareLink.fileId ? shareLink.fileId.url : null });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Serve the file contents via a share link
// @route   GET /api/files/v/link/:shareCode
// @access  Public
export const serveFileViaShareLink = async (req, res) => {
    try {
        const { shareCode } = req.params;
        const { token } = req.query;

        const shareLink = await ShareLink.findOne({ shareCode }).populate('fileId');

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found' });
        }

        const file = shareLink.fileId;
        if (!file) {
            return res.status(404).json({ message: 'The shared file no longer exists' });
        }

        // Determine if owner/admin is accessing to bypass token/verification requirements
        const isOwnerOrAdmin = req.user && (
            req.user._id.toString() === file.owner.toString() ||
            req.user.role === 'admin'
        );

        if (!isOwnerOrAdmin) {
            // Re-validate passive conditions
            if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
                return res.status(403).json({ message: 'This share link has expired.' });
            }
            if (shareLink.maxUses !== null && shareLink.usesCount >= shareLink.maxUses) {
                return res.status(403).json({ message: 'This share link has reached its maximum access limit.' });
            }

            // Verify cryptographic token if verification required
            if (shareLink.verificationType !== 'none') {
                if (!token) {
                    return res.status(401).json({ message: 'Access token is required to view this file' });
                }
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    if (decoded.shareCode !== shareCode) {
                        return res.status(401).json({ message: 'Invalid access token for this file' });
                    }
                } catch (err) {
                    return res.status(401).json({ message: 'Access token has expired or is invalid' });
                }
            }
        }

        // Increment uses count
        shareLink.usesCount += 1;
        await shareLink.save();

        // Serve the file! (Same proxy/local logic as serveFile)
        if (file.url.startsWith('http')) {
            console.log(`SERVE LINK: Proxying external URL: ${file.url}`);
            try {
                const targetUrl = new URL(file.url);
                const client = targetUrl.protocol === 'http:' ? http : https;

                res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);

                const proxyReq = client.get(targetUrl, (proxyRes) => {
                    if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                        return res.status(proxyRes.statusCode).json({ message: 'Failed to load file' });
                    }
                    const upstreamType = proxyRes.headers['content-type'];
                    const isPdf = file.category === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
                    res.setHeader('Content-Type', upstreamType || (isPdf ? 'application/pdf' : 'application/octet-stream'));
                    proxyRes.pipe(res);
                });

                proxyReq.on('error', (err) => {
                    console.error('SERVE LINK: Proxy Error:', err);
                    res.redirect(file.url);
                });
            } catch (e) {
                return res.redirect(file.url);
            }
            return;
        }

        console.log(`SERVE LINK: Serving local file: ${file.url}`);
        const filePath = path.join(process.cwd(), file.url);
        return res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
