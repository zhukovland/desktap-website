// The Mac agent's download buttons (/next/, /changelog/).
// 1. The trust line next to a button shows the version and the DMG size of the latest GitHub release.
//    Until they arrive, or if GitHub doesn't answer, the line reads "Free · macOS 15+ · Notarized by Apple".
//    On /changelog/ it also dates each entry and tags the latest one.
// 2. On a phone or tablet (html.handheld, set in <head>) the buttons send the download link to the Mac.
(function () {
  // ── Trust line: version and size from the latest release; on /changelog/, the dates and the "Latest" entry ──
  const REPO = 'https://api.github.com/repos/zhukovland/desktap-website/releases';
  const changelog = document.querySelector('[data-release-entry]');
  // The changelog needs every release (dates); the other pages only the latest one
  const API = changelog ? REPO + '?per_page=100' : REPO + '/latest';
  const CACHE = 'desktap-agent-release' + (changelog ? '-all' : '');

  // "v2.0.3" → "v2.0": the changelog lists major and minor versions only, bug-fix updates are not listed
  const minor = tag => 'v' + tag.replace(/^v/, '').split('.').slice(0, 2).join('.');

  function show(info) {
    document.querySelectorAll('[data-release="version"]').forEach(el => {
      el.textContent = info.version;
      if (el.tagName === 'A') el.href = '/changelog/#' + minor(info.version);
      el.closest('[data-release-item]').hidden = false;
    });
    document.querySelectorAll('[data-release="size"]').forEach(el => {
      el.textContent = info.size;
      el.closest('[data-release-item]').hidden = false;
    });
    // On /changelog/: the entry of the latest release, and each entry's date = its first release (x.y.0 or the first after it)
    const entry = document.querySelector('[data-release-entry="' + minor(info.version) + '"]');
    if (entry) entry.classList.add('is-latest');
    Object.entries(info.dates || {}).forEach(([version, iso]) => {
      const time = document.querySelector('[data-release-entry="' + version + '"] [data-release-date]');
      if (!time) return;
      time.dateTime = iso.slice(0, 10);
      time.textContent = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    });
  }

  function parse(json) {
    const list = (Array.isArray(json) ? json : [json]).filter(r => r && r.tag_name && !r.draft && !r.prerelease);
    const latest = list.find(r => (r.assets || []).some(a => /\.dmg$/i.test(a.name)));
    if (!latest) return null;
    const dmg = latest.assets.find(a => /\.dmg$/i.test(a.name));
    const dates = {};
    list.forEach(r => {
      const v = minor(r.tag_name);
      if (!dates[v] || r.published_at < dates[v]) dates[v] = r.published_at;
    });
    return {
      version: latest.tag_name.startsWith('v') ? latest.tag_name : 'v' + latest.tag_name,
      // Decimal megabytes, as Finder and Safari show the file
      size: (dmg.size / 1e6).toFixed(1) + ' MB',
      dates
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
          const info = json && parse(json);
          if (!info) return;
          show(info);
          try { sessionStorage.setItem(CACHE, JSON.stringify(info)); } catch (e) {}
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
