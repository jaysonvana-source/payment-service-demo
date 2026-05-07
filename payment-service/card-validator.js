/**
 * Card Validator — payment-service v2.1.0
 *
 * BUG INTRODUCED IN THIS COMMIT:
 * Luhn algorithm iterates left-to-right instead of right-to-left.
 * Breaks 15-digit Amex cards. Passes 16-digit Visa/Mastercard.
 * Matches INC-031 — March 3, 2026, $18K revenue loss.
 */

class CardValidator {
  validate(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    return this.luhnCheck(cleaned);
  }

  luhnCheck(num) {
    let sum = 0;
    for (let i = 0; i < num.length; i++) {
      let digit = parseInt(num[i]);
      // BUG LINE 28: should be (num.length - 1 - i) % 2 === 0
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  detectType(cardNumber) {
    const num = cardNumber.replace(/\D/g, '');
    if (num.startsWith('34') || num.startsWith('37')) return 'amex';
    if (num.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(num)) return 'mastercard';
    return 'unknown';
  }
}

module.exports = { CardValidator };
