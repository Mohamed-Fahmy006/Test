import jwt from 'jsonwebtoken';
import process from 'process';
import { db } from '../database.js';
 // Note: In ESM, extensions are often required

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Authenticate user token
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Find if user has active delegation
        const today = new Date().toISOString().split('T')[0];
        db.get(`SELECT r.Role_Name 
                FROM Delegations d 
                JOIN Users u ON d.Original_User_ID = u.User_ID 
                JOIN Roles r ON u.Role_ID = r.Role_ID
                WHERE d.Substitute_User_ID = ? AND d.Start_Date <= ? AND d.End_Date >= ?`, 
                [decoded.userId, today, today], 
        (err, delegation) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            // If delegation is active, they take the delegated role, otherwise their own role
            req.user = {
                userId: decoded.userId,
                role: delegation ? delegation.Role_Name : decoded.role,
                override: decoded.override
            };
            next();
        });
    });
};

// Check specific roles
export const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

export { JWT_SECRET };
