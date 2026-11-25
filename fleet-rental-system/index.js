
const readline = require('readline/promises');
const { connect, close } = require('./db');
const { parseDate, today, fmt, round2 } = require('./utils');

const vehicles = require('./services/vehicles');
const customers = require('./services/customers');
const bookings = require('./services/bookings');
const returns = require('./services/returns');
const payments = require('./services/payments');
const maintenance = require('./services/maintenance');
const reports = require('./services/reports');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function ask(question) {
  const answer = await rl.question(question);
  return answer.trim();
}

function show(rows) {
  if (rows.length === 0) console.log('(nothing found)');
  else console.table(rows);
}


function prettyDates(rows) {
  return rows.map(r => {
    const copy = {};
    for (const key of Object.keys(r)) {
      copy[key] = r[key] instanceof Date ? fmt(r[key]) : r[key];
    }
    return copy;
  });
}


async function addVehicle() {
  const v = await vehicles.addVehicle({
    regNo: await ask('Reg no: '),
    make: await ask('Make: '),
    model: await ask('Model: '),
    type: await ask('Type (hatchback/sedan/suv/van): '),
    dailyRate: await ask('Daily rate: '),
    odometer: await ask('Current odometer (km): ')
  });
  console.log('Vehicle added:', v.regNo);
}

async function listVehicles() {
  const list = await vehicles.listVehicles();
  show(list.map(v => ({
    regNo: v.regNo, vehicle: v.make + ' ' + v.model, type: v.type,
    dailyRate: v.dailyRate, odometer: v.odometer, status: v.status
  })));
}

async function checkAvailability() {
  const start = parseDate(await ask('From (YYYY-MM-DD): '));
  const end = parseDate(await ask('To (YYYY-MM-DD): '));
  const type = await ask('Type (leave empty for all): ');
  const list = await vehicles.availableVehicles(start, end, type || null);
  show(list.map(v => ({ regNo: v.regNo, vehicle: v.make + ' ' + v.model, type: v.type, dailyRate: v.dailyRate })));
}

async function addCustomer() {
  const c = await customers.addCustomer({
    name: await ask('Name: '),
    phone: await ask('Phone: '),
    email: await ask('Email: '),
    licenseNo: await ask('License no: '),
    licenseExpiry: parseDate(await ask('License expiry (YYYY-MM-DD): '))
  });
  console.log('Customer added:', c.name);
}

async function listCustomers() {
  const list = await customers.listCustomers();
  show(list.map(c => ({
    name: c.name, phone: c.phone, email: c.email, licenseNo: c.licenseNo, licenseExpiry: fmt(c.licenseExpiry)
  })));
}



async function createBooking() {
  const result = await bookings.createBooking({
    regNo: await ask('Vehicle reg no: '),
    email: await ask('Customer email: '),
    startDate: parseDate(await ask('Start date (YYYY-MM-DD): ')),
    endDate: parseDate(await ask('End date (YYYY-MM-DD): '))
  });
  const b = result.bill;
  console.log('Booking created:', result.booking.bookingNo);
  console.log('Days:', result.booking.days, '| Base:', b.base, '| Discount:', b.discount, '| GST:', b.tax, '| Estimate:', b.total);
}

async function startRental() {
  const bookingNo = await ask('Booking no: ');
  const method = await ask('Deposit payment method (cash/card/upi/bank_transfer): ');
  const a = await bookings.startRental(bookingNo, method);
  console.log('Agreement', a.agreementNo, 'created. Deposit taken:', a.depositAmount, '| Start odometer:', a.startOdometer);
}

async function returnVehicle() {
  const r = await returns.returnVehicle({
    bookingNo: await ask('Booking no: '),
    returnDate: parseDate(await ask('Return date (YYYY-MM-DD): ')),
    endOdometer: Number(await ask('Odometer at return: ')),
    damageCharge: Number((await ask('Damage charge (0 if none): ')) || 0),
    method: await ask('Payment method for balance (cash/card/upi/bank_transfer): ')
  });
  console.log('--- Final bill ---');
  console.log('Rental charge :', r.rentalCharge);
  console.log('Late days     :', r.lateDays, '(fee ' + r.lateFee + ')');
  console.log('Damage        :', r.damage);
  console.log('Total         :', r.total);
  console.log('Already paid  :', r.paid);
  console.log(r.balance >= 0 ? 'Collected now  : ' + r.balance : 'Refunded       : ' + Math.abs(r.balance));
  console.log('Km driven     :', r.kmDriven);
}

async function cancelBooking() {
  await bookings.cancelBooking(await ask('Booking no: '));
  console.log('Booking cancelled.');
}

async function listBookings() {
  const status = await ask('Filter by status (booked/active/completed/cancelled, empty for all): ');
  const list = await bookings.listBookings(status ? { status: status } : {});
  show(prettyDates(list));
}



