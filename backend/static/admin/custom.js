let currentFilters = {
    start_date: null,
    end_date: null,
    preset: '7'
};

let charts = {};
let chartsLoaded = {};

// Initialize flatpickr
flatpickr("#dateRangePicker", {
    mode: "range",
    dateFormat: "Y-m-d",
    maxDate: "today",
    onChange: function(selectedDates, dateStr, instance) {
        if (selectedDates.length === 2) {
            currentFilters.start_date = instance.formatDate(selectedDates[0], "Y-m-d");
            currentFilters.end_date = instance.formatDate(selectedDates[1], "Y-m-d");
            currentFilters.preset = null;
            
            // Update preset badges
            document.querySelectorAll('.preset-badge').forEach(b => b.classList.remove('active'));
        }
    }
});

// Preset handlers
document.querySelectorAll('.preset-badge').forEach(badge => {
    badge.addEventListener('click', function() {
        document.querySelectorAll('.preset-badge').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const preset = this.dataset.preset;
        currentFilters.preset = preset;
        currentFilters.start_date = null;
        currentFilters.end_date = null;
        
        // Update date picker display
        const endDate = new Date();
        let startDate = new Date();
        
        if (preset === '7') {
            startDate.setDate(endDate.getDate() - 7);
        } else if (preset === '30') {
            startDate.setDate(endDate.getDate() - 30);
        } else if (preset === '90') {
            startDate.setDate(endDate.getDate() - 90);
        } else if (preset === 'month') {
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        } else if (preset === 'year') {
            startDate = new Date(endDate.getFullYear(), 0, 1);
        }
        
        document.getElementById('dateRangePicker')._flatpickr.setDate([startDate, endDate]);
    });
});

// Show/hide chart controls based on active tab
document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', function(e) {
        const targetId = e.target.getAttribute('data-bs-target').replace('#', '');
        
        // Hide all controls
        document.querySelectorAll('.chart-controls').forEach(c => c.style.display = 'none');
        
        // Show controls for current tab
        if (targetId === 'bookingsTab') {
            document.getElementById('bookingsControls').style.display = 'flex';
        } else if (targetId === 'revenueTab') {
            document.getElementById('revenueControls').style.display = 'flex';
        } else if (targetId === 'moviesTab') {
            document.getElementById('moviesControls').style.display = 'flex';
        } else if (targetId === 'timeTab') {
            document.getElementById('timeControls').style.display = 'flex';
        }
        
        loadChart(targetId);
    });
});

// Toggle data tables
document.querySelectorAll('.toggle-table-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const chartName = this.dataset.chart;
        const tableId = chartName + 'Table';
        
        if (document.getElementById(tableId).style.display === 'none') {
            document.getElementById(tableId).style.display = 'block';
            this.textContent = 'Hide Data Table';
        } else {
            document.getElementById(tableId).style.display = 'none';
            this.textContent = 'Show Data Table';
        }
    });
});

