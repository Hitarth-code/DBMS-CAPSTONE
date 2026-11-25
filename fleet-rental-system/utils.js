const DAY = 24 * 60 * 60 * 1000;


function parseDate(str) {
  const d = new Date(str + 'T00:00:00.000Z');
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date "' + str + '", use YYYY-MM-DD');
  }
  return d;
}

function today() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

function addDays(date, n) {
  return new Date(date.getTime() + n * DAY);
}


function daysBetween(a, b) {
  return Math.max(1, Math.ceil((b - a) / DAY));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '-';
}


async function nextNumber(db, name, prefix) {
  const c = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return prefix + String(c.seq).padStart(4, '0');
}

module.exports = { DAY, parseDate, today, addDays, daysBetween, round2, fmt, nextNumber };
