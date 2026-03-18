import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

export const protect = async (req, res, next) => {
    let token;

    console.log(`AUTH: Checking protect - Header: ${req.headers.authorization ? 'YES' : 'NO'}, Query Token: ${req.query.token ? 'YES' : 'NO'}`);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        console.log('AUTH: Token found');
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('AUTH: Token verified for ID:', decoded.id);

            // Get user from token - check User first, then Admin
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                req.user = await Admin.findById(decoded.id).select('-password');
            }

            if (!req.user) {
                return res.status(401).json({ message: 'User or Admin no longer exists' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const optionalProtect = async (req, res, next) => {
    let token;

    console.log(`AUTH: Checking optionalProtect - Header: ${req.headers.authorization ? 'YES' : 'NO'}, Query Token: ${req.query.token ? 'YES' : 'NO'}`);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        console.log('AUTH_OPT: Token found');
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('AUTH_OPT: Token verified for ID:', decoded.id);
            
            // Try User then Admin
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                req.user = await Admin.findById(decoded.id).select('-password');
            }

            if (req.user) {
                console.log('AUTH_OPT: Identity found:', req.user.email, 'Role:', req.user.role || 'user');
                next();
            } else {
                console.log('AUTH_OPT: User NOT found in DB');
                next();
            }
        } catch (error) {
            console.error('AUTH_OPT: Token verification failed:', error.message);
            next();
        }
    } else {
        console.log('AUTH_OPT: No token provided');
        next();
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};