// Apply filters
document.getElementById('applyFilters').addEventListener('click', function() {
    showLoading();
    
    // Build filter params
    let params = buildFilterParams();
    
    // Update KPIs
    fetch(`/admin/api/kpis/?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('kpiUsers').dataset.value = data.users;
            document.getElementById('kpiMovies').dataset.value = data.movies;
            document.getElementById('kpiBookings').dataset.value = data.bookings;
            document.getElementById('kpiRevenue').dataset.value = data.revenue;
            
            // Animate KPIs
            animateKPIs();
        });
    
    // Reload all charts
    chartsLoaded = {};
    loadChart(document.querySelector('.tab-pane.active').id);
    hideLoading();
});

// Chart loading functions
function loadChart(tabId) {
    if(chartsLoaded[tabId]) return;
    
    if(tabId === "bookingsTab") {
        loadBookingsChart();
    } else if(tabId === "revenueTab") {
        loadRevenueChart();
    } else if(tabId === "moviesTab") {
        loadMoviesChart();
    } else if(tabId === "timeTab") {
        loadTimeRangeChart();
    }
    
    chartsLoaded[tabId] = true;
}

function loadBookingsChart() {
    showLoading();
    
    let params = buildFilterParams();
    params.append('group_by', document.getElementById('bookingsGroupBy').value);
    
    fetch(`/admin/api/bookings-trend/?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            const ctx = document.getElementById('bookingChart').getContext('2d');
            
            if (charts.booking) charts.booking.destroy();
            
            charts.booking = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.period),
                    datasets: [{
                        label: 'Number of Bookings',
                        data: data.map(d => d.bookings),
                        backgroundColor: 'rgba(37, 117, 252, 0.7)',
                        borderColor: '#2575fc',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: 'Bookings Trend' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
            
            // Update data table
            updateDataTable('bookings', data, ['period', 'bookings']);
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading bookings chart:', error);
            hideLoading();
        });
}

function loadRevenueChart() {
    showLoading();
    
    let params = buildFilterParams();
    params.append('group_by', document.getElementById('revenueGroupBy').value);
    params.append('compare', document.getElementById('revenueCompare').checked);
    
    fetch(`/admin/api/revenue-trend/?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            const ctx = document.getElementById('revenueChart').getContext('2d');
            
            if (charts.revenue) charts.revenue.destroy();
            
            let datasets = [];
            let labels = [];
            
            if (data.current) {
                // Comparison mode
                labels = data.current.map(d => d.period);
                datasets.push({
                    label: 'Current Period',
                    data: data.current.map(d => d.revenue),
                    borderColor: '#2575fc',
                    backgroundColor: 'rgba(37, 117, 252, 0.1)',
                    tension: 0.4,
                    fill: true
                });
                
                datasets.push({
                    label: 'Previous Period',
                    data: data.previous.map(d => d.revenue),
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: true
                });
                
                updateDataTable('revenue', data.current, ['period', 'revenue']);
            } else {
                // Normal mode
                labels = data.map(d => d.period);
                datasets.push({
                    label: 'Revenue (VND)',
                    data: data.map(d => d.revenue),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                });
                
                updateDataTable('revenue', data, ['period', 'revenue']);
            }
            
            charts.revenue = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: { display: true, text: 'Revenue Trend' }
                    },
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return new Intl.NumberFormat('vi-VN', { 
                                        style: 'currency', 
                                        currency: 'VND' 
                                    }).format(value);
                                }
                            }
                        }
                    }
                }
            });
            
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading revenue chart:', error);
            hideLoading();
        });
}

function loadMoviesChart() {
    showLoading();
    
    let params = buildFilterParams();
    const topN = document.getElementById('topMoviesCount').value;
    params.append('top_n', topN);
    
    fetch(`/admin/api/top-movies/?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            const ctx = document.getElementById('topMoviesChart').getContext('2d');
            
            if (charts.movies) charts.movies.destroy();
            
            charts.movies = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.movie),
                    datasets: [{
                        label: 'Tickets Sold',
                        data: data.map(d => d.tickets_sold),
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.7)',
                            'rgba(54, 162, 235, 0.7)',
                            'rgba(255, 206, 86, 0.7)',
                            'rgba(75, 192, 192, 0.7)',
                            'rgba(153, 102, 255, 0.7)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    maintainAspectRatio: true,
                    plugins: {
                        title: { display: true, text: `Top ${topN} Movies by Tickets Sold` }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
            
            updateDataTable('movies', data, ['movie', 'tickets_sold', 'revenue']);
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading movies chart:', error);
            hideLoading();
        });
}

function loadTimeRangeChart() {
    showLoading();
    
    let params = buildFilterParams();
    
    fetch(`/admin/api/tickets-by-time-range/?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            const ctx = document.getElementById('timeRangeChart').getContext('2d');
            
            if (charts.time) charts.time.destroy();
            
            // Store percentages for legend
            const percentages = data.data.map(d => d.percentage);
            
            charts.time = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.data.map(d => d.time_range),
                    datasets: [{
                        data: data.data.map(d => d.tickets_sold),
                        backgroundColor: [
                            'rgba(255, 159, 64, 0.7)',
                            'rgba(54, 162, 235, 0.7)',
                            'rgba(75, 192, 192, 0.7)',
                            'rgba(153, 102, 255, 0.7)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                font: { size: 12 },
                                generateLabels: (chart) => {
                                    const data = chart.data;
                                    return data.labels.map((label, i) => ({
                                        text: `${label} (${percentages[i]}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: false,
                                        index: i
                                    }));
                                }
                            }
                        },
                        title: { 
                            display: true, 
                            text: 'Ticket Distribution by Time Range' 
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const item = data.data[context.dataIndex];
                                    return [
                                        `Tickets: ${item.tickets_sold} (${item.percentage}%)`,
                                        `Revenue: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.revenue)}`
                                    ];
                                }
                            }
                        }
                    }
                }
            });
            
            updateDataTable('time', data.data, ['time_range', 'tickets_sold', 'percentage', 'revenue', 'avg_ticket_price']);
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading time range chart:', error);
            hideLoading();
        });
}

