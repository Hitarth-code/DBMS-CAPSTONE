

module.exports = {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  DB_NAME: 'fleet_rental',

  TAX_RATE: 0.18,            // GST on rental charge
  WEEKLY_DISCOUNT: 0.10,     // discount if rental is 7 days or more
  LATE_FEE_MULTIPLIER: 1.5,  // late day costs 1.5 x daily rate
  DEPOSIT_PERCENT: 0.20      // deposit taken at pickup (part of the estimate)
};
