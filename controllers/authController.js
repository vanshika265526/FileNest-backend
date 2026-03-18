import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

// Generate Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();
        console.log(`Registration attempt for: ${normalizedEmail}, role: ${role}`);

        if (!fullName || !normalizedEmail || !password) {
            return res.status(400).json({ message: 'Please add all fields' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email: normalizedEmail });

        if (userExists) {
            console.log(`User already exists: ${normalizedEmail}`);
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            fullName,
            email: normalizedEmail,
            password,
            role: role || 'user'
        });

        if (user) {
            console.log(`User created successfully: ${user.email}, role: ${user.role}`);
            res.status(201).json({
                _id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                token: generateToken(user._id)
            });
        } else {
            console.log('Invalid user data received');
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();
        console.log(`Login attempt for: ${normalizedEmail}`);

        // Check for user email
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            console.log(`User not found: ${normalizedEmail}`);
        }

        if (user && (await user.matchPassword(password))) {
            const userRole = user.role || 'user';
            console.log(`Login successful: ${user.email}, role: ${userRole}`);
            res.json({
                _id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: userRole,
                token: generateToken(user._id)
            });
        } else {
            console.log(`Login failed for: ${normalizedEmail} - ${user ? 'Incorrect Password' : 'User Not Found'}`);
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: error.message });
    }
};
// @desc    Authenticate an admin
// @route   POST /api/auth/admin-login
// @access  Public
export const loginAdmin = async (req, res) => {
    try {
        const { email, password, securityKey } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();
        console.log(`Admin login attempt for: ${normalizedEmail}`);

        // Handle the master admin specifically as requested by user
        if (normalizedEmail === 'vanshika2976910b@gmail.com' && password === '123') {
            // Check if this admin exists in DB, if not create or just return success if it's a "super" bypass
            let admin = await Admin.findOne({ email: normalizedEmail });
            if (!admin) {
                // Auto-create the master admin if it doesn't exist? 
                // Or I can just trust the seed script.
                // For now, let's assume it MUST exist in DB.
                admin = await Admin.create({
                    fullName: 'Master Admin',
                    email: normalizedEmail,
                    password: '123', // Admin model hashes this on save
                    securityKey: '123'
                });
            }

            console.log(`Master Admin login successful: ${admin.email}`);
            return res.json({
                _id: admin.id,
                fullName: admin.fullName,
                email: admin.email,
                role: 'admin',
                token: generateToken(admin._id)
            });
        }

        // Regular admin login logic
        const admin = await Admin.findOne({ email: normalizedEmail });
        if (admin && (await admin.matchPassword(password)) && admin.securityKey === securityKey) {
            console.log(`Admin login successful: ${admin.email}`);
            res.json({
                _id: admin.id,
                fullName: admin.fullName,
                email: admin.email,
                role: 'admin',
                token: generateToken(admin._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid admin credentials or security key' });
        }
    } catch (error) {
        console.error('Admin Login error:', error.message);
        res.status(500).json({ message: error.message });
    }
};
