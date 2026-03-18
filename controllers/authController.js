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

        // Find admin in the Admin collection
        let admin = await Admin.findOne({ email: normalizedEmail });

        // Master admin: auto-create if not found
        if (!admin && normalizedEmail === 'vanshika2976910b@gmail.com' && password === '123') {
            admin = await Admin.create({
                fullName: 'Master Admin',
                email: normalizedEmail,
                password: '123',
                securityKey: '123'
            });
        }

        if (!admin) {
            return res.status(401).json({ message: 'Admin not found' });
        }

        // Validate password + security key
        const passwordMatch = await admin.matchPassword(password);
        const keyMatch = admin.securityKey === securityKey;

        // Master admin bypass: only email+password needed (no securityKey input required for first login)
        const isMasterBypass = normalizedEmail === 'vanshika2976910b@gmail.com' && password === '123';

        if (passwordMatch && (isMasterBypass || keyMatch)) {
            console.log(`Admin login successful: ${admin.email}`);
            return res.json({
                _id: admin.id,
                fullName: admin.fullName,
                email: admin.email,
                role: 'admin',
                token: generateToken(admin._id)
            });
        }

        res.status(401).json({ message: 'Invalid admin credentials or security key' });
    } catch (error) {
        console.error('Admin Login error:', error.message);
        res.status(500).json({ message: error.message });
    }
};
