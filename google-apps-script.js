function doGet(e) {
  var route = e.parameter.route;
  var location = e.parameter.location;
  
  // Handle CORS preflight for GET requests if necessary (GAS handles actual preflight automatically)
  
  if (route === "latest") {
    var data = getLatestReport(location);
    if (!data) {
      data = { status: "empty", created_at: new Date().toISOString(), chargingPorts: 0, location: location || "Default store" };
    }
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (route === "validate-table") {
    var code = e.parameter.code;
    var valid = validateTable(code, location);
    return ContentService.createTextOutput(JSON.stringify({ valid: valid })).setMimeType(ContentService.MimeType.JSON);
  }

  if (route === "get-seats") {
    var seats = getAllSeats();
    return ContentService.createTextOutput(JSON.stringify(seats)).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown route" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var route = e.parameter.route;
  var body = {};
  
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid JSON body" })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (route === "report") {
    var result = saveReport(body.status, body.chargingPorts, body.location);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (route === "register-franchise") {
    var result = registerFranchise(body);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (route === "order") {
    var result = placeOrder(body.tableCode, body.orderText, body.location);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  if (route === "update-seat") {
    var result = updateSeatStatus(body.seatId, body.status);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown route" })).setMimeType(ContentService.MimeType.JSON);
}

// --- Helper Functions to interact with Spreadsheet ---

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function saveReport(status, chargingPorts, location) {
  var sheet = getSheet("Reports");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Location", "Status", "ChargingPorts"]);
  }
  sheet.appendRow([new Date().toISOString(), location || "Default store", status, chargingPorts || 0]);
  return { success: true };
}

function getLatestReport(location) {
  var sheet = getSheet("Reports");
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  
  var data = sheet.getDataRange().getValues();
  var targetLocation = location || "Default store";
  
  // Search from bottom up for the latest entry for this location
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === targetLocation) {
      return {
        created_at: data[i][0],
        location: data[i][1],
        status: data[i][2],
        chargingPorts: Number(data[i][3]) || 0
      };
    }
  }
  return null;
}

function registerFranchise(payload) {
  var sheet = getSheet("Franchises");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Name", "Location", "Seats", "ChargingStations", "OpenTimes"]);
  }
  sheet.appendRow([
    new Date().toISOString(),
    payload.name || "",
    payload.location || "",
    payload.seats || 0,
    payload.chargingStations || 0,
    payload.openTimes || ""
  ]);
  return { success: true };
}

function validateTable(code, location) {
  // Simple validation logic. In a real scenario, you could check a "Tables" sheet.
  // We'll return true if code is provided.
  if (!code) return false;
  return true;
}

function placeOrder(tableCode, orderText, location) {
  var sheet = getSheet("Orders");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Location", "TableCode", "OrderText"]);
  }
  sheet.appendRow([new Date().toISOString(), location || "Default store", tableCode || "", orderText || ""]);
  return { success: true };
}

function updateSeatStatus(seatId, status) {
  var sheet = getSheet("Seats");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["seatId", "status", "lastUpdated"]);
  }
  
  var data = sheet.getDataRange().getValues();
  var found = false;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(seatId)) {
      sheet.getRange(i + 1, 2).setValue(status);
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([seatId, status, new Date().toISOString()]);
  }
  
  return { success: true };
}

function getAllSeats() {
  var sheet = getSheet("Seats");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["seatId", "status", "lastUpdated"]);
  }
  
  var data = sheet.getDataRange().getValues();
  var seats = [];
  
  for (var i = 1; i < data.length; i++) {
    seats.push({
      seatId: data[i][0],
      status: data[i][1],
      lastUpdated: data[i][2]
    });
  }
  
  return seats;
}
