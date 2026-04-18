import sqlite3 from 'sqlite3';
const sqlite3Verbose = sqlite3.verbose();
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env || {};
const dbPath = env.VERCEL ? '/tmp/booking_system.db' : path.resolve(__dirname, 'booking_system.db');
console.log('Database Path:', dbPath);

const db = new sqlite3Verbose.Database(dbPath, (err) => {
    if (err) console.error('DATABASE_CONNECTION_ERROR:', err);
    else console.log('Connected to SQLite database');
});

const runObj = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { 
        if(err) {
            console.error('SQL_RUN_ERROR:', sql, err);
            reject(err); 
        } else resolve(this); 
    });
});

export const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if(err) {
            console.error('SQL_GET_ERROR:', sql, err);
            reject(err);
        } else resolve(row);
    });
});

export const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if(err) {
            console.error('SQL_ALL_ERROR:', sql, err);
            reject(err);
        } else resolve(rows);
    });
});

export const dbRun = runObj;

let initialized = false;
let initPromise = null;

const doInit = async () => {
    console.log('Starting database initialization...');
    try {
        await dbRun(`CREATE TABLE IF NOT EXISTS Roles (Role_ID INTEGER PRIMARY KEY AUTOINCREMENT, Role_Name TEXT UNIQUE NOT NULL)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS Users (User_ID INTEGER PRIMARY KEY, Full_Name TEXT NOT NULL, Password_Hash TEXT NOT NULL, Role_ID INTEGER, View_Available_Override BOOLEAN DEFAULT 0, FOREIGN KEY (Role_ID) REFERENCES Roles(Role_ID))`);
        await dbRun(`CREATE TABLE IF NOT EXISTS Rooms (Room_ID INTEGER PRIMARY KEY AUTOINCREMENT, Room_Name TEXT NOT NULL, Room_Type TEXT NOT NULL CHECK(Room_Type IN ('Lecture Hall', 'Multi-purpose')), Capacity INTEGER NOT NULL)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS Time_Slots (Slot_ID INTEGER PRIMARY KEY AUTOINCREMENT, Start_Time TEXT NOT NULL, End_Time TEXT NOT NULL, Is_Ramadan_Schedule BOOLEAN DEFAULT 0)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS Bookings (Booking_ID INTEGER PRIMARY KEY AUTOINCREMENT, User_ID INTEGER NOT NULL, Room_ID INTEGER NOT NULL, Booking_Date TEXT NOT NULL, Slot_ID INTEGER NOT NULL, Booking_Type TEXT NOT NULL CHECK(Booking_Type IN ('Static', 'Exceptional', 'Multi-purpose')), Status TEXT NOT NULL DEFAULT 'Pending' CHECK(Status IN ('Pending', 'Approved', 'Rejected')), Purpose TEXT, Req_Laptops INTEGER DEFAULT 0, Req_Microphones INTEGER DEFAULT 0, Req_VideoConf BOOLEAN DEFAULT 0, Rejection_Reason TEXT, Alternative_Suggestion TEXT, FOREIGN KEY (User_ID) REFERENCES Users(User_ID), FOREIGN KEY (Room_ID) REFERENCES Rooms(Room_ID), FOREIGN KEY (Slot_ID) REFERENCES Time_Slots(Slot_ID))`);
        await dbRun(`CREATE TABLE IF NOT EXISTS Delegations (Delegate_ID INTEGER PRIMARY KEY AUTOINCREMENT, Original_User_ID INTEGER NOT NULL, Substitute_User_ID INTEGER NOT NULL, Start_Date TEXT NOT NULL, End_Date TEXT NOT NULL, FOREIGN KEY (Original_User_ID) REFERENCES Users(User_ID), FOREIGN KEY (Substitute_User_ID) REFERENCES Users(User_ID))`);

        const roles = ['Admin', 'Branch Manager', 'Employee', 'Secretary'];
        for (const role of roles) await dbRun(`INSERT OR IGNORE INTO Roles (Role_Name) VALUES (?)`, [role]);

        const adminHash = await bcrypt.hash('admin123', 10);
        const mngrHash = await bcrypt.hash('mngr', 10);
        const empHash = await bcrypt.hash('emp', 10);
        const secHash = await bcrypt.hash('sec', 10);

        await dbRun(`INSERT OR REPLACE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID, View_Available_Override) VALUES (?, ?, ?, 1, ?)`, [100, 'System Admin', adminHash, 1]);
        await dbRun(`INSERT OR REPLACE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID) VALUES (200, 'Branch Manager', ?, 2)`, [mngrHash]);
        await dbRun(`INSERT OR REPLACE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID) VALUES (300, 'Employee', ?, 3)`, [empHash]);
        await dbRun(`INSERT OR REPLACE INTO Users (User_ID, Full_Name, Password_Hash, Role_ID) VALUES (400, 'College Secretary', ?, 4)`, [secHash]);

        await dbRun(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (1, 'Hall A', 'Lecture Hall', 150)`);
        await dbRun(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (2, 'Hall B', 'Lecture Hall', 100)`);
        await dbRun(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (3, 'Meeting Room 1', 'Multi-purpose', 30)`);
        await dbRun(`INSERT OR IGNORE INTO Rooms (Room_ID, Room_Name, Room_Type, Capacity) VALUES (4, 'Conference Center', 'Multi-purpose', 500)`);

        await dbRun(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (1, '08:00', '10:00')`);
        await dbRun(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (2, '10:00', '12:00')`);
        await dbRun(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (3, '12:00', '14:00')`);
        await dbRun(`INSERT OR IGNORE INTO Time_Slots (Slot_ID, Start_Time, End_Time) VALUES (4, '14:00', '16:00')`);
        console.log('Database initialization complete');
    } catch (err) {
        console.error('DATABASE_DOINIT_ERROR:', err);
        throw err;
    }
};

export const initDb = async () => {
    if (initialized) return db;
    if (!initPromise) {
        initPromise = doInit()
            .then(() => { initialized = true; })
            .catch(err => {
                initPromise = null;
                throw err;
            });
    }
    await initPromise;
    return db;
};

export { db };
