const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { parseISO, differenceInHours, startOfDay, isBefore } = require('date-fns');

const db = require('./database');
const { authenticate, authorize, JWT_SECRET } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Authentication API
app.post('/api/auth/login', (req, res) => {
    const { employee_id, password } = req.body;
    db.get(`SELECT u.*, r.Role_Name FROM Users u JOIN Roles r ON u.Role_ID = r.Role_ID WHERE u.User_ID = ?`, [employee_id], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.Password_Hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { userId: user.User_ID, role: user.Role_Name, override: user.View_Available_Override },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ token, role: user.Role_Name, fullName: user.Full_Name });
    });
});

// 2. Booking API
app.post('/api/bookings/request', authenticate, (req, res) => {
    const { room_id, booking_date, slot_id, purpose, booking_type, req_laptops, req_microphones, req_videoconf } = req.body;
    const userId = req.user.userId;
    const role = req.user.role;

    // Validate Constraints
    db.get(`SELECT Room_Type FROM Rooms WHERE Room_ID = ?`, [room_id], (err, room) => {
        if (err || !room) return res.status(400).json({ error: 'Invalid room' });

        if (role === 'Secretary' && room.Room_Type !== 'Multi-purpose') {
            return res.status(403).json({ error: 'Secretary can only book Multi-purpose rooms' });
        }

        db.get(`SELECT Start_Time FROM Time_Slots WHERE Slot_ID = ?`, [slot_id], (err, slot) => {
            if (err || !slot) return res.status(400).json({ error: 'Invalid slot' });

            const eventDateTimeStr = `${booking_date}T${slot.Start_Time}`;
            const eventDateTime = parseISO(eventDateTimeStr);
            const now = new Date();
            
            if (isBefore(eventDateTime, now)) {
                 return res.status(400).json({ error: 'Cannot book in the past' });
            }

            const hoursRemaining = differenceInHours(eventDateTime, now);

            if (role === 'Secretary' && hoursRemaining < 48) {
                return res.status(400).json({ error: 'Secretary requires 48 hours notice' });
            }
            if (role === 'Employee' && hoursRemaining < 24) {
                return res.status(400).json({ error: 'Employee requires 24 hours notice' });
            }

            // Conflict Check
            db.get(`SELECT * FROM Bookings WHERE Room_ID = ? AND Booking_Date = ? AND Slot_ID = ? AND Status IN ('Pending', 'Approved')`,
                [room_id, booking_date, slot_id], (err, conflict) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    if (conflict) return res.status(409).json({ error: 'Room is already booked or pending for this time slot' });

                    // Insert Booking
                    db.run(`INSERT INTO Bookings (User_ID, Room_ID, Booking_Date, Slot_ID, Booking_Type, Purpose, Req_Laptops, Req_Microphones, Req_VideoConf)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [userId, room_id, booking_date, slot_id, booking_type, purpose, req_laptops, req_microphones, req_videoconf],
                        function(err) {
                            if (err) return res.status(500).json({ error: 'Failed to create booking' });
                            res.json({ message: 'Booking requested successfully', bookingId: this.lastID });
                        });
                });
        });
    });
});

app.get('/api/bookings/my-requests', authenticate, (req, res) => {
    db.all(`SELECT b.*, r.Room_Name, r.Room_Type, t.Start_Time, t.End_Time 
            FROM Bookings b
            JOIN Rooms r ON b.Room_ID = r.Room_ID
            JOIN Time_Slots t ON b.Slot_ID = t.Slot_ID
            WHERE b.User_ID = ?`, [req.user.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin/Branch Manager Respond
app.patch('/api/bookings/:id/respond', authenticate, authorize(['Admin', 'Branch Manager']), (req, res) => {
    const { status, reason, alternative_suggestion } = req.body;
    const bookingId = req.params.id;

    db.get(`SELECT b.*, r.Room_Type FROM Bookings b JOIN Rooms r ON b.Room_ID = r.Room_ID WHERE Booking_ID = ?`, [bookingId], (err, booking) => {
        if (err || !booking) return res.status(404).json({ error: 'Booking not found' });

        // Multi-purpose needs Branch Manager approval
        if (booking.Room_Type === 'Multi-purpose' && req.user.role !== 'Branch Manager') {
            return res.status(403).json({ error: 'Multi-purpose room bookings require Branch Manager approval' });
        }
        
        // Lecture halls need Admin approval
        if (booking.Room_Type === 'Lecture Hall' && req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Lecture hall bookings require Admin approval' });
        }

        db.run(`UPDATE Bookings SET Status = ?, Rejection_Reason = ?, Alternative_Suggestion = ? WHERE Booking_ID = ?`,
            [status, reason || null, alternative_suggestion || null, bookingId], function(err) {
                if (err) return res.status(500).json({ error: 'Update failed' });
                res.json({ message: 'Booking updated successfully' });
            });
    });
});

// 3. Admin Dashboard API
app.get('/api/admin/calendar-view', authenticate, authorize(['Admin']), (req, res) => {
    db.all(`SELECT b.*, r.Room_Name, r.Room_Type, t.Start_Time, t.End_Time, u.Full_Name
            FROM Bookings b
            JOIN Rooms r ON b.Room_ID = r.Room_ID
            JOIN Time_Slots t ON b.Slot_ID = t.Slot_ID
            JOIN Users u ON b.User_ID = u.User_ID`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows); // Frontend maps Booking_Type/Room_Type to colors (Blue, Green, Yellow)
    });
});

app.get('/api/admin/search-available', authenticate, authorize(['Admin']), (req, res) => {
    const { date, slot_id, room_type } = req.query;
    db.all(`SELECT * FROM Rooms r WHERE Room_Type = ? AND Room_ID NOT IN (
                SELECT Room_ID FROM Bookings WHERE Booking_Date = ? AND Slot_ID = ? AND Status IN ('Pending', 'Approved')
            )`, [room_type, date, slot_id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// 4. Delegation
app.post('/api/admin/delegate', authenticate, authorize(['Admin']), (req, res) => {
    const { original_user, substitute_user, start_date, end_date } = req.body;
    db.run(`INSERT INTO Delegations (Original_User_ID, Substitute_User_ID, Start_Date, End_Date)
            VALUES (?, ?, ?, ?)`, [original_user, substitute_user, start_date, end_date], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delegate' });
        res.json({ message: 'Delegation created successfully' });
    });
});

// 5. Morning Report
app.get('/api/reports/morning-summary', authenticate, authorize(['Admin']), (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(`SELECT b.*, r.Room_Name, t.Start_Time, t.End_Time 
            FROM Bookings b
            JOIN Rooms r ON b.Room_ID = r.Room_ID
            JOIN Time_Slots t ON b.Slot_ID = t.Slot_ID
            WHERE b.Booking_Date = ? AND b.Booking_Type != 'Static' AND b.Status = 'Approved'`, [today], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// 6. Metadata
app.get('/api/metadata', authenticate, (req, res) => {
    db.all('SELECT * FROM Rooms', (err, rooms) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        db.all('SELECT * FROM Time_Slots', (err, slots) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ rooms, slots });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
