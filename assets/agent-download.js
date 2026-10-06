// The Mac agent's download buttons (/next/, /changelog/).
// 1. The trust line next to a button shows the version and the DMG size of the latest GitHub release.
//    Until they arrive, or if GitHub doesn't answer, the line reads "Free · macOS 15+ · Notarized by Apple".
// 2. On a phone or tablet (html.handheld, set in <head>) the buttons send the download link to the Mac.
(function () {
  // ── Trust line: version and size from the latest release ──
  const API = 'https://api.github.com/repos/zhukovland/desktap-website/releases/latest';
  const CACHE = 'desktap-agent-release';

  function show(release) {
    document.querySelectorAll('[data-release="version"]').forEach(el => {
      el.textContent = release.version;
      if (el.tagName === 'A') el.href = '/changelog/#' + release.version;
      el.closest('[data-release-item]').hidden = false;
    });
    document.querySelectorAll('[data-release="size"]').forEach(el => {
      el.textContent = release.size;
      el.closest('[data-release-item]').hidden = false;
    });
    // On /changelog/: tag the entry of the latest release
    const entry = document.querySelector('[data-release-entry="' + release.version + '"]');
    if (entry) entry.classList.add('is-latest');
  }

  function parse(json) {
    const dmg = (json.assets || []).find(a => /\.dmg$/i.test(a.name));
    if (!json.tag_name || !dmg) return null;
    return {
      version: json.tag_name.startsWith('v') ? json.tag_name : 'v' + json.tag_name,
      // Decimal megabytes, as Finder and Safari show the file
      size: (dmg.size / 1e6).toFixed(1) + ' MB'
    };
  }

  if (document.querySelector('[data-release]')) {
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CACHE)); } catch (e) {}
    if (cached && cached.version && cached.size) {
      show(cached);
    } else {
      fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          const release = json && parse(json);
          if (!release) return;
          show(release);
          try { sessionStorage.setItem(CACHE, JSON.stringify(release)); } catch (e) {}
        })
        .catch(() => {});
    }
  }

  // ── On a phone or tablet: the download buttons send the link to the Mac (share sheet: AirDrop, Messages, Mail…) ──
  if (document.documentElement.classList.contains('handheld')) {
    const url = new URL('/download/', location.href).href;
    const title = 'Desktap Mac Agent';
    const text = 'Open this on your Mac to download the Desktap agent:';
    const mail = () => {
      location.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text + '\n' + url);
    };
    let sharing = false;
    document.querySelectorAll('[data-send-to-mac]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        if (!navigator.share) return mail();
        if (sharing) return;
        sharing = true;
        // Only the link: AirDrop then opens it on the Mac and the download starts. Closing the sheet (AbortError) is
        // a choice, a sheet still open (InvalidStateError) is not a failure either: mail only when sharing can't work.
        navigator.share({ title, url })
          .catch(err => { if (err.name !== 'AbortError' && err.name !== 'InvalidStateError') mail(); })
          .finally(() => { sharing = false; });
      });
    });
  }
})();