// Helper functions
function buildFilterParams() {
    let params = new URLSearchParams();
    
    const datePicker = document.getElementById('dateRangePicker');
    if (datePicker._flatpickr && datePicker._flatpickr.selectedDates.length === 2) {
        params.append('start_date', datePicker._flatpickr.formatDate(datePicker._flatpickr.selectedDates[0], "Y-m-d"));
        params.append('end_date', datePicker._flatpickr.formatDate(datePicker._flatpickr.selectedDates[1], "Y-m-d"));
    } else {
        // Use preset
        const endDate = new Date();
        let startDate = new Date();
        
        if (currentFilters.preset === '7') {
            startDate.setDate(endDate.getDate() - 7);
        } else if (currentFilters.preset === '30') {
            startDate.setDate(endDate.getDate() - 30);
        } else if (currentFilters.preset === '90') {
            startDate.setDate(endDate.getDate() - 90);
        } else if (currentFilters.preset === 'month') {
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        } else if (currentFilters.preset === 'year') {
            startDate = new Date(endDate.getFullYear(), 0, 1);
        } else {
            startDate.setDate(endDate.getDate() - 7);
        }
        
        params.append('start_date', startDate.toISOString().split('T')[0]);
        params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    
    return params;
}

function updateDataTable(chartName, data, columns) {
    const tableDiv = document.getElementById(chartName + 'Table');
    if (!tableDiv) return;
    
    let html = '<table><thead><tr>';
    
    // Headers
    columns.forEach(col => {
        html += `<th>${col.replace('_', ' ').toUpperCase()}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Data rows
    data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            let value = row[col];
            if (col === 'revenue' || col === 'avg_ticket_price') {
                value = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
            } else if (col === 'percentage') {
                value = value + '%';
            }
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function animateKPIs() {
    const vnd = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    });
    
    document.querySelectorAll(".kpi").forEach(el => {
        let value = parseInt(el.dataset.value);
        let count = 0;
        const step = Math.ceil(value / 50);
        
        const interval = setInterval(() => {
            count += step;
            if (count >= value) {
                count = value;
                clearInterval(interval);
            }
            
            if(el.id === 'kpiRevenue'){
                el.innerText = vnd.format(count);
            } else {
                el.innerText = count.toLocaleString();
            }
        }, 20);
    });
}

// Event listeners for chart controls
document.getElementById('bookingsGroupBy').addEventListener('change', function() {
    chartsLoaded.bookingsTab = false;
    loadChart('bookingsTab');
});

document.getElementById('revenueGroupBy').addEventListener('change', function() {
    chartsLoaded.revenueTab = false;
    loadChart('revenueTab');
});

document.getElementById('revenueCompare').addEventListener('change', function() {
    chartsLoaded.revenueTab = false;
    loadChart('revenueTab');
});

document.getElementById('topMoviesCount').addEventListener('input', function() {
    document.getElementById('topMoviesCountDisplay').textContent = this.value;
    chartsLoaded.moviesTab = false;
    loadChart('moviesTab');
});

// Initial load
document.addEventListener('DOMContentLoaded', function() {
    loadChart("bookingsTab");
    animateKPIs();
});

// Improved chart capture function with better timing and error handling
// Improved chart capture function with better timing and error handling
function captureChartsAsImages() {
    return new Promise((resolve) => {
        console.log('Starting chart capture...');
        
        // Force all charts to render properly
        setTimeout(() => {
            const chartConfigs = {
                bookings: { id: 'bookingChart', key: 'bookings' },
                revenue: { id: 'revenueChart', key: 'revenue' },
                movies: { id: 'topMoviesChart', key: 'movies' },
                time: { id: 'timeRangeChart', key: 'time' }
            };
            
            const images = {};
            let capturedCount = 0;
            const totalCharts = Object.keys(chartConfigs).length;
            
            for (const [configKey, config] of Object.entries(chartConfigs)) {
                const canvas = document.getElementById(config.id);
                
                if (canvas) {
                    try {
                        console.log(`Capturing ${config.id}...`);
                        
                        // Make sure canvas has content
                        if (canvas.width === 0 || canvas.height === 0) {
                            console.warn(`Canvas ${config.id} has zero dimensions`);
                        }
                        
                        // Convert canvas to Base64 PNG with high quality
                        const dataUrl = canvas.toDataURL('image/png', 1.0);
                        
                        // Verify it's a valid data URL
                        if (dataUrl && dataUrl.startsWith('data:image/png')) {
                            images[config.key] = dataUrl;
                            console.log(`✓ Captured ${config.key} chart (${dataUrl.length} chars)`);
                        } else {
                            console.warn(`Invalid data URL for ${config.key}`);
                        }
                        
                    } catch (e) {
                        console.error(`Error capturing ${config.key} chart:`, e);
                    }
                } else {
                    console.warn(`Canvas ${config.id} not found`);
                }
                
                capturedCount++;
            }
            
            console.log(`Captured ${Object.keys(images).length}/${totalCharts} charts`);
            resolve(images);
            
        }, 1500); // Wait 1.5 seconds for charts to be fully rendered
    });
}

// PDF Export Function
document.getElementById('exportPDF').addEventListener('click', async function() {
    showLoading();
    
    try {
        console.log('Starting PDF export...');
        
        // First, ensure all charts are loaded by cycling through tabs
        const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
        const activeTab = document.querySelector('.tab-pane.show').id;
        
        console.log('Active tab:', activeTab);
        
        // Temporarily visit each tab to ensure charts are rendered
        for (const tab of tabs) {
            const targetId = tab.getAttribute('data-bs-target').replace('#', '');
            if (targetId !== activeTab) {
                console.log(`Switching to tab: ${targetId}`);
                // Click tab to load chart
                tab.click();
                // Wait for chart to render
                await new Promise(r => setTimeout(r, 800));
            }
        }
        
        // Return to original tab
        console.log(`Returning to original tab: ${activeTab}`);
        document.querySelector(`[data-bs-target="#${activeTab}"]`).click();
        await new Promise(r => setTimeout(r, 800));
        
        // Now capture all charts
        console.log('Capturing charts...');
        const chartImages = await captureChartsAsImages();
        
        // Verify we have all charts
        console.log('Captured images:', Object.keys(chartImages));
        
        if (Object.keys(chartImages).length === 0) {
            throw new Error('No charts were captured');
        }
        
        // Get current KPIs
        const kpis = {
            users: document.getElementById('kpiUsers').dataset.value,
            movies: document.getElementById('kpiMovies').dataset.value,
            bookings: document.getElementById('kpiBookings').dataset.value,
            revenue: document.getElementById('kpiRevenue').dataset.value
        };
        
        console.log('KPIs:', kpis);
        
        // Build filter params
        let params = buildFilterParams();
        console.log('Filter params:', params.toString());
        
        // Get CSRF token
        const csrftoken = getCookie('csrftoken');
        if (!csrftoken) {
            console.warn('CSRF token not found, but might still work if CSRF exempt');
        }
        
        // Send to server with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(`/admin/api/export-pdf/?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken || ''
            },
            body: JSON.stringify({
                chart_images: chartImages,
                kpis: kpis
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            let errorMessage = `Server returned ${response.status}: ${response.statusText}`;
            try {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                errorMessage += `\n${errorText}`;
            } catch (e) {
                // Ignore if can't read error text
            }
            throw new Error(errorMessage);
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
            const text = await response.text();
            console.error('Unexpected response type:', contentType);
            console.error('Response content:', text.substring(0, 200));
            throw new Error('Server did not return a PDF');
        }
        
        // Download PDF
        const blob = await response.blob();
        console.log('PDF blob size:', blob.size);
        
        if (blob.size === 0) {
            throw new Error('Generated PDF is empty');
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get date range for filename
        const datePicker = document.getElementById('dateRangePicker');
        let filename = 'cinereport';
        if (datePicker._flatpickr && datePicker._flatpickr.selectedDates.length === 2) {
            const start = datePicker._flatpickr.formatDate(datePicker._flatpickr.selectedDates[0], "YYYY-MM-DD");
            const end = datePicker._flatpickr.formatDate(datePicker._flatpickr.selectedDates[1], "YYYY-MM-DD");
            filename = `cinereport_${start}_to_${end}.pdf`;
        } else {
            const today = new Date().toISOString().split('T')[0];
            filename = `cinereport_${today}.pdf`;
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('PDF download initiated successfully');
        
    } catch (error) {
        console.error('PDF export failed:', error);
        
        // Show user-friendly error message
        let userMessage = 'Failed to generate PDF. ';
        if (error.name === 'AbortError') {
            userMessage += 'Request timed out. Please try again.';
        } else if (error.message.includes('Failed to fetch')) {
            userMessage += 'Network error. Check your connection.';
        } else {
            userMessage += error.message;
        }
        
        alert(userMessage);
    } finally {
        hideLoading();
    }
});