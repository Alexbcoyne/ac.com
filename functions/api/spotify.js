async function updateCurrentlyPlaying() {
  try {
    const res = await fetch('/api/spotify');
    const data = await res.json();
    const now = data?.nowPlaying;

    const trackEl = document.getElementById('track');
    const albumEl = document.getElementById('albumArt');

    if (now?.playing) {
      trackEl.textContent = `${now.artist} — ${now.title}`;
      albumEl.src = now.albumArt;
    } else {
      trackEl.textContent = "Nothing playing right now";
      albumEl.src = '';
    }
  } catch (err) {
    console.error('Currently Playing Error:', err);
    document.getElementById('track').textContent = "Error loading currently playing";
  }
}

// Initial load and refresh every 15 seconds
updateCurrentlyPlaying();
setInterval(updateCurrentlyPlaying, 15000);