async function addPayment() {
  const p = await payments.addPayment(
    await ask('Booking no: '),
    Number(await ask('Amount: ')),
    await ask('Method (cash/card/upi/bank_transfer): '),
    (await ask('Type (deposit/rental, default rental): ')) || 'rental'
  );
  console.log('Payment recorded:', p.paymentNo);
}

async function paymentHistory() {
  const res = await payments.paymentsFor(await ask('Booking no: '));
  show(res.payments.map(p => ({ paymentNo: p.paymentNo, date: fmt(p.paidOn), type: p.type, method: p.method, amount: p.amount })));
  console.log('Total paid:', round2(res.paid), '| Estimate:', res.booking.estimate, '| Final charge:', res.booking.finalCharge || '-');
}



async function scheduleMaintenance() {
  const m = await maintenance.scheduleMaintenance({
    regNo: await ask('Vehicle reg no: '),
    type: await ask('Type (service/repair/inspection/tyres): '),
    description: await ask('Description: '),
    startDate: parseDate(await ask('Start date (YYYY-MM-DD): ')),
    endDate: parseDate(await ask('Planned end date (YYYY-MM-DD): '))
  });
  console.log('Maintenance scheduled:', m.maintenanceNo);
}

async function startMaintenance() {
  await maintenance.startMaintenance(await ask('Maintenance no: '));
  console.log('Vehicle is now in maintenance.');
}

async function completeMaintenance() {
  const no = await ask('Maintenance no: ');
  const cost = Number(await ask('Total cost: '));
  await maintenance.completeMaintenance(no, cost);
  console.log('Maintenance completed, vehicle is available again.');
}

async function listMaintenance() {
  show(prettyDates(await maintenance.listMaintenance()));
}



async function reportsMenu() {
  console.log('\n  1. Monthly revenue');
  console.log('  2. Revenue by vehicle type');
  console.log('  3. Vehicle utilization');
  console.log('  4. Fleet status');
  console.log('  5. Maintenance cost per vehicle');
  console.log('  6. Top customers');
  console.log('  7. Overdue rentals');

  const c = await ask('Report: ');

  if (c === '1') {
    const year = Number((await ask('Year (default ' + today().getUTCFullYear() + '): ')) || today().getUTCFullYear());
    show(await reports.revenueByMonth(year));
  } else if (c === '2') {
    const from = parseDate(await ask('From (YYYY-MM-DD): '));
    const to = parseDate(await ask('To (YYYY-MM-DD): '));
    show(await reports.revenueByVehicleType(from, to));
  } else if (c === '3') {
    const from = parseDate(await ask('From (YYYY-MM-DD): '));
    const to = parseDate(await ask('To (YYYY-MM-DD): '));
    show(await reports.utilization(from, to));
  } else if (c === '4') {
    show(await reports.fleetStatus());
  } else if (c === '5') {
    show(await reports.maintenanceCost());
  } else if (c === '6') {
    show(await reports.topCustomers());
  } else if (c === '7') {
    show(await reports.overdueRentals());
  } else {
    console.log('Invalid report');
  }
}



const menu = [
  ['1', 'Add vehicle', addVehicle],
  ['2', 'List vehicles', listVehicles],
  ['3', 'Check availability', checkAvailability],
  ['4', 'Add customer', addCustomer],
  ['5', 'List customers', listCustomers],
  ['6', 'Create booking', createBooking],
  ['7', 'Start rental (pickup + agreement)', startRental],
  ['8', 'Return vehicle', returnVehicle],
  ['9', 'Cancel booking', cancelBooking],
  ['10', 'List bookings', listBookings],
  ['11', 'Add payment', addPayment],
  ['12', 'Payment history of a booking', paymentHistory],
  ['13', 'Schedule maintenance', scheduleMaintenance],
  ['14', 'Start maintenance', startMaintenance],
  ['15', 'Complete maintenance', completeMaintenance],
  ['16', 'List maintenance', listMaintenance],
  ['17', 'Reports', reportsMenu],
  ['0', 'Exit', null]
];

async function main() {
  await connect();
  console.log('Connected to MongoDB.');

  while (true) {
    console.log('\n===== Fleet Rental System =====');
    menu.forEach(m => console.log(m[0].padStart(2) + '. ' + m[1]));

    const choice = await ask('Choice: ');
    if (choice === '0') break;

    const item = menu.find(m => m[0] === choice);
    if (!item) {
      console.log('Invalid choice');
      continue;
    }

    try {
      await item[2]();
    } catch (err) {
      if (err.code === 11000) console.log('Error: this record already exists (duplicate value)');
      else console.log('Error:', err.message);
    }
  }

  rl.close();
  await close();
}

main().catch(err => {
  console.error('Could not start:', err.message);
  process.exit(1);
});
