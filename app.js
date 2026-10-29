/**
 * BEL GRAY OFFICIAL ARTIST HUB — CLIENT CONTROLLER
 * Architecture: Hybrid Data Layer (Local Fallback + Supabase Sync + Dynamic Theme Engine)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Embedded Safe Fallbacks (Guarantees zero downtime even offline)
  const defaultReleases = [
    {
      id: "anxious-story",
      title: "Anxious Story",
      type: "EP",
      category: "ep",
      year: "2026",
      releaseDate: "2026-10-21",
      coverUrl: "assets/Anxious Story.jpg",
      accentColor: "#FF5722",
      tagline: "A four-act journey through the human crisis cycle — from solitary acoustic piano reflections into melodic progressive house.",
      isLatest: true,
      status: "OUT NOW",
      smartlink: "https://band.link/anxious_story",
      craftSpec: {
        badge: "Hybrid Concept",
        type: "hybrid",
        summary: "Piano Harmony by Daniel Belyaev • Neural Vocal Synthesis • FL Studio DAW Engineering"
      },
      tracklist: [
        { number: "01", title: "The Quiet", duration: "02:44", genre: "Acoustic / Indie Pop", previewUrl: "" },
        { number: "02", title: "The Gale", duration: "03:07", genre: "Alternative Rock", previewUrl: "" },
        { number: "03", title: "The Midnight Whisper", duration: "02:52", genre: "Cinematic Neoclassical", previewUrl: "" },
        { number: "04", title: "To Be the Light", duration: "02:02", genre: "Melodic Progressive House", previewUrl: "" }
      ],
      links: {
        yandex: "https://music.yandex.ru/artist/belgray",
        vk: "https://vk.com/artist/belgray",
        spotify: "https://open.spotify.com/artist/belgray",
        apple: "https://music.apple.com/artist/belgray",
        youtube: "https://youtube.com/@belgray_music"
      }
    },
    {
      id: "the-storm-acoustic",
      title: "Буря (The Storm)",
      type: "Single",
      category: "single",
      year: "2025",
      releaseDate: "2025-11-14",
      coverUrl: "assets/BGM YouTube Header.jpg",
      accentColor: "#4A90E2",
      tagline: "The foundational acoustic grand piano prelude that inspired the narrative of Bel Gray.",
      isLatest: false,
      status: "CATALOG",
      smartlink: "https://band.link/anxious_story",
      craftSpec: {
        badge: "Pure Studio Craft",
        type: "pure",
        summary: "100% Handcrafted Acoustic Piano Suite & FL Studio Master"
      },
      tracklist: [
        { number: "01", title: "Буря (Original Piano Prelude)", duration: "03:15", genre: "Neoclassical Piano", previewUrl: "" }
      ],
      links: {
        yandex: "https://music.yandex.ru/artist/belgray",
        vk: "https://vk.com/artist/belgray",
        spotify: "https://open.spotify.com/artist/belgray",
        apple: "https://music.apple.com/artist/belgray",
        youtube: "https://youtube.com/@belgray_music"
      }
    }
  ];

  const defaultConfig = {
    announcement: {
      enabled: true,
      badge: "OUT NOW",
      text: "EP 'Anxious Story' is out now worldwide on all streaming platforms",
      buttonText: "Listen Now",
      link: "https://band.link/anxious_story"
    },
    site: {
      activeEraColor: "#FF5722"
    }
  };

  // State
  let releases = defaultReleases;
  let siteConfig = defaultConfig;
  let currentAudio = null;
  let currentTrackIndex = -1;
  let isSimulatedPlaying = false;
  let simulatedTimer = null;

  // 2. Fetch Data (Local JSON with LocalStorage / Admin overrides)
  try {
    const savedConfig = localStorage.getItem('belgray_site_config');
    const savedReleases = localStorage.getItem('belgray_releases');

    if (savedConfig) {
      siteConfig = JSON.parse(savedConfig);
    } else {
      const resConfig = await fetch('data/site-config.json');
      if (resConfig.ok) siteConfig = await resConfig.json();
    }

    if (savedReleases) {
      releases = JSON.parse(savedReleases);
    } else {
      const resReleases = await fetch('data/releases.json');
      if (resReleases.ok) releases = await resReleases.json();
    }
  } catch (err) {
    console.info('Loaded with default static data:', err.message);
  }

  // 3. Apply Dynamic Era Theme Color
  const applyThemeColor = (color) => {
    if (!color) return;
    const root = document.documentElement;
    root.style.setProperty('--accent-color', color);
    root.style.setProperty('--accent-glow', `${color}38`);
    root.style.setProperty('--accent-subtle', `${color}18`);
    root.style.setProperty('--accent-border', `${color}66`);
  };

  // 4. Update Announcement Banner
  const updateAnnouncement = (cfg) => {
    const bar = document.getElementById('announcement-bar');
    if (!bar) return;

    if (!cfg.enabled) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    const badgeEl = document.getElementById('announcement-badge');
    const textEl = document.getElementById('announcement-text');
    const linkEl = document.getElementById('announcement-link');
    const btnTextEl = document.getElementById('announcement-btn-text');

    if (badgeEl) badgeEl.textContent = cfg.badge || 'UPDATE';
    if (textEl) textEl.textContent = cfg.text || '';
    if (btnTextEl) btnTextEl.textContent = cfg.buttonText || 'Explore';
    if (linkEl) linkEl.href = cfg.link || '#';
  };

  // 5. Render Featured Release
  const renderFeatured = (release) => {
    const mount = document.getElementById('latest-release-mount');
    if (!mount || !release) return;

    applyThemeColor(release.accentColor || siteConfig.site?.activeEraColor || '#FF5722');

    const tracksHtml = (release.tracklist || []).map((t, idx) => `
      <div class="track-item" data-track-index="${idx}" data-title="${t.title}" data-preview="${t.previewUrl || ''}">
        <div class="track-play-trigger">
          <svg class="track-play-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        <div class="track-title-wrap">
          <span class="track-title">${t.number ? t.number + '. ' : ''}${t.title}</span>
          <span class="track-genre">${t.genre || ''}</span>
        </div>
        <div class="track-meta-right">
          <span class="track-duration">${t.duration || ''}</span>
        </div>
      </div>
    `).join('');

    mount.innerHTML = `
      <article class="featured-card">
        <div class="featured-cover-box">
          <div class="cover-image-frame">
            <img src="${release.coverUrl}" alt="${release.title} Artwork" loading="eager">
            <div class="cover-badge-top">${release.status || 'OUT NOW'}</div>
          </div>
        </div>

        <div class="featured-content">
          <div class="featured-header">
            <div class="meta-row">
              <span class="release-type-badge">${release.type} • ${release.year}</span>
              <span class="release-date-text">${release.releaseDate || ''}</span>
            </div>
            <h3 class="featured-title">${release.title}</h3>
            <p class="featured-desc">${release.tagline || ''}</p>

            ${release.craftSpec ? `
              <div class="craft-spec-box">
                <svg class="craft-spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <div class="craft-spec-info">
                  <span class="craft-spec-title">CRAFT SPEC: ${release.craftSpec.badge || 'STUDIO MASTER'}</span>
                  <span class="craft-spec-text">${release.craftSpec.summary || ''}</span>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="tracklist-container" id="featured-tracklist">
            ${tracksHtml}
          </div>

          <div id="mini-player-bar" class="mini-player-bar">
            <div class="player-track-info">
              <span class="player-now-playing">NOW PLAYING</span>
              <span class="player-current-title" id="player-title">Track</span>
            </div>
            <div class="player-progress-bar" id="player-progress-wrap">
              <div class="player-progress-fill" id="player-progress-fill"></div>
            </div>
            <span class="player-time-display" id="player-time">00:00</span>
          </div>

          <div class="featured-actions-hub" style="margin-top: 24px;">
            <a href="${release.smartlink || 'https://band.link/anxious_story'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
              <span>Stream on BandLink</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z"/>
              </svg>
            </a>
            <a href="${release.links?.yandex || '#'}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
              Яндекс Музыка
            </a>
            <a href="${release.links?.vk || '#'}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
              VK
            </a>
            <a href="${release.links?.spotify || '#'}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
              Spotify
            </a>
          </div>
        </div>
      </article>
    `;

    setupTracklistAudio(release);
  };

  // 6. Setup Audio Engine & Streaming Redirect Modal
  const streamModal = document.getElementById('stream-picker-modal');
  const modalCloseBtn = document.getElementById('stream-modal-close');
  const modalTrackTitle = document.getElementById('modal-track-name');

  const openStreamModal = (trackTitle, release) => {
    if (!streamModal) return;
    if (modalTrackTitle) modalTrackTitle.textContent = trackTitle;

    // Update links from release
    const linkBandlink = document.getElementById('modal-link-bandlink');
    const linkYandex = document.getElementById('modal-link-yandex');
    const linkVk = document.getElementById('modal-link-vk');
    const linkSpotify = document.getElementById('modal-link-spotify');
    const linkApple = document.getElementById('modal-link-apple');

    if (linkBandlink) linkBandlink.href = release.smartlink || 'https://band.link/anxious_story';
    if (linkYandex) linkYandex.href = release.links?.yandex || release.smartlink || '#';
    if (linkVk) linkVk.href = release.links?.vk || release.smartlink || '#';
    if (linkSpotify) linkSpotify.href = release.links?.spotify || release.smartlink || '#';
    if (linkApple) linkApple.href = release.links?.apple || release.smartlink || '#';

    streamModal.classList.add('active');
  };

  const closeStreamModal = () => {
    if (streamModal) streamModal.classList.remove('active');
  };

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeStreamModal);
  }

  if (streamModal) {
    streamModal.addEventListener('click', (e) => {
      if (e.target === streamModal) closeStreamModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeStreamModal();
  });

  const setupTracklistAudio = (release) => {
    const trackItems = document.querySelectorAll('.track-item');
    const playerBar = document.getElementById('mini-player-bar');
    const playerTitle = document.getElementById('player-title');
    const playerFill = document.getElementById('player-progress-fill');
    const playerTime = document.getElementById('player-time');

    trackItems.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.trackIndex, 10);
        const title = item.dataset.title;
        const previewUrl = item.dataset.preview;

        // If track has an actual uploaded audio file
        if (previewUrl && previewUrl.trim() !== '') {
          if (currentTrackIndex === index && currentAudio) {
            stopAudio();
            return;
          }

          stopAudio();
          currentTrackIndex = index;

          trackItems.forEach(t => {
            t.classList.remove('active');
            const icon = t.querySelector('.track-play-icon');
            if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
          });

          item.classList.add('active');
          const playIcon = item.querySelector('.track-play-icon');
          if (playIcon) {
            playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
          }

          if (playerBar) playerBar.classList.add('active');
          if (playerTitle) playerTitle.textContent = title;

          currentAudio = new Audio(previewUrl);
          currentAudio.play().catch(e => console.log('Audio autoplay prevented:', e));

          currentAudio.addEventListener('timeupdate', () => {
            if (!currentAudio) return;
            const pct = (currentAudio.currentTime / currentAudio.duration) * 100 || 0;
            if (playerFill) playerFill.style.width = `${pct}%`;
            if (playerTime) {
              const m = Math.floor(currentAudio.currentTime / 60);
              const s = Math.floor(currentAudio.currentTime % 60);
              playerTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
          });

          currentAudio.addEventListener('ended', stopAudio);
        } else {
          // Zero-Server-Load: Elegant Streaming Platform Redirect Modal
          stopAudio();
          openStreamModal(title, release);
        }
      });
    });

    const stopAudio = () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      currentTrackIndex = -1;

      trackItems.forEach(t => {
        t.classList.remove('active');
        const icon = t.querySelector('.track-play-icon');
        if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      });

      if (playerBar) playerBar.classList.remove('active');
      if (playerFill) playerFill.style.width = '0%';
    };
  };

  // 7. Render Discography Grid
  const renderDiscography = (items) => {
    const mount = document.getElementById('discography-grid-mount');
    if (!mount) return;

    if (!items || items.length === 0) {
      mount.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No releases found in this category.</div>`;
      return;
    }

    mount.innerHTML = items.map(item => `
      <article class="release-card" data-category="${item.category}">
        <div class="release-card-cover">
          <img src="${item.coverUrl}" alt="${item.title}" loading="lazy">
        </div>
        <div class="release-card-meta">
          <span class="release-card-type">${item.type}</span>
          <span class="release-card-year">${item.year}</span>
        </div>
        <h4 class="release-card-title">${item.title}</h4>
        <div class="release-card-craft">
          <span>•</span>
          <span>${item.craftSpec ? item.craftSpec.badge : 'Studio Engineering'}</span>
        </div>
        <div class="release-card-action">
          <a href="${item.smartlink || '#'}" target="_blank" rel="noopener" class="btn btn-sm btn-ghost" style="width: 100%;">
            Open Release
          </a>
        </div>
      </article>
    `).join('');
  };

  // 8. Setup Catalog Filter Tabs
  const setupFilters = () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.getAttribute('data-filter');
        if (category === 'all') {
          renderDiscography(releases);
        } else {
          const filtered = releases.filter(r => r.category === category);
          renderDiscography(filtered);
        }
      });
    });
  };

  // 9. Mobile Navigation Drawer Toggle
  const setupMobileNav = () => {
    const toggle = document.getElementById('mobile-nav-toggle');
    const nav = document.querySelector('.desktop-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const isVisible = nav.style.display === 'flex';
      if (isVisible) {
        nav.style.display = '';
      } else {
        nav.style.display = 'flex';
        nav.style.flexDirection = 'column';
        nav.style.position = 'absolute';
        nav.style.top = '74px';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.background = 'var(--bg-glass)';
        nav.style.padding = '24px';
        nav.style.borderBottom = '1px solid var(--border-medium)';
        nav.style.backdropFilter = 'blur(20px)';
      }
    });
  };

  // 10. Hydrate All Dynamic Sections (Hero, Bio, Documentary)
  const hydrateDynamicContent = (cfg) => {
    if (!cfg) return;

    // Hero Section
    if (cfg.hero) {
      const heroBadge = document.getElementById('hero-badge');
      const heroTitle = document.getElementById('hero-title');
      const heroSubtitle = document.getElementById('hero-subtitle');
      const heroCtaPrimary = document.getElementById('hero-cta-primary');
      const heroCtaSecondary = document.getElementById('hero-cta-secondary');

      if (heroBadge && cfg.hero.badge) heroBadge.textContent = cfg.hero.badge;
      if (heroTitle && cfg.hero.title) heroTitle.textContent = cfg.hero.title;
      if (heroSubtitle && cfg.hero.subtitle) heroSubtitle.textContent = cfg.hero.subtitle;
      if (heroCtaPrimary && cfg.hero.ctaPrimaryText) {
        heroCtaPrimary.querySelector('span').textContent = cfg.hero.ctaPrimaryText;
      }
      if (heroCtaSecondary && cfg.hero.ctaSecondaryText) {
        heroCtaSecondary.querySelector('span').textContent = cfg.hero.ctaSecondaryText;
      }
    }

    // Bio & Photo Section
    if (cfg.bio) {
      const bioPhoto = document.getElementById('bio-photo');
      const bioCapName = document.getElementById('bio-caption-name');
      const bioCapRole = document.getElementById('bio-caption-role');
      const bioLead = document.getElementById('bio-lead');
      const bioP1 = document.getElementById('bio-p1');
      const bioP2 = document.getElementById('bio-p2');
      const bioQuote = document.getElementById('bio-quote');
      const bioQuoteAuthor = document.getElementById('bio-quote-author');
      const bioStatsMount = document.getElementById('bio-stats-mount');

      if (bioPhoto && cfg.bio.photoUrl) bioPhoto.src = cfg.bio.photoUrl;
      if (bioCapName && cfg.bio.captionName) bioCapName.textContent = cfg.bio.captionName;
      if (bioCapRole && cfg.bio.captionRole) bioCapRole.textContent = cfg.bio.captionRole;
      if (bioLead && cfg.bio.lead) bioLead.textContent = cfg.bio.lead;
      if (bioP1 && cfg.bio.paragraph1) bioP1.textContent = cfg.bio.paragraph1;
      if (bioP2 && cfg.bio.paragraph2) bioP2.textContent = cfg.bio.paragraph2;
      if (bioQuote && cfg.bio.quote) bioQuote.textContent = `"${cfg.bio.quote}"`;
      if (bioQuoteAuthor && cfg.bio.quoteAuthor) bioQuoteAuthor.textContent = `— ${cfg.bio.quoteAuthor}`;

      if (bioStatsMount && Array.isArray(cfg.bio.stats)) {
        bioStatsMount.innerHTML = cfg.bio.stats.map(s => `
          <div class="stat-item">
            <span class="stat-kicker">${s.kicker}</span>
            <span class="stat-value-text">${s.value}</span>
          </div>
        `).join('');
      }
    }

    // Documentary Section
    const filmSection = document.getElementById('film');
    if (filmSection) {
      if (cfg.documentary && cfg.documentary.enabled === false) {
        filmSection.style.display = 'none';
      } else if (cfg.documentary) {
        filmSection.style.display = 'block';
        const docBadge = document.getElementById('doc-badge');
        const docTitle = document.getElementById('doc-title');
        const docDesc = document.getElementById('doc-desc');
        const docBtn = document.getElementById('doc-btn');
        const docBtnText = document.getElementById('doc-btn-text');
        const docLinkPlay = document.getElementById('doc-link-play');

        if (docBadge && cfg.documentary.badge) docBadge.textContent = cfg.documentary.badge;
        if (docTitle && cfg.documentary.title) docTitle.textContent = cfg.documentary.title;
        if (docDesc && cfg.documentary.description) docDesc.textContent = cfg.documentary.description;
        if (docBtn && cfg.documentary.link) docBtn.href = cfg.documentary.link;
        if (docLinkPlay && cfg.documentary.link) docLinkPlay.href = cfg.documentary.link;
        if (docBtnText && cfg.documentary.buttonText) docBtnText.textContent = cfg.documentary.buttonText;
      }
    }
  };

  // 11. Initialization
  if (siteConfig.announcement) {
    updateAnnouncement(siteConfig.announcement);
  }

  hydrateDynamicContent(siteConfig);

  const latestRelease = releases.find(r => r.isLatest) || releases[0];
  renderFeatured(latestRelease);
  renderDiscography(releases);
  setupFilters();
  setupMobileNav();
});

