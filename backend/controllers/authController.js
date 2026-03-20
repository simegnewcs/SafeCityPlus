const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. መመዝገቢያ (Register)
exports.register = async (req, res) => {
    try {
        const { fullName, phone, password } = req.body;

        if (!fullName || !phone || !password) {
            return res.status(400).json({ success: false, message: "እባክዎ ሁሉንም መረጃዎች በትክክል ይሙሉ!" });
        }

        const [existingUser] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: "ይህ ስልክ ቁጥር ቀድሞ ተመዝግቧል!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const sql = 'INSERT INTO users (full_name, phone, password) VALUES (?, ?, ?)';
        await db.execute(sql, [fullName, phone, hashedPassword]);

        return res.status(201).json({ success: true, message: "በስኬት ተመዝግበዋል!" });

    } catch (error) {
        console.error("🔥 Registration Error Details:", error);
        return res.status(500).json({ success: false, message: "የሰርቨር ስህተት ተፈጥሯል: " + error.message });
    }
};

// 2. መግቢያ (Login) - አዲስ የተጨመረ
exports.login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        // ሀ. ስልክ እና ፓስወርድ መኖሩን ቼክ ማድረግ
        if (!phone || !password) {
            return res.status(400).json({ success: false, message: "እባክዎ ስልክ ቁጥር እና ፓስወርድ ያስገቡ!" });
        }

        // ለ. ተጠቃሚውን በስልክ ቁጥሩ መፈለግ
        const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "ያልተመዘገበ ስልክ ቁጥር ወይም የተሳሳተ ፓስወርድ!" });
        }

        const user = users[0];

        // ሐ. ፓስወርዱን ማወዳደር (Bcrypt Compare)
        // ተጠቃሚው ያስገባው 'password' እና ዳታቤዝ ያለው 'user.password' ይነጻጸራሉ
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "ያልተመዘገበ ስልክ ቁጥር ወይም የተሳሳተ ፓስወርድ!" });
        }

        // መ. ስኬታማ ከሆነ የተጠቃሚውን መረጃ መመለስ (ፓስወርዱን ሳንጨምር)
        return res.status(200).json({
            success: true,
            message: "እንኳን ደህና መጡ!",
            user: {
                id: user.id,
                fullName: user.full_name,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error) {
        console.error("🔥 Login Error Details:", error);
        return res.status(500).json({ success: false, message: "የመግቢያ ስህተት ተፈጥሯል: " + error.message });
    }
};