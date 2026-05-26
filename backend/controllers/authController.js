const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendPasswordResetEmail } = require('../services/emailService');
const crypto = require('crypto');

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

// 2. መግቢያ (Login) - Email only
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Please enter your email and password." });
        }

        // Only allow email login (phone login disabled)
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

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

// 3. የይለፍ ቃል መለወጥ (Forgot Password)
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        // Check if user exists with this email
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            // For security, don't reveal if email exists or not
            return res.status(200).json({ 
                success: true, 
                message: "If an account with this email exists, a password reset link has been sent." 
            });
        }

        const user = users[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        // Clean up any existing tokens for this user
        await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);

        // Store new reset token
        await db.execute(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, resetToken, expiresAt]
        );

        // Create reset link (for mobile app, we'll use a deep link)
        const resetLink = `safecity://reset-password?token=${resetToken}`;

        // Send password reset email with reset link
        const emailSent = await sendPasswordResetEmail(email, user.full_name, resetLink);
        
        if (emailSent) {
            console.log(`✅ Password reset email sent to user: ${user.full_name} (${email})`);
            return res.status(200).json({ 
                success: true, 
                message: "Password reset instructions have been sent to your email." 
            });
        } else {
            console.log(`⚠️  Email service unavailable - providing manual reset instructions for: ${email}`);
            // Return the token directly for testing (remove in production)
            return res.status(200).json({ 
                success: true, 
                message: "Email service is temporarily unavailable. Please contact your system administrator to reset your password. Your account has been verified.",
                resetToken: resetToken // For testing only - remove in production
            });
        }

    } catch (error) {
        console.error("🔥 Forgot Password Error Details:", error);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
};

// 4. የይለፍ ቃል መቀየር (Reset Password)
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: "Reset token and new password are required." 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: "Password must be at least 6 characters long." 
            });
        }

        // Find valid reset token
        const [tokenRows] = await db.execute(
            'SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
            [token]
        );

        if (tokenRows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid or expired reset token." 
            });
        }

        const resetToken = tokenRows[0];
        const userId = resetToken.user_id;

        // Get user information
        const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (userRows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "User not found." 
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user password
        await db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        // Mark token as used
        await db.execute(
            'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
            [resetToken.id]
        );

        console.log(`✅ Password reset successful for user: ${userRows[0].full_name}`);

        return res.status(200).json({ 
            success: true, 
            message: "Password has been reset successfully. You can now login with your new password." 
        });

    } catch (error) {
        console.error("🔥 Reset Password Error Details:", error);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
};