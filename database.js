const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(path.join(__dirname, 'metin2.db'));

// Inicjalizacja tabel
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      fullname TEXT,
      phone TEXT,
      balance INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER,
      server TEXT,
      item_name TEXT,
      price INTEGER,
      description TEXT,
      status TEXT DEFAULT 'active', -- active, sold, cancelled
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(seller_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      offer_id INTEGER,
      buyer_id INTEGER,
      seller_id INTEGER,
      amount INTEGER,
      status TEXT DEFAULT 'awaiting_payment', -- awaiting_payment, paid, item_sent, completed, dispute
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(offer_id) REFERENCES offers(id),
      FOREIGN KEY(buyer_id) REFERENCES users(id),
      FOREIGN KEY(seller_id) REFERENCES users(id)
    )
  `);
});

module.exports = db;
