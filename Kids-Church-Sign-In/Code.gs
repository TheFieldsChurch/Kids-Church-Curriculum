const TIME_ZONE = 'Australia/Sydney';
const REGISTER_HEADERS = ['Child ID', 'Child name', 'Date of birth', 'Age', 'Parent or guardian', 'Contact number', 'Medical notes', 'Archived'];
const ATTENDANCE_HEADERS = ['Service date', 'Child ID', 'Child name', 'Signed in at', 'Signed out at'];

function doGet() {
  requireUser_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Kids Church Sign-In | The Fields Church')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function attendanceRequest(request) {
  requireUser_();
  if (!request || typeof request.action !== 'string') throw new Error('Missing attendance action.');
  const sheetId = PropertiesService.getScriptProperties().getProperty('ATTENDANCE_SPREADSHEET_ID');
  if (!sheetId) throw new Error('The attendance spreadsheet has not been configured.');
  const book = SpreadsheetApp.openById(sheetId);
  const action = request.action;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const register = openTab_(book, 'Kids Church Register', REGISTER_HEADERS);
    const attendance = openTab_(book, 'Kids Church Attendance', ATTENDANCE_HEADERS);
    const now = new Date();
    const day = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd');
    if (action !== 'getAll' && request.day !== day) {
      throw new Error('The service date has changed. Refresh attendance before trying again.');
    }

    let children = readRegister_(register);
    let today = readDay_(attendance, day);
    const id = request.registryId || request.id;
    let child = children.find(entry => entry.id === id && !entry.archived);
    let message = '';

    switch (action) {
      case 'getAll':
        break;
      case 'addChild':
      case 'addAndSignIn': {
        const details = details_(request, day);
        child = children.find(entry => !entry.archived && entry.dob === details.dob &&
          entry.name.toLowerCase() === details.name.toLowerCase() &&
          entry.guardian.toLowerCase() === details.guardian.toLowerCase());
        if (!child) {
          child = { ...details, id: Utilities.getUuid(), archived: false };
          register.appendRow(registerValues_(child));
        } else if (action === 'addChild') {
          throw new Error('This child is already registered. Open their record to edit it.');
        }
        if (action === 'addAndSignIn') signIn_(attendance, today, child, day, now);
        message = child.name + (action === 'addAndSignIn' ? ' signed in.' : ' added to the register.');
        break;
      }
      case 'signIn':
        requireChild_(child);
        signIn_(attendance, today, child, day, now);
        message = child.name + ' signed in.';
        break;
      case 'signOut': {
        requireChild_(child);
        const visit = today.find(entry => entry.registryId === child.id);
        if (!visit) throw new Error('This child has no sign-in for today.');
        if (!visit.out) attendance.getRange(visit.row, 5).setValue(now).setNumberFormat('hh:mm am/pm');
        message = child.name + ' signed out.';
        break;
      }
      case 'updateChild':
        requireChild_(child);
        register.getRange(child.row, 1, 1, REGISTER_HEADERS.length)
          .setValues([registerValues_({ ...child, ...details_(request, day, child) })]);
        message = 'Details saved.';
        break;
      case 'removeChild':
        requireChild_(child);
        if (today.some(entry => entry.registryId === child.id && !entry.out)) {
          throw new Error('Sign this child out before removing them from the register.');
        }
        register.getRange(child.row, 8).setValue(true);
        message = child.name + ' removed from the register.';
        break;
      default:
        throw new Error('Unknown attendance action.');
    }
    if (action !== 'getAll') {
      SpreadsheetApp.flush();
      children = readRegister_(register);
      today = readDay_(attendance, day);
    }
    return snapshot_(children, today, day, message);
  } finally {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}

function requireUser_() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) {
    throw new Error('Open the app with an authorised Google account.');
  }
}

