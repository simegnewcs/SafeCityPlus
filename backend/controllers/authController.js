const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. መመዝገቢያ (Register)
exports.register = async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;

        if (!fullName || !phone || !password) {
            return res.status(400).json({ success: false, message: "Please fill in all required fields." });
        }

        const [existingUser] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: "This phone number is already registered." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const sql = 'INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)';
        await db.execute(sql, [fullName, email || null, phone, hashedPassword]);

        return res.status(201).json({ success: true, message: "በስኬት ተመዝግበዋል!" });

    } catch (error) {
        console.error("🔥 Registration Error Details:", error);
        return res.status(500).json({ success: false, message: "የሰርቨር ስህተት ተፈጥሯል: " + error.message });
    }
};

// 2. መግቢያ (Login) - አዲስ የተጨመረ
exports.login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        const identifier = email || phone;

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: "Please enter your email and password." });
        }

        // Try email first, fall back to phone for existing accounts
        let [users] = await db.execute('SELECT * FROM users WHERE email = ?', [identifier]);
        if (users.length === 0) {
            [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [identifier]);
        }

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        const user = users[0];

        // ሐ. ፓስወርዱን ማወዳደር (Bcrypt Compare)
        // ተጠቃሚው ያስገባው 'password' እና ዳታቤዝ ያለው 'user.password' ይነጻጸራሉ
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // መ. ስኬታማ ከሆነ የተጠቃሚውን መረጃ መመለስ (ፓስወርዱን ሳንጨምር)
        return res.status(200).json({
            success: true,
            message: "እንኳን ደህና መጡ!",
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                responder_type: user.responder_type || null
            }
        });

    } catch (error) {
        console.error("🔥 Login Error Details:", error);
        return res.status(500).json({ success: false, message: "የመግቢያ ስህተት ተፈጥሯል: " + error.message });
    }
};