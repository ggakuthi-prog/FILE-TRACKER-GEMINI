const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('./tracker.db');

db.serialize(() => {
    // 1. Departments Table
    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);

    // 2. Users Table (Security: Password Hashing)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        department_id INTEGER,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    )`);

    // 3. Files Table
    db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_reference TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        current_department_id INTEGER,
        current_user TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        FOREIGN KEY(current_department_id) REFERENCES departments(id)
    )`);

    // 4. File Audit Log (Tracking Movements)
    db.run(`CREATE TABLE IF NOT EXISTS file_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER,
        department_id INTEGER,
        action_type TEXT NOT NULL, -- 'IN' or 'OUT'
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        handled_by TEXT NOT NULL,
        FOREIGN KEY(file_id) REFERENCES files(id),
        FOREIGN KEY(department_id) REFERENCES departments(id)
    )`);

    // Seed 10 Departments
    const depts = [
        'Finance & Accounts', 'Human Resource Management', 'Procurement & Logistics',
        'Legal Affairs', 'Information Technology', 'Internal Audit',
        'Public Relations', 'Strategy & Planning', 'Administration', 'Records & Archives'
    ];
    
    const stmt = db.prepare("INSERT OR IGNORE INTO departments (name) VALUES (?)");
    depts.forEach(dept => stmt.run(dept));
    stmt.finalize();

    // Seed default admin user (Security: default pass 'GovAdmin2026!')
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('GovAdmin2026!', salt);
    db.run("INSERT OR IGNORE INTO users (username, password_hash, department_id) VALUES (?, ?, ?)", ['admin', hash, 10]);
});

module.exports = db;
