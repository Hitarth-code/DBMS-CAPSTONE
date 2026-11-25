const config = require('./config');
const { round2 } = require('./utils');

function calcCharge(dailyRate, days) {
  const base = dailyRate * days;
  const discount = days >= 7 ? base * config.WEEKLY_DISCOUNT : 0;
  const taxable = base - discount;
  const tax = taxable * config.TAX_RATE;

  return {
    base: round2(base),
    discount: round2(discount),
    tax: round2(tax),
    total: round2(taxable + tax)
  };
}

function calcLateFee(dailyRate, lateDays) {
  return round2(dailyRate * config.LATE_FEE_MULTIPLIER * lateDays);
}

module.exports = { calcCharge, calcLateFee };
