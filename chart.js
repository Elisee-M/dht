// Firebase configuration with enhanced error handling
const firebaseConfig = {
  databaseURL: "https://dht11-af095-default-rtdb.firebaseio.com"
};

try {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
  
  // Enable persistence with error handling
  firebase.database().setPersistenceEnabled(true)
    .then(() => console.log("Persistence enabled"))
    .catch(err => console.error("Persistence error:", err));
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

const database = firebase.database();

// Chart configuration with performance optimizations
const chartConfig = {
  maxPoints: 200, // Optimal balance between detail and performance
  samplingIntervals: {
    '1': 5 * 60 * 1000,    // 5 minutes for 1 day
    '3': 15 * 60 * 1000,   // 15 minutes for 3 days
    '7': 30 * 60 * 1000,   // 30 minutes for 7 days
    '30': 60 * 60 * 1000   // 1 hour for 30 days
  }
};

// Initialize charts with error boundaries
function initCharts() {
  try {
    const tempCtx = document.getElementById('temp-chart');
    const humCtx = document.getElementById('hum-chart');
    
    if (!tempCtx || !humCtx) {
      throw new Error("Chart canvases not found");
    }

    // Destroy existing charts if they exist
    if (window.tempChart) window.tempChart.destroy();
    if (window.humChart) window.humChart.destroy();

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}${ctx.dataset.label.includes('Temp') ? '°C' : '%'}`
          }
        }
      },
      elements: {
        point: { radius: 2, hoverRadius: 5 },
        line: { tension: 0.1, borderWidth: 2 }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'MMM d, h:mm a',
            unit: 'hour',
            displayFormats: { hour: 'ha', day: 'MMM d' }
          }
        },
        y: { beginAtZero: false }
      }
    };

    window.tempChart = new Chart(tempCtx, {
      type: 'line',
      data: { datasets: [{
        label: 'Temperature (°C)',
        borderColor: '#ff8c42',
        backgroundColor: 'rgba(255, 140, 66, 0.1)',
        fill: true,
        data: []
      }]},
      options: commonOptions
    });

    window.humChart = new Chart(humCtx, {
      type: 'line',
      data: { datasets: [{
        label: 'Humidity (%)',
        borderColor: '#3ec1d3',
        backgroundColor: 'rgba(62, 193, 211, 0.1)',
        fill: true,
        data: []
      }]},
      options: {
        ...commonOptions,
        scales: { ...commonOptions.scales, y: { min: 0, max: 100 } }
      }
    });

    console.log("Charts initialized successfully");
  } catch (error) {
    console.error("Chart initialization failed:", error);
    showError("Failed to initialize charts. Please refresh.");
  }
}

// Data processing with smart sampling
function processData(rawData, days) {
  try {
    if (!rawData) return { tempData: [], humData: [] };

    const interval = chartConfig.samplingIntervals[days] || chartConfig.samplingIntervals['7'];
    const tempData = [], humData = [];
    let lastSampleTime = 0;

    Object.entries(rawData)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0])) // Sort by timestamp
      .forEach(([timestamp, values]) => {
        const currentTime = parseInt(timestamp);
        if (currentTime - lastSampleTime >= interval || lastSampleTime === 0) {
          tempData.push({ x: currentTime, y: values.Temperature });
          humData.push({ x: currentTime, y: values.Humidity });
          lastSampleTime = currentTime;
        }
      });

    return { tempData, humData };
  } catch (error) {
    console.error("Data processing error:", error);
    return { tempData: [], humData: [] };
  }
}

// Data loading with progress feedback
async function loadData(days) {
  showLoading(`Loading ${days} day${days !== 1 ? 's' : ''} of data...`);
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    console.log(`Fetching data from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
    const snapshot = await database.ref('DHT11/history')
      .orderByKey()
      .startAt(startDate.getTime().toString())
      .endAt(endDate.getTime().toString())
      .once('value');

    if (!snapshot.exists()) {
      showError("No historical data found");
      return;
    }

    const { tempData, humData } = processData(snapshot.val(), days);
    
    updateCharts(tempData, humData);
    console.log(`Loaded ${tempData.length} data points`);
  } catch (error) {
    console.error("Data load error:", error);
    showError("Failed to load data. Please try again.");
  } finally {
    hideLoading();
  }
}

// Chart updating with performance optimization
function updateCharts(tempData, humData) {
  try {
    if (tempData.length > 0) {
      window.tempChart.data.datasets[0].data = tempData;
      window.tempChart.update('none');
    }
    
    if (humData.length > 0) {
      window.humChart.data.datasets[0].data = humData;
      window.humChart.update('none');
    }
  } catch (error) {
    console.error("Chart update error:", error);
  }
}

// UI Helpers with enhanced feedback
function showLoading(message = 'Loading...') {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.textContent = message;
    loadingEl.style.display = 'block';
  }
}

function hideLoading() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

// Initialize with error handling
document.addEventListener('DOMContentLoaded', () => {
  try {
    initCharts();
    
    // Time range selector
    const timeRange = document.getElementById('time-range');
    if (timeRange) {
      timeRange.addEventListener('change', () => {
        const days = parseInt(timeRange.value);
        loadData(days);
      });
    }

    // Back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // Load initial data
    loadData(1);
  } catch (error) {
    console.error("Initialization error:", error);
    showError("Application failed to initialize. Please refresh.");
  }
});

// Debug helper to check Firebase connection
function checkFirebaseConnection() {
  firebase.database().ref('.info/connected').on('value', (snapshot) => {
    console.log("Firebase connection state:", snapshot.val() ? "Connected" : "Disconnected");
  });
}

// Uncomment to debug Firebase connection
// checkFirebaseConnection();