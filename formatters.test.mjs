import assert from 'node:assert/strict';
import {
  formatCleanDate,
  formatShortDate,
  formatCurrencyInput,
  parseCurrencyValue,
  formatRevenueDisplay,
  formatPhoneNumber
} from '../js/utils/formatters.js';

assert.equal(formatCleanDate('2026-3-7'), '2026-03-07');
assert.equal(formatCleanDate(''), '');
assert.equal(formatShortDate('2026-03-07'), '26-03-07');
assert.equal(formatShortDate(''), '-');
assert.equal(formatCurrencyInput('1234567'), '1,234,567');
assert.equal(parseCurrencyValue('₩1,234,567원'), 1234567);
assert.equal(formatRevenueDisplay(-1200), '-1,200원');
assert.equal(formatPhoneNumber('01012345678'), '010-1234-5678');
assert.equal(formatPhoneNumber('0212345678'), '02-1234-5678');
console.log('formatters tests passed');
