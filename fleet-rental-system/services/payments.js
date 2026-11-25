const { connect } = require('../db');
const { nextNumber, round2 } = require('../utils');


async function recordPayment(db, bookingId, amount, method, type, paidOn = new Date()) {
  const payment = {
    paymentNo: await nextNumber(db, 'payment', 'PAY-'),
    bookingId: bookingId,
    amount: round2(amount),
    method: method,
    type: type,
    paidOn: paidOn
  };
  await db.collection('payments').insertOne(payment);
  return payment;
}

async function addPayment(bookingNo, amount, method, type = 'rental') {
  const db = await connect();

  const booking = await db.collection('bookings').findOne({ bookingNo: bookingNo });
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled') throw new Error('Booking is cancelled');
  if (!(amount > 0)) throw new Error('Amount must be more than 0');

  return recordPayment(db, booking._id, amount, method, type);
}

async function totalPaid(db, bookingId) {
  const res = await db.collection('payments').aggregate([
    { $match: { bookingId: bookingId } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]).toArray();
  return res.length ? res[0].total : 0;
}

async function paymentsFor(bookingNo) {
  const db = await connect();
  const booking = await db.collection('bookings').findOne({ bookingNo: bookingNo });
  if (!booking) throw new Error('Booking not found');

  const list = await db.collection('payments').find({ bookingId: booking._id }).sort({ paidOn: 1 }).toArray();
  return { booking, payments: list, paid: await totalPaid(db, booking._id) };
}

module.exports = { recordPayment, addPayment, totalPaid, paymentsFor };
