const nodemailer = require('nodemailer');

// Create a transporter using Gmail (you can configure this for your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'safecity.app.alerts@gmail.com', // Default email
    pass: process.env.EMAIL_PASS || 'your-app-password' // Use app-specific password
  }
});

// Send password reset email
const sendPasswordResetEmail = async (userEmail, userName, resetLink = null) => {
  try {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️  Email credentials not configured in .env file');
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'SafeCity+ - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #E63939, #1e293b); padding: 30px; border-radius: 10px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🛡️ SafeCity+</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Emergency Response System</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-top: 20px;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #666; line-height: 1.6;">
              Hello ${userName},<br><br>
              We received a request to reset your password for your SafeCity+ account. 
              If you didn't make this request, you can safely ignore this email.
            </p>
            
            ${resetLink ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #E63939; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                🔐 Reset Password
              </a>
            </div>
            
            <div style="background: #fff; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #10b981; margin-top: 0;">⏰ Important</h3>
              <p style="color: #666; margin-bottom: 0;">
                This reset link will expire in 1 hour for security reasons.
                If the link doesn't work, you can request a new password reset.
              </p>
            </div>
            ` : `
            <div style="background: #fff; border-left: 4px solid #E63939; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #E63939; margin-top: 0;">🔐 Security Notice</h3>
              <p style="color: #666; margin-bottom: 0;">
                For security reasons, please contact your system administrator to reset your password.
                This is a temporary measure while we implement our automated password reset system.
              </p>
            </div>
            `}
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #999; font-size: 14px;">
                This is an automated message from SafeCity+ Emergency Response System<br>
                Please do not reply to this email
              </p>
            </div>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${userEmail}:`, result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    
    // Check for specific network/connection errors
    if (error.code === 'ENETUNREACH' || error.code === 'ECONNREFUSED' || error.code === 'ESOCKET') {
      console.log('🔧 Network connection issue - email service unavailable');
    }
    
    return false;
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service configuration error:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  testEmailConfig
};
