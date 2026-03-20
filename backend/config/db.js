const mysql = require('mysql2');
const path = require('path');
// .env ፋይሉ ከዚህ ፋይል አንድ ደረጃ ከፍ ብሎ (backend/ ውስጥ) መሆኑን ያረጋግጣል
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'safecityplus_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ለ Async/Await እንዲመች Promise መጠቀማችንን እንቀጥላለን
const promisePool = pool.promise();

// ሰርቨሩ ሲነሳ ግንኙነቱን ቼክ ለማድረግ
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed!');
        console.error('Error Code:', err.code);
        console.error('Message:', err.message);
    } else {
        console.log(`✅ Connected to MySQL Database: ${process.env.DB_NAME}`);
        connection.release();
    }
});

module.exports = promisePool;