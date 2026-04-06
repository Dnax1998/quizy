require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // dla http, przy https ustaw true
}));

// Middleware sprawdzający zalogowanie
function auth(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Nie zalogowano' });
}

// REJESTRACJA
app.post('/api/register', async (req, res) => {
  const { username, password, fullname, phone } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Login i hasło wymagane' });
  const hashed = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, password, fullname, phone) VALUES (?, ?, ?, ?)`,
    [username, hashed, fullname || '', phone || ''],
    function(err) {
      if (err) return res.status(400).json({ error: 'Login zajęty' });
      res.json({ success: true });
    });
});

// LOGOWANIE
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Błędne dane' });
    }
    req.session.userId = user.id;
    res.json({ success: true, username: user.username });
  });
});

// WYLOGOWANIE
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// DANE UŻYTKOWNIKA
app.get('/api/me', auth, (req, res) => {
  db.get(`SELECT id, username, fullname, phone, balance, rating FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
    res.json(user);
  });
});

// WYSTAWIENIE OFERTY
app.post('/api/offer', auth, (req, res) => {
  const { server, item_name, price, description } = req.body;
  if (!server || !item_name || !price || price < 1) {
    return res.status(400).json({ error: 'Wypełnij wszystkie pola' });
  }
  db.run(`INSERT INTO offers (seller_id, server, item_name, price, description) VALUES (?, ?, ?, ?, ?)`,
    [req.session.userId, server, item_name, price, description || ''],
    function(err) {
      if (err) return res.status(500).json({ error: 'Błąd bazy' });
      res.json({ success: true, offerId: this.lastID });
    });
});

// LISTA OFERT (aktywne)
app.get('/api/offers', (req, res) => {
  db.all(`
    SELECT offers.*, users.username as seller_name, users.rating as seller_rating
    FROM offers
    JOIN users ON offers.seller_id = users.id
    WHERE offers.status = 'active'
    ORDER BY offers.created_at DESC
  `, [], (err, rows) => {
    res.json(rows);
  });
});

// KUPNO (rozpoczęcie transakcji escrow)
app.post('/api/buy/:offerId', auth, (req, res) => {
  const offerId = req.params.offerId;
  const buyerId = req.session.userId;

  db.get(`SELECT * FROM offers WHERE id = ? AND status = 'active'`, [offerId], (err, offer) => {
    if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje lub nieaktywna' });
    if (offer.seller_id === buyerId) return res.status(400).json({ error: 'Nie możesz kupić własnego przedmiotu' });

    const transactionId = uuidv4();
    db.run(`INSERT INTO transactions (id, offer_id, buyer_id, seller_id, amount, status)
            VALUES (?, ?, ?, ?, ?, 'awaiting_payment')`,
      [transactionId, offerId, buyerId, offer.seller_id, offer.price],
      (err) => {
        if (err) return res.status(500).json({ error: 'Błąd tworzenia transakcji' });
        // Zmień status oferty na 'sold'
        db.run(`UPDATE offers SET status = 'sold' WHERE id = ?`, [offerId]);
        res.json({ success: true, transactionId });
      });
  });
});

// POBRANIE SZCZEGÓŁÓW TRANSAKCJI
app.get('/api/transaction/:id', auth, (req, res) => {
  const txId = req.params.id;
  db.get(`
    SELECT t.*, 
           buyer.username as buyer_name, seller.username as seller_name,
           o.item_name, o.server, o.description
    FROM transactions t
    JOIN users buyer ON t.buyer_id = buyer.id
    JOIN users seller ON t.seller_id = seller.id
    JOIN offers o ON t.offer_id = o.id
    WHERE t.id = ?
  `, [txId], (err, tx) => {
    if (!tx) return res.status(404).json({ error: 'Brak transakcji' });
    // Sprawdź czy użytkownik jest stroną
    if (tx.buyer_id !== req.session.userId && tx.seller_id !== req.session.userId) {
      return res.status(403).json({ error: 'Brak dostępu' });
    }
    res.json(tx);
  });
});

// AKTUALIZACJA STATUSU TRANSAKCJI (tylko strony)
app.post('/api/transaction/:id/status', auth, (req, res) => {
  const txId = req.params.id;
  const { status } = req.body; // 'paid', 'item_sent', 'completed', 'dispute'
  const userId = req.session.userId;

  db.get(`SELECT * FROM transactions WHERE id = ?`, [txId], (err, tx) => {
    if (!tx) return res.status(404).json({ error: 'Brak transakcji' });

    // Prosta logika escrow: tylko właściwi użytkownicy mogą zmieniać stany
    if (status === 'paid') {
      // Kupujący oznacza, że zapłacił (w rzeczywistości tu powinna być integracja z płatnościami)
      if (tx.buyer_id !== userId) return res.status(403).json({ error: 'Brak uprawnień' });
      if (tx.status !== 'awaiting_payment') return res.status(400).json({ error: 'Nieprawidłowy stan' });
      db.run(`UPDATE transactions SET status = 'paid' WHERE id = ?`, [txId]);
      return res.json({ success: true });
    }
    if (status === 'item_sent') {
      // Sprzedający potwierdza wysłanie itemu w grze
      if (tx.seller_id !== userId) return res.status(403).json({ error: 'Brak uprawnień' });
      if (tx.status !== 'paid') return res.status(400).json({ error: 'Najpierw kupujący musi potwierdzić płatność' });
      db.run(`UPDATE transactions SET status = 'item_sent' WHERE id = ?`, [txId]);
      return res.json({ success: true });
    }
    if (status === 'completed') {
      // Kupujący potwierdza otrzymanie itemu – finalizacja
      if (tx.buyer_id !== userId) return res.status(403).json({ error: 'Brak uprawnień' });
      if (tx.status !== 'item_sent') return res.status(400).json({ error: 'Sprzedający nie potwierdził wysłania' });
      db.run(`UPDATE transactions SET status = 'completed' WHERE id = ?`, [txId], (err) => {
        // Dodaj środki sprzedającemu (w realnej aplikacji po potrąceniu prowizji)
        db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [tx.amount, tx.seller_id]);
      });
      return res.json({ success: true });
    }
    if (status === 'dispute') {
      // Każda ze stron może zgłosić spór
      if (tx.buyer_id !== userId && tx.seller_id !== userId) return res.status(403).json({ error: 'Brak uprawnień' });
      db.run(`UPDATE transactions SET status = 'dispute' WHERE id = ?`, [txId]);
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'Nieznany status' });
  });
});

// LISTA TRANSAKCJI UŻYTKOWNIKA
app.get('/api/my-transactions', auth, (req, res) => {
  db.all(`
    SELECT t.*, o.item_name, o.server
    FROM transactions t
    JOIN offers o ON t.offer_id = o.id
    WHERE t.buyer_id = ? OR t.seller_id = ?
    ORDER BY t.created_at DESC
  `, [req.session.userId, req.session.userId], (err, rows) => {
    res.json(rows);
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Serwer działa na http://localhost:${process.env.PORT || 3000}`);
});
