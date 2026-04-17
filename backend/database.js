const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'booking_system.db');
const db = new sqlite3.Database(dbPath);

const initDb = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Roles Table
                db.run(`CREATE TABLE IF NOT EXISTS Roles (
                    Role_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    Role_Name TEXT UNIQUE NOT NULL
                )`);

                // Users Table
                db.run(`CREATE TABLE IF NOT EXISTS Users (
                    User_ID INTEGER PRIMARY KEY, -- using actual employee ID
                    Full_Name TEXT NOT NULL,
                    Password_Hash TEXT NOT NULL,
                    Role_ID INTEGER,
                    View_Available_Override BOOLEAN DEFAULT 0,
                    FOREIGN KEY (Role_ID) REFERENCES Roles(Role_ID)
                )`);

                // Rooms Table
                db.run(`CREATE TABLE IF NOT EXISTS Rooms (
                    Room_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    Room_Name TEXT NOT NULL,
                    Room_Type TEXT NOT NULL CHECK(Room_Type IN ('Lecture Hall', 'Multi-purpose')),
                    Capacity INTEGER NOT NULL
                )`);

                // Time Slots Table
                db.run(`CREATE TABLE IF NOT EXISTS Time_Slots (
                    Slot_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    Start_Time TEXT NOT NULL,
                    End_Time TEXT NOT NULL,
                    Is_Ramadan_Schedule BOOLEAN DEFAULT 0
                )`);

                // Bookings Table
                db.run(`CREATE TABLE IF NOT EXISTS Bookings (
                    Booking_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    User_ID INTEGER NOT NULL,
                    Room_ID INTEGER NOT NULL,
                    Booking_Date TEXT NOT NULL, -- YYYY-MM-DD
                    Slot_ID INTEGER NOT NULL,
                    Booking_Type TEXT NOT NULL CHECK(Booking_Type IN ('Static', 'Exceptional', 'Multi-purpose')),
                    Status TEXT NOT NULL DEFAULT 'Pending' CHECK(Status IN ('Pending', 'Approved', 'Rejected')),
                    Purpose TEXT,
                    Req_Laptops INTEGER DEFAULT 0,
                    Req_Microphones INTEGER DEFAULT 0,
                    Req_VideoConf BOOLEAN DEFAULT 0,
                    Rejection_Reason TEXT,
                    Alternative_Suggestion TEXT,
                    FOREIGN KEY (User_ID) REFERENCES Users(User_ID),
                    FOREIGN KEY (Room_ID) REFERENCES Rooms(Room_ID),
                    FOREIGN KEY (Slot_ID) REFERENCES Time_Slots(Slot_ID)
                )`);

                // Delegation Table
                db.run(`CREATE TABLE IF NOT EXISTS Delegations (
                    Delegate_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    Original_User_ID INTEGER NOT NULL,
                    Substitute_User_ID INTEGER NOT NULL,
                    Start_Date TEXT NOT NULL,
                    End_Date TEXT NOT NULL,
                    FOREIGN KEY (Original_User_ID) REFERENCES Users(User_ID),
                    FOREIGN KEY (Substitute_User_ID) REFERENCES Users(User_ID)
                )`);

                // Insert Default Roles
                const roles = ['Admin', 'Branch Manager', 'Employee', 'Secretary'];
                const insertRole = db.prepare(`INSERT OR IGNORE INTO Roles (Role_Name) VALUES (?)`);
                roles.forEach(role => insertRole.run(role));
                insertRole.finalize();

                // Insert Default Admin
                const hash = await bcrypt.hash('admin123', 10);
                db.run(`INSERT OR IGNORE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID, View_Available_Override)
                        VALUES (?, ?, ?, (SELECT Role_ID FROM Roles WHERE Role_Name = 'Admin'), ?)`,
                        [100, 'System Admin', hash, 1]);
                
                // Demo Users
                const mngrHash = await bcrypt.hash('mngr', 10);
                const empHash = await bcrypt.hash('emp', 10);
                const secHash = await bcrypt.hash('sec', 10);
                
                db.run(`INSERT OR IGNORE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID) VALUES (200, 'Branch Manager', ?, 2)`, [mngrHash]);
                db.run(`INSERT OR IGNORE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID) VALUES (300, 'Employee', ?, 3)`, [empHash]);
                db.run(`INSERT OR IGNORE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID) VALUES (400, 'College Secretary', ?, 4)`, [secHash]);

                // Insert Default Rooms
                db.run(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (1, 'Hall A', 'Lecture Hall', 150)`);
                db.run(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (2, 'Hall B', 'Lecture Hall', 100)`);
                db.run(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (3, 'Meeting Room 1', 'Multi-purpose', 30)`);
                db.run(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (4, 'Conference Center', 'Multi-purpose', 500)`);

                // Insert Default Time Slots
                db.run(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (1, '08:00', '10:00')`);
                db.run(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (2, '10:00', '12:00')`);
                db.run(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (3, '12:00', '14:00')`);
                db.run(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (4, '14:00', '16:00')`);

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });
};

initDb().catch(console.error);

module.exports = db;
