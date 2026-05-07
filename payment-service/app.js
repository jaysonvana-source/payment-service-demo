require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const VERSION = process.env.PAYMENT_VERSION || 'v2.1.0';
const errorLog = [];

// Serve checkout.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkout.html'));
});

// Luhn algorithms
function luhnCorrect(num) {
  const digits = num.replace(/\D/g, '').split('').reverse();
  const sum = digits.reduce((acc, d, i) => {
    let n = parseInt(d);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    return acc + n;
  }, 0);
  return sum % 10 === 0;
}

function luhnBroken(num) {
  const digits = num.replace(/\D/g, '').split('');
  const sum = digits.reduce((acc, d, i) => {
    let n = parseInt(d);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    return acc + n;
  }, 0);
  return sum % 10 === 0;
}

function validateCard(num) {
  return VERSION === 'v2.1.0' ? luhnBroken(num) : luhnCorrect(num);
}

function detectType(num) {
  const n = num.replace(/\D/g, '');
  if (n.startsWith('34') || n.startsWith('37')) return 'amex';
  if (n.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  return 'unknown';
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: VERSION, errors: errorLog.length });
});

app.get('/api/version', (req, res) => {
  res.json({ version: VERSION, broken: VERSION === 'v2.1.0' });
});

app.post('/api/payments/charge', (req, res) => {
  const { card_number, expiry, cvv, amount } = req.body;
  if (!card_number || !expiry || !amount) {
    return res.status(400).json({ detail: 'Missing required fields' });
  }

  const clean = card_number.replace(/\D/g, '');
  const cardType = detectType(clean);

  if (!validateCard(clean)) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: 'PaymentValidationError',
      message: 'Invalid card checksum',
      card_type: cardType,
      version: VERSION,
      file: 'card-validator.js',
      line: 28
    };
    errorLog.push(entry);
    return res.status(422).json({
      detail: {
        error: 'PaymentValidationError',
        message: 'Invalid card checksum',
        card_type: cardType,
        version: VERSION,
        file: 'card-validator.js',
        line: 28
      }
    });
  }

  const [month, year] = (expiry || '').split('/');
  const expDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
  if (expDate < new Date()) {
    return res.status(422).json({ detail: 'Card expired' });
  }

  res.json({
    success: true,
    transaction_id: `txn_${Date.now()}`,
    card_type: cardType,
    amount,
    version: VERSION
  });
});

app.get('/api/errors', (req, res) => {
  res.json({
    service: 'payment-service',
    version: VERSION,
    error_groups: errorLog.length > 0 ? [{
      title: 'PaymentValidationError: Invalid card checksum',
      count: errorLog.length,
      first_seen: errorLog[0]?.timestamp,
      last_seen: errorLog[errorLog.length - 1]?.timestamp,
      trend: errorLog.length > 5 ? 'INCREASING' : 'STABLE',
      file: 'card-validator.js',
      line: 28,
      affected_card_types: [...new Set(errorLog.map(e => e.card_type))]
    }] : [],
    total: errorLog.length
  });
});

app.delete('/api/errors', (req, res) => {
  errorLog.length = 0;
  res.json({ cleared: true });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`\n💳 Payment Service ${VERSION} on port ${PORT}`);
  console.log(VERSION === 'v2.1.0' ? '⚠️  BROKEN — Amex fails' : '✅ WORKING');
});
