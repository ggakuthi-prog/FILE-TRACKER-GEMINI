const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const db = require('./database');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false })); // Basic header security
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'super-secret-gov-key-12345', // Change this to a random string
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1800000 } // 30 mins session, protects against XSS cookie theft
}));

// Authentication Middleware
const requireLogin = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized access" });
    next();
};

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Authentication API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(400).json({ error: "Invalid credentials" });
        
        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) return res.status(400).json({ error: "Invalid credentials" });

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, username: user.username });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get Departments
app.get('/api/departments', requireLogin, (req, res) => {
    db.all("SELECT * FROM departments", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// File Tracking Search Route
app.get('/api/files/search', requireLogin, (req, res) => {
    const query = `%${req.query.q || ''}%`;
    const sql = `
        SELECT f.*, d.name as department_name 
        FROM files f
        LEFT JOIN departments d ON f.current_department_id = d.id
        WHERE f.file_reference LIKE ? OR f.title LIKE ? OR f.current_user LIKE ?`;
    
    db.all(sql, [query, query, query], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Register New File
app.post('/api/files', requireLogin, (req, res) => {
    const { file_reference, title, department_id, current_user } = req.body;
    const sql = `INSERT INTO files (file_reference, title, current_department_id, current_user) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [file_reference, title, department_id, current_user], function(err) {
        if (err) return res.status(400).json({ error: "Reference standard must be unique." });
        
        // Log movement entry
        db.run(`INSERT INTO file_logs (file_id, department_id, action_type, handled_by) VALUES (?, ?, 'IN', ?)`, 
            [this.lastID, department_id, req.session.username]);
            
        res.json({ success: true, id: this.lastID });
    });
});

// Update File Movement (Transfer)
app.post('/api/files/move', requireLogin, (req, res) => {
    const { file_id, target_department_id, next_user } = req.body;
    
    db.get("SELECT current_department_id FROM files WHERE id = ?", [file_id], (err, file) => {
        if (!file) return res.status(440).json({ error: "File not found" });

        // Log Check-Out from current department
        db.run(`INSERT INTO file_logs (file_id, department_id, action_type, handled_by) VALUES (?, ?, 'OUT', ?)`,
            [file_id, file.current_department_id, req.session.username], () => {
                
                // Update file location details
                db.run(`UPDATE files SET current_department_id = ?, current_user = ? WHERE id = ?`, 
                    [target_department_id, next_user, file_id], () => {
                        
                        // Log Check-In into new department
                        db.run(`INSERT INTO file_logs (file_id, department_id, action_type, handled_by) VALUES (?, ?, 'IN', ?)`,
                            [file_id, target_department_id, req.session.username]);
                        
                        res.json({ success: true });
                    });
            });
    });
});

// Fetch File History Log
app.get('/api/files/:id/history', requireLogin, (req, res) => {
    const sql = `
        SELECT l.*, d.name as department_name 
        FROM file_logs l
        JOIN departments d ON l.department_id = d.id
        WHERE l.file_id = ? ORDER BY l.timestamp DESC`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3000, () => console.log('Government Security File System active on port 3000'));
