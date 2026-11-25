
const { connect, close } = require('./db');
const { setup } = require('./setup');
const { today, addDays, parseDate, nextNumber } = require('./utils');
const { addVehicle } = require('./services/vehicles');
const { addCustomer } = require('./services/customers');
const { createBooking, startRental } = require('./services/bookings');
const { returnVehicle } = require('./services/returns');
const { scheduleMaintenance } = require('./services/maintenance');

const vehicles = [
  ['HR26AB1001', 'Maruti', 'Swift', 'hatchback', 1800, 15200],
  ['HR26CD2002', 'Hyundai', 'i20', 'hatchback', 1900, 22100],
  ['HR38EF3003', 'Honda', 'City', 'sedan', 2600, 30500],
  ['HR51GH4004', 'Toyota', 'Innova', 'suv', 4200, 48000],
  ['HR26JK5005', 'Mahindra', 'Thar', 'suv', 4800, 12000],
  ['HR10LM6006', 'Hyundai', 'Creta', 'suv', 3800, 27300],
  ['HR55NP7007', 'Tata', 'Nexon', 'suv', 3000, 9800],
  ['HR26QR8008', 'Maruti', 'Dzire', 'sedan', 2200, 18400]
];

const customers = [
  ['Rohit Sharma', '9810000001', 'rohit@example.com', 'HR0620180001234', '2031-05-20'],
  ['Neha Verma', '9810000002', 'neha@example.com', 'DL0420190004567', '2032-08-14'],
  ['Aman Singh', '9810000003', 'aman@example.com', 'HR2620170007890', '2029-03-01'],
  ['Pooja Yadav', '9810000004', 'pooja@example.com', 'UP1420200002345', '2030-11-30'],
  ['Karan Mehta', '9810000005', 'karan@example.com', 'RJ1420160006789', '2028-01-15'],
  // this license expires soon, good for testing the license check
  ['Simran Kaur', '9810000006', 'simran@example.com', 'PB0820150003210', '2026-12-10']
];

const history = [
  ['HR26AB1001', 0, -150, 4, 0, 520, 0],
  ['HR26AB1001', 2, -120, 7, 0, 980, 0],
  ['HR26AB1001', 1, -60, 3, 1, 410, 1500],
  ['HR26CD2002', 1, -140, 5, 0, 700, 0],
  ['HR26CD2002', 3, -90, 2, 0, 260, 0],
  ['HR26CD2002', 4, -45, 6, 2, 880, 0],
  ['HR38EF3003', 2, -130, 3, 0, 390, 0],
  ['HR38EF3003', 4, -75, 10, 0, 1500, 0],
  ['HR38EF3003', 0, -30, 4, 0, 540, 3000],
  ['HR51GH4004', 3, -110, 8, 0, 1300, 0],
  ['HR51GH4004', 4, -50, 5, 1, 900, 0],
  ['HR26JK5005', 1, -95, 3, 0, 300, 5000],
  ['HR26JK5005', 0, -40, 4, 0, 480, 0],
  ['HR10LM6006', 1, -85, 6, 0, 840, 0],
  ['HR10LM6006', 2, -25, 3, 0, 350, 0],
  ['HR55NP7007', 3, -70, 5, 0, 650, 0],
  ['HR26QR8008', 4, -20, 4, 0, 500, 0]
];

async function seed() {
  const db = await connect();
  await db.dropDatabase();
  await setup();

  for (const v of vehicles) {
    await addVehicle({ regNo: v[0], make: v[1], model: v[2], type: v[3], dailyRate: v[4], odometer: v[5] });
  }
  for (const c of customers) {
    await addCustomer({ name: c[0], phone: c[1], email: c[2], licenseNo: c[3], licenseExpiry: parseDate(c[4]) });
  }

  const t = today();
  const emails = customers.map(c => c[2]);

 
  history.sort((a, b) => a[2] - b[2]);

  for (const h of history) {
    const start = addDays(t, h[2]);
    const end = addDays(start, h[3]);
    const returnDate = addDays(end, h[4]);

    const { booking } = await createBooking({ regNo: h[0], email: emails[h[1]], startDate: start, endDate: end });
    await startRental(booking.bookingNo, 'cash', start);

    const vehicle = await db.collection('vehicles').findOne({ regNo: h[0] });
    await returnVehicle({
      bookingNo: booking.bookingNo,
      returnDate: returnDate,
      endOdometer: vehicle.odometer + h[5],
      damageCharge: h[6],
      method: 'upi'
    });
  }

 
  const now = await createBooking({
    regNo: 'HR55NP7007', email: emails[5], startDate: addDays(t, -2), endDate: addDays(t, 3)
  });
  await startRental(now.booking.bookingNo, 'card', addDays(t, -2));

  await createBooking({ regNo: 'HR26QR8008', email: emails[1], startDate: addDays(t, 5), endDate: addDays(t, 8) });
  await createBooking({ regNo: 'HR26AB1001', email: emails[4], startDate: addDays(t, 10), endDate: addDays(t, 15) });

  
  await db.collection('maintenance').insertMany([
    {
      maintenanceNo: await nextNumber(db, 'maintenance', 'MNT-'),
      vehicleId: (await db.collection('vehicles').findOne({ regNo: 'HR26CD2002' }))._id,
      type: 'service', description: 'Regular service and oil change',
      startDate: addDays(t, -100), endDate: addDays(t, -98), cost: 3500, status: 'done'
    },
    {
      maintenanceNo: await nextNumber(db, 'maintenance', 'MNT-'),
      vehicleId: (await db.collection('vehicles').findOne({ regNo: 'HR38EF3003' }))._id,
      type: 'repair', description: 'Bumper repair and paint',
      startDate: addDays(t, -62), endDate: addDays(t, -59), cost: 6200, status: 'done'
    }
  ]);

 
  await scheduleMaintenance({
    regNo: 'HR10LM6006', type: 'inspection', description: 'Yearly inspection',
    startDate: addDays(t, 20), endDate: addDays(t, 22)
  });

  console.log('Sample data loaded.');
}

seed()
  .catch(err => console.error('Seeding failed:', err.message))
  .finally(() => close());
