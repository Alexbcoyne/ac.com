async function updateTopTracks(timeRange = 'short_term') {
  try {
    const res = await fetch(`/api/spotify/top-tracks?time_range=${timeRange}`);
    const data = await res.json();

    const container = document.getElementById('topTracks');
    container.innerHTML = '';

    if (data?.topTracks?.length > 0) {
      data.topTracks.forEach(track => {
        const div = document.createElement('div');
        div.textContent = `${track.name} — ${track.artists}`;
        container.appendChild(div);
      });
    } else {
      container.textContent = 'No top tracks available';
    }
  } catch (err) {
    console.error('Top Tracks Error:', err);
    document.getElementById('topTracks').textContent = "Error loading top tracks";
  }
}

// Handle time range buttons
document.querySelectorAll('#timeRangeButtons button').forEach(btn => {
  btn.addEventListener('click', () => updateTopTracks(btn.dataset.range));
});

// Initial load
updateTopTracks();
