const cron = require('node-cron');
const WebSocket = require('ws');
const { upsertLedgerEntry, upsertChannel } = require('./prisma');

console.log('upsertLedgerEntry:', upsertLedgerEntry);
console.log('upsertChannel:', upsertChannel);

const WSS_URL = 'wss://canarynet.yellow.com/ws';

let ws;

// Function to initialize WebSocket connection
function initializeWebSocket() {
  ws = new WebSocket(WSS_URL);

  ws.on('open', () => {
    console.log('Connected to WSS');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Message received from WSS:', message);
    } catch (error) {
      console.error('Error parsing message from WSS:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed. Reconnecting...');
    setTimeout(initializeWebSocket, 5000); // Reconnect after 5 seconds
  });
}

// Function to send a message through WebSocket
function sendMessage(message, callback) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('Sending message:', message);
    ws.send(JSON.stringify(message));

    ws.once('message', (data) => {
      console.log('Response received for message:', data.toString());
      try {
        const parsedData = JSON.parse(data.toString());
        console.log('Parsed response:', parsedData);
        callback(parsedData);
      } catch (error) {
        console.error('Error parsing response from WSS:', error);
      }
    });
  } else {
    console.error('WebSocket is not connected. Message not sent.');
  }
}

function processLedgerEntries(data) {
  console.log('Processing ledger entries:', JSON.stringify(data, null, 2));

  // Check if the data is an array
  if (Array.isArray(data)) {
    data.forEach(async (entry) => {
      console.log('Upserting ledger entry:', entry);

      // Ensure the entry has a unique identifier (e.g., id)
      if (!entry.id) {
        console.error('Ledger entry is missing a unique identifier:', entry);
        return; // Skip this entry
      }

      try {
        await upsertLedgerEntry({
          where: { id: entry.id }, // Use the unique identifier
          create: entry,          // Data to create if it doesn't exist
          update: entry,          // Data to update if it exists
        });
      } catch (error) {
        console.error('Error upserting ledger entry:', error);
      }
    });
  } else {
    console.error('Unexpected ledger entries structure:', JSON.stringify(data, null, 2));
  }
}

function processChannels(data) {
  console.log('Processing channels:', data);

  // Check if the response contains the expected structure
  if (data && data.res && Array.isArray(data.res[2])) {
    const channels = data.res[2]; // Extract the array of channels
    channels.forEach(async (channel) => {
      console.log('Upserting channel:', channel);
      try {
        await upsertChannel(channel); // Save each channel to the database
      } catch (error) {
        console.error('Error upserting channel:', error);
      }
    });
  } else {
    console.error('Unexpected channels structure:', data);
  }
}

// Messages for the WebSocket
const ledgerMessage = {
  req: [1, 'get_ledger_entries', [], Date.now()],
  sig: ['0xd2efd06ffa63037547b897a4590db52307e8de45d961df1ab6796e321e37a13e7dc42bf4885d72ce1a2ff52186bc3be25d814a73859b4644d8ea368948249b3d00'],
};

const channelMessage = {
  req: [1, 'get_channels', [], Date.now()],
  sig: ['0x853b49719ccd142296dc3b3f215ec6a3c4d93f3719fc1f62b18fc9031375d4200db3855d1b749f2e74839c2236bc6158776e2564d2942240aad2ed48655c977e00'],
};

// Schedule cron jobs
cron.schedule('*/1 * * * *', () => {
  console.log('Running cron job for ledger entries...');
  sendMessage(ledgerMessage, processLedgerEntries);
});

// Initialize WebSocket connection
initializeWebSocket();

// Ping WebSocket every 30 seconds
setInterval(() => {
  console.log('Pinging WebSocket for ledger entries...');
  sendMessage(ledgerMessage, processLedgerEntries);
}, 30000); // 30 seconds in milliseconds