function openTab_(book, name, headers) {
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  const heading = sheet.getRange(1, 1, 1, headers.length);
  if (sheet.getLastRow() === 0) {
    heading.setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  } else if (heading.getValues()[0].some((value, index) => value !== headers[index])) {
    throw new Error('Check the column headings on the ' + name + ' tab.');
  }
  return sheet;
}

function readRegister_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, REGISTER_HEADERS.length).getValues();
  return values.map(([id, name, dob, age, guardian, contact, medical, archived], index) => ({
    row: index + 2,
    id: String(id), name: String(name), dob: dateKey_(dob), age: String(age),
    guardian: String(guardian), contact: String(contact), medical: String(medical),
    archived: archived === true
  })).filter(child => child.id && child.name);
}

function readDay_(sheet, day) {
  if (sheet.getLastRow() < 2) return [];
  const dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1);
  // Search the date column so attendance history can stay in one tab.
  const rows = dates.createTextFinder(day).matchEntireCell(true).findAll()
    .map(cell => cell.getRow()).sort((left, right) => left - right);
  if (!rows.length) return [];
  const first = rows[0];
  const values = sheet.getRange(first, 1, rows[rows.length - 1] - first + 1, ATTENDANCE_HEADERS.length).getValues();
  return rows.map(row => {
    const [, registryId, name, timeIn, timeOut] = values[row - first];
    return {
      row, registryId: String(registryId), name: String(name),
      timeIn: displayTime_(timeIn), timeOut: displayTime_(timeOut), out: !!timeOut
    };
  });
}

function signIn_(sheet, today, child, day, now) {
  const visit = today.find(entry => entry.registryId === child.id);
  if (visit) {
    if (visit.out) throw new Error('This child has already signed out today.');
    return;
  }
  sheet.appendRow([literal_(day), child.id, literal_(child.name), now, '']);
  sheet.getRange(sheet.getLastRow(), 4, 1, 2).setNumberFormat('hh:mm am/pm');
}

function snapshot_(children, today, day, message) {
  const byId = new Map(children.map(({ row, ...child }) => [child.id, child]));
  return {
    success: true, day, message,
    registry: [...byId.values()].filter(child => !child.archived),
    today: today.map(({ row, out, ...visit }) => {
      const child = byId.get(visit.registryId);
      return { ...child, ...visit, status: out ? 'out' : 'in' };
    })
  };
}

function details_(request, day, existing) {
  const name = text_(request.name, 120);
  const dob = text_(request.dob, 10);
  const guardian = text_(request.guardian, 120);
  const contact = text_(request.contact, 50);
  const medical = text_(request.medical, 500);
  if (!name || !guardian || !contact) throw new Error('Enter the child’s name, guardian and contact number.');
  if (dob || !existing || existing.dob) {
    const birthday = new Date(dob + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(birthday.getTime()) ||
        birthday.toISOString().slice(0, 10) !== dob || dob > day) {
      throw new Error('Enter a valid date of birth.');
    }
  }
  const age = dob ? Number(day.slice(0, 4)) - Number(dob.slice(0, 4)) -
    (day.slice(5) < dob.slice(5) ? 1 : 0) : existing.age;
  return { name, dob, age, guardian, contact, medical };
}

function text_(value, maxLength) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length > maxLength) throw new Error('One of the fields is too long.');
  return result;
}

function registerValues_(child) {
  return [child.id, literal_(child.name), literal_(child.dob), child.age,
    literal_(child.guardian), literal_(child.contact), literal_(child.medical), child.archived];
}

function literal_(value) {
  // Force user-entered fields to stay text, including leading zeroes and formula-like names.
  return value ? "'" + value : '';
}

function dateKey_(value) {
  return value instanceof Date ? Utilities.formatDate(value, TIME_ZONE, 'yyyy-MM-dd') : String(value);
}

function displayTime_(value) {
  return value instanceof Date ? Utilities.formatDate(value, TIME_ZONE, 'h:mm a') : String(value);
}

function requireChild_(child) {
  if (!child) throw new Error('This child is no longer in the register. Refresh attendance.');
}
