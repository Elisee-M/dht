// Firebase configuration
const firebaseConfig = {
    databaseURL: "https://dht11-af095-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Connection monitoring elements
const firebaseStatus = document.getElementById('firebase-status').querySelector('.status-dot');
const boardStatus = document.getElementById('board-status').querySelector('.status-dot');
const connectionStatusDiv = document.querySelector('.connection-status');

// Board connection variables
let lastUpdateTime = 0;
const BOARD_TIMEOUT = 15000; // 15 seconds timeout
let boardDisconnectTimer;
let isBoardConnected = false;

// History reference
const historyRef = database.ref('DHT11/history');

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return "Never updated";
    const date = new Date(timestamp);
    return `Last updated: ${date.toLocaleTimeString()}`;
}

// Save data to history
function saveToHistory(temperature, humidity) {
    const timestamp = Date.now();
    historyRef.child(timestamp).set({
        Temperature: parseFloat(temperature),
        Humidity: parseFloat(humidity)
    });
}

// Check board connection status
function checkBoardConnection() {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateTime;
    
    if (timeDiff > BOARD_TIMEOUT && isBoardConnected) {
        setBoardDisconnected();
    }
}

function setBoardConnected() {
    isBoardConnected = true;
    boardStatus.classList.add('connected');
    boardStatus.classList.remove('disconnected', 'connecting');
    connectionStatusDiv.classList.remove('disconnected');
    console.log('Board connected');
}

function setBoardDisconnected() {
    isBoardConnected = false;
    boardStatus.classList.add('disconnected');
    boardStatus.classList.remove('connected', 'connecting');
    connectionStatusDiv.classList.add('disconnected');
    console.warn('Board disconnected');
}

function setBoardConnecting() {
    boardStatus.classList.add('connecting');
    boardStatus.classList.remove('connected', 'disconnected');
    console.log('Board connecting...');
}

// Update data and connection status
function updateData(snapshot, elementId, timeElementId) {
    const value = snapshot.val();
    const element = document.getElementById(elementId);
    const timeElement = document.getElementById(timeElementId);
    
    // Update last update time
    lastUpdateTime = Date.now();
    clearTimeout(boardDisconnectTimer);
    boardDisconnectTimer = setTimeout(checkBoardConnection, BOARD_TIMEOUT);
    
    if (!isBoardConnected) {
        setBoardConnected();
    }
    
    if (value !== null) {
        const numericValue = parseFloat(value);
        element.innerHTML = `${numericValue.toFixed(1)}<span class="unit">${elementId === 'temperature' ? '°C' : '%'}</span>`;
        timeElement.textContent = formatTime(lastUpdateTime);
        
        // Save to history when temperature updates
        if (elementId === 'temperature') {
            const humidity = document.getElementById('humidity').textContent.replace(/[^0-9.]/g, '');
            saveToHistory(value, humidity || 0);
        }
        
        // Add visual feedback on update
        element.style.transform = 'scale(1.1)';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 300);
    } else {
        element.textContent = "Sensor Error";
        timeElement.textContent = "";
    }
}

// Monitor Firebase connection state
database.ref('.info/connected').on('value', (snapshot) => {
    if (snapshot.val() === true) {
        firebaseStatus.classList.add('connected');
        firebaseStatus.classList.remove('disconnected', 'connecting');
        console.log('Firebase connected');
        checkBoardConnection();
    } else {
        firebaseStatus.classList.add('disconnected');
        firebaseStatus.classList.remove('connected', 'connecting');
        console.log('Firebase disconnected');
    }
});

// Set up data listeners
database.ref('DHT11/Temperature').on('value', (snapshot) => {
    updateData(snapshot, 'temperature', 'temp-time');
});

database.ref('DHT11/Humidity').on('value', (snapshot) => {
    updateData(snapshot, 'humidity', 'hum-time');
});

// Monitor heartbeat
database.ref('heartbeat').on('value', (snapshot) => {
    if (snapshot.exists()) {
        const serverTime = Date.now();
        const boardTime = snapshot.val();
        const latency = serverTime - boardTime;
        
        if (latency > BOARD_TIMEOUT && isBoardConnected) {
            setBoardDisconnected();
        } else if (latency <= BOARD_TIMEOUT && !isBoardConnected) {
            setBoardConnected();
        }
    } else if (isBoardConnected) {
        setBoardDisconnected();
    }
});

// Initial state
firebaseStatus.classList.add('connecting');
setBoardConnecting();

// Check connection status periodically
setInterval(checkBoardConnection, 5000);

// Chart button functionality
document.getElementById('chart-btn').addEventListener('click', () => {
    window.location.href = 'chart.html';
});