document.addEventListener('DOMContentLoaded', function() {
    const statusCountsElement = document.getElementById('statusCountsData');
    const statusCounts = JSON.parse(statusCountsElement.dataset.counts);
    const ctx = document.getElementById('statusChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#c23934', '#ff9e9e', '#54698d', '#4bca81', '#04844b',
                    '#ffb75d', '#e0e5ee', '#0070d2', '#eb7092', '#a094ed'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
});
