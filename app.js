/**
 * BEL GRAY OFFICIAL ARTIST HUB — CLIENT CONTROLLER
 * Architecture: Hybrid Data Layer (Local Fallback + Supabase Sync + Dynamic Theme Engine)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Security & Sanitization Helpers (XSS & URL Injection Prevention)
  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const sanitizeUrl = (url, fallback = '#') => {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    if (!trimmed) return fallback;
    // Allow same-page anchors and relative asset paths (including filenames with spaces)
    if (trimmed.startsWith('#') || trimmed.startsWith('assets/') || trimmed.startsWith('./assets/') || trimmed.startsWith('/assets/')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return trimmed;
      }
    } catch (_) {
      // Invalid URL format
    }
    return fallback;
  };

  const normalizeHexColor = (color, fallback = '#FF5722') => {
    if (!color || typeof color !== 'string') return fallback;
    let hex = color.trim();
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) hex = `#${hex}`;
    if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : fallback;
  };

  // Official 11 Streaming Platforms Registry
  // Strict Order: 1. Global -> 2. Russia -> 3. Other
  const STREAMING_PLATFORMS = [
    // TIER 1: GLOBAL PLATFORMS
    {
      key: 'spotify',
      name: 'Spotify',
      tier: 'global',
      tierBadge: 'GLOBAL',
      icon: 'assets/Spotify.svg',
      defaultUrl: 'https://open.spotify.com/artist/belgray'
    },
    {
      key: 'apple',
      name: 'Apple Music',
      tier: 'global',
      tierBadge: 'GLOBAL',
      icon: 'assets/Apple Music.svg',
      defaultUrl: 'https://music.apple.com/artist/belgray'
    },
    {
      key: 'youtube',
      name: 'YouTube Music',
      tier: 'global',
      tierBadge: 'GLOBAL',
      icon: 'assets/YouTube Music.svg',
      defaultUrl: 'https://youtube.com/@belgray_music'
    },
    {
      key: 'amazon',
      name: 'Amazon Music',
      tier: 'global',
      tierBadge: 'GLOBAL',
      icon: 'assets/Amazon Music.svg',
      defaultUrl: 'https://band.link/anxious_story'
    },
    {
      key: 'deezer',
      name: 'Deezer',
      tier: 'global',
      tierBadge: 'GLOBAL',
      icon: 'assets/Deezer.svg',
      defaultUrl: 'https://band.link/anxious_story'
    },
    {
      key: 'soundcloud',
      name: 'SoundCloud',
      tier: 'global',
      tierBadge: 'GLOBAL',
      icon: 'assets/Soundcloud.svg',
      defaultUrl: 'https://band.link/anxious_story'
    },

    // TIER 2: RUSSIAN PLATFORMS
    {
      key: 'yandex',
      name: 'Яндекс Музыка',
      tier: 'ru',
      tierBadge: 'RUSSIA',
      icon: 'assets/Yandex Music.svg',
      defaultUrl: 'https://music.yandex.ru/artist/belgray'
    },
    {
      key: 'vk',
      name: 'VK Музыка',
      tier: 'ru',
      tierBadge: 'RUSSIA',
      icon: 'assets/VK Music.svg',
      defaultUrl: 'https://vk.com/artist/belgray'
    },
    {
      key: 'zvuk',
      name: 'Звук',
      tier: 'ru',
      tierBadge: 'RUSSIA',
      icon: 'assets/Zvuk.svg',
      defaultUrl: 'https://band.link/anxious_story'
    },

    // TIER 3: OTHER PLATFORMS
    {
      key: 'tidal',
      name: 'TIDAL',
      tier: 'other',
      tierBadge: 'OTHER',
      icon: 'assets/Tidal.svg',
      defaultUrl: 'https://band.link/anxious_story'
    },
    {
      key: 'tme',
      name: 'TME',
      tier: 'other',
      tierBadge: 'OTHER',
      icon: 'assets/TME.svg',
      defaultUrl: 'https://band.link/anxious_story'
    }
  ];

  const resolvePlatformUrl = (platform, release) => {
    const fallbackSmartlink = sanitizeUrl(release?.smartlink, 'https://band.link/anxious_story');
    const customLink = release?.links?.[platform.key];
    if (customLink && typeof customLink === 'string' && customLink.trim() !== '') {
      return sanitizeUrl(customLink, fallbackSmartlink);
    }
    return sanitizeUrl(platform.defaultUrl, fallbackSmartlink);
  };

  // 1. Embedded Safe Fallbacks (Guarantees zero downtime even offline / file:// protocol)
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
        spotify: "https://open.spotify.com/artist/belgray",
        apple: "https://music.apple.com/artist/belgray",
        youtube: "https://youtube.com/@belgray_music",
        amazon: "https://band.link/anxious_story",
        deezer: "https://band.link/anxious_story",
        soundcloud: "https://band.link/anxious_story",
        yandex: "https://music.yandex.ru/artist/belgray",
        vk: "https://vk.com/artist/belgray",
        zvuk: "https://band.link/anxious_story",
        tidal: "https://band.link/anxious_story",
        tme: "https://band.link/anxious_story"
      }
    }
  ];

  const defaultConfig = {
    site: {
      title: "Bel Gray | Electronic Producer & Pianist",
      artistName: "Bel Gray",
      realName: "Daniel Belyaev",
      activeEraColor: "#FF5722",
      activeEraName: "Anxious Story Era"
    },
    hero: {
      badge: "PIANIST & ELECTRONIC PRODUCER",
      title: "BEL GRAY",
      subtitle: "Solo piano touch meeting the energy of melodic progressive house. Crafted by Daniel Belyaev.",
      ctaPrimaryText: "Listen to 'Anxious Story'",
      ctaPrimaryLink: "#latest",
      ctaSecondaryText: "Meet Daniel",
      ctaSecondaryLink: "#about"
    },
    announcement: {
      enabled: true,
      badge: "OUT NOW",
      text: "EP 'Anxious Story' is out now worldwide on all streaming platforms",
      buttonText: "Listen Now",
      link: "https://band.link/anxious_story"
    },
    bio: {
      photoUrl: "assets/BGM Daniel Belyaev Photo.png",
      captionName: "DANIEL BELYAEV",
      captionRole: "Electronic Producer & Pianist",
      lead: "Grounded in classical piano keys, engineered for the energy of electronic music.",
      paragraph1: "Bel Gray is the artist alias of composer, electronic music producer, and pianist Daniel Belyaev. Built upon classical piano discipline and deep DAW engineering in FL Studio, every release is designed as an authentic emotional timeline.",
      paragraph2: "Most works across the catalog are purely handcrafted piano compositions and electronic synth productions. On select concept releases (like Anxious Story), neural voice synthesis and modern technology are orchestrated as creative instruments — where melodic architecture, harmony, and emotional weight always remain human-led.",
      quote: "And life is so beautiful, that’s all that counts. Just to heal this world and to be the light.",
      quoteAuthor: "Bel Gray",
      stats: [
        { kicker: "CORE INSTRUMENT", value: "Acoustic Piano" },
        { kicker: "ENGINEERING", value: "FL Studio DAW" },
        { kicker: "SOUND IDENTITY", value: "Melodic Prog House" }
      ]
    },
    documentary: {
      enabled: true,
      badge: "CREATIVE ARCHIVE",
      title: "Behind The Anxious Story",
      spec: "4K • STUDIO BREAKDOWN",
      posterUrl: "assets/BGM Daniel Belyaev Photo.png",
      description: "The creative documentary tracing how a raw, stumbling phone recording evolved into the four-act conceptual EP 'Anxious Story'. Studio breakdown, piano progression, and visual framing.",
      buttonText: "Watch Documentary on YouTube",
      link: "https://youtube.com/@belgray_music"
    },
    socials: {
      telegram: "https://t.me/belgray_music",
      youtube: "https://youtube.com/@belgray_music",
      vk: "https://vk.com/belgray_music",
      tiktok: "https://tiktok.com/@belgray_music",
      smartlink: "https://band.link/anxious_story",
      email: "contact@belgray.com"
    },
    footer: {
      brandTitle: "BEL GRAY",
      brandDesc: "Acoustic piano keys, progressive house frequencies, and authentic human emotion.",
      copyrightYear: "2026",
      copyrightOwner: "Bel Gray (Daniel Belyaev). All rights reserved.",
      bottomTagline: "Crafted with pure code & sound architecture",
      email: "contact@belgray.com",
      emailLabel: "Inquiries & Booking",
      smartlinkLabel: "BandLink Smartlink",
      smartlinkUrl: "https://band.link/anxious_story",
      links: [
        { title: "Telegram Channel", url: "https://t.me/belgray_music" },
        { title: "YouTube", url: "https://youtube.com/@belgray_music" },
        { title: "VK Community", url: "https://vk.com/belgray_music" },
        { title: "TikTok", url: "https://tiktok.com/@belgray_music" }
      ]
    }
  };

  // State
  let releases = JSON.parse(JSON.stringify(defaultReleases));
  let siteConfig = JSON.parse(JSON.stringify(defaultConfig));
  let currentAudio = null;
  let currentTrackIndex = -1;
  let activeFilterCategory = 'all';
  let activeStreamTier = 'all';

  const mergeNonEmpty = (defaults, saved) => {
    if (!saved || typeof saved !== 'object') return { ...defaults };
    const result = { ...defaults };
    for (const key of Object.keys(saved)) {
      if (saved[key] !== '' && saved[key] !== null && saved[key] !== undefined) {
        result[key] = saved[key];
      }
    }
    return result;
  };

  // 2. Load Data (LocalStorage / Supabase Cloud / JSON Fallbacks)
  const loadStateData = async () => {
    try {
      const savedConfig = localStorage.getItem('belgray_site_config');
      const savedReleases = localStorage.getItem('belgray_releases');

      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        siteConfig = {
          ...defaultConfig,
          ...parsedConfig,
          site: mergeNonEmpty(defaultConfig.site, parsedConfig.site),
          hero: mergeNonEmpty(defaultConfig.hero, parsedConfig.hero),
          announcement: mergeNonEmpty(defaultConfig.announcement, parsedConfig.announcement),
          bio: mergeNonEmpty(defaultConfig.bio, parsedConfig.bio),
          documentary: mergeNonEmpty(defaultConfig.documentary, parsedConfig.documentary),
          socials: mergeNonEmpty(defaultConfig.socials, parsedConfig.socials),
          footer: parsedConfig.footer ? {
            ...defaultConfig.footer,
            ...parsedConfig.footer,
            links: Array.isArray(parsedConfig.footer.links) ? parsedConfig.footer.links : defaultConfig.footer.links
          } : defaultConfig.footer
        };
      } else {
        const resConfig = await fetch('data/site-config.json');
        if (resConfig.ok) siteConfig = await resConfig.json();
      }

      if (savedReleases) {
        const parsedReleases = JSON.parse(savedReleases);
        if (Array.isArray(parsedReleases) && parsedReleases.length > 0) {
          releases = parsedReleases.filter(r => r && r.id !== 'the-storm-acoustic');
          if (releases.length !== parsedReleases.length) {
            localStorage.setItem('belgray_releases', JSON.stringify(releases));
          }
        }
      } else {
        const resReleases = await fetch('data/releases.json');
        if (resReleases.ok) {
          const jsonReleases = await resReleases.json();
          if (Array.isArray(jsonReleases) && jsonReleases.length > 0) {
            releases = jsonReleases;
          }
        }
      }
    } catch (err) {
      console.info('Loaded with embedded static data:', err.message);
    }

    if (!Array.isArray(releases) || releases.length === 0) {
      releases = JSON.parse(JSON.stringify(defaultReleases));
    }
  };

  // 3. Dynamic Era Theme Color & High-Contrast Luminance Engine
  const getContrastColor = (hex) => {
    if (!hex) return '#FFFFFF';
    const c = hex.replace('#', '').trim();
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#0A0A0E' : '#FFFFFF';
  };

  const getHoverColor = (hex) => {
    if (!hex) return '#F4511E';
    const c = hex.replace('#', '').trim();
    let r = parseInt(c.substring(0, 2), 16) || 0;
    let g = parseInt(c.substring(2, 4), 16) || 0;
    let b = parseInt(c.substring(4, 6), 16) || 0;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const factor = brightness > 155 ? 0.88 : 1.12;
    const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
  };

  const applyThemeColor = (color) => {
    const validHex = normalizeHexColor(color, '#FF5722');
    const contrastColor = getContrastColor(validHex);
    const hoverColor = getHoverColor(validHex);
    const root = document.documentElement;
    root.style.setProperty('--accent-color', validHex);
    root.style.setProperty('--accent-hover', hoverColor);
    root.style.setProperty('--accent-contrast', contrastColor);
    root.style.setProperty('--accent-glow', `${validHex}38`);
    root.style.setProperty('--accent-subtle', `${validHex}18`);
    root.style.setProperty('--accent-border', `${validHex}66`);
  };

  // 4. Update Announcement Banner
  const updateAnnouncement = (cfg) => {
    const bar = document.getElementById('announcement-bar');
    if (!bar || !cfg) return;

    if (cfg.enabled === false) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    const badgeEl = document.getElementById('announcement-badge');
    const textEl = document.getElementById('announcement-text');
    const linkEl = document.getElementById('announcement-link');
    const btnTextEl = document.getElementById('announcement-btn-text');

    if (badgeEl) badgeEl.textContent = cfg.badge || 'OUT NOW';
    if (textEl) textEl.textContent = cfg.text || '';
    if (btnTextEl) btnTextEl.textContent = cfg.buttonText || 'Listen Now';
    if (linkEl) linkEl.href = sanitizeUrl(cfg.link, 'https://band.link/anxious_story');
  };

  // 5. Hero Animated Streaming Carousel Engine (Global -> Russian -> Niche)
  let heroCarouselRaf = null;
  let heroCarouselOffset = 0;
  let heroCarouselPaused = false;
  let heroCarouselInitialized = false;

  const renderHeroStreamingCarousel = (latestRelease) => {
    const track = document.getElementById('hero-streaming-carousel-track');
    const viewport = document.getElementById('streaming-carousel-viewport');
    if (!track || !viewport) return;

    const filteredPlatforms = activeStreamTier === 'all'
      ? STREAMING_PLATFORMS
      : STREAMING_PLATFORMS.filter(p => p.tier === activeStreamTier);

    // When showing "all", duplicate the list once so the continuous marquee loops seamlessly
    const displayList = activeStreamTier === 'all'
      ? [...filteredPlatforms, ...filteredPlatforms]
      : filteredPlatforms;

    track.classList.toggle('is-filtered-static', activeStreamTier !== 'all');

    track.innerHTML = displayList.map((p, idx) => {
      const targetUrl = resolvePlatformUrl(p, latestRelease);
      const isClone = activeStreamTier === 'all' && idx >= filteredPlatforms.length;
      return `
        <a href="${escapeHtml(targetUrl)}"
           target="_blank"
           rel="noopener noreferrer"
           class="stream-carousel-card tier-${escapeHtml(p.tier)}"
           ${isClone ? 'aria-hidden="true" tabindex="-1"' : ''}>
          <div class="stream-card-icon-wrap">
            <img src="${escapeHtml(p.icon)}" alt="${escapeHtml(p.name)}" class="stream-card-logo" loading="eager">
          </div>
          <div class="stream-card-body">
            <div class="stream-card-top-row">
              <span class="stream-tier-badge">${escapeHtml(p.tierBadge)}</span>
              <span class="stream-card-arrow">↗</span>
            </div>
            <span class="stream-card-name">${escapeHtml(p.name)}</span>
          </div>
        </a>
      `;
    }).join('');

    heroCarouselOffset = 0;
    track.style.transform = 'translate3d(0px, 0, 0)';
  };

  const setupHeroCarouselEngine = () => {
    if (heroCarouselInitialized) return;
    heroCarouselInitialized = true;

    const viewport = document.getElementById('streaming-carousel-viewport');
    const track = document.getElementById('hero-streaming-carousel-track');
    const prevBtn = document.getElementById('stream-prev-btn');
    const nextBtn = document.getElementById('stream-next-btn');
    const tierBtns = document.querySelectorAll('.tier-tab-btn');

    if (!viewport || !track) return;

    viewport.addEventListener('mouseenter', () => {
      heroCarouselPaused = true;
    });

    viewport.addEventListener('mouseleave', () => {
      heroCarouselPaused = false;
    });

    const stepCarousel = (deltaPx) => {
      if (activeStreamTier !== 'all') {
        viewport.scrollBy({ left: deltaPx, behavior: 'smooth' });
        return;
      }
      const halfWidth = track.scrollWidth / 2;
      if (halfWidth <= 0) return;
      heroCarouselOffset += deltaPx;
      if (heroCarouselOffset >= halfWidth) heroCarouselOffset -= halfWidth;
      if (heroCarouselOffset < 0) heroCarouselOffset += halfWidth;
      track.style.transform = `translate3d(${-heroCarouselOffset.toFixed(1)}px, 0, 0)`;
    };

    if (prevBtn) {
      prevBtn.addEventListener('click', () => stepCarousel(-250));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => stepCarousel(250));
    }

    tierBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tierBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStreamTier = btn.dataset.tier || 'all';
        const latestRelease = releases.find(r => r.isLatest) || releases[0];
        renderHeroStreamingCarousel(latestRelease);
      });
    });

    const animateMarquee = () => {
      if (!heroCarouselPaused && activeStreamTier === 'all') {
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          heroCarouselOffset += 0.55;
          if (heroCarouselOffset >= halfWidth) {
            heroCarouselOffset -= halfWidth;
          }
          track.style.transform = `translate3d(${-heroCarouselOffset.toFixed(2)}px, 0, 0)`;
        }
      }
      heroCarouselRaf = requestAnimationFrame(animateMarquee);
    };

    if (heroCarouselRaf) cancelAnimationFrame(heroCarouselRaf);
    heroCarouselRaf = requestAnimationFrame(animateMarquee);
  };

  // 6. Audio Cleanup Helper (Scoped globally so re-renders never leak audio)
  const stopCurrentAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    currentTrackIndex = -1;

    document.querySelectorAll('.track-item').forEach(t => {
      t.classList.remove('active');
      const trigger = t.querySelector('.track-play-trigger');
      if (trigger) {
        trigger.innerHTML = `
          <svg class="track-play-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
      }
    });

    const playerBar = document.getElementById('mini-player-bar');
    const playerFill = document.getElementById('player-progress-fill');
    const playerTime = document.getElementById('player-time');

    if (playerBar) playerBar.classList.remove('active');
    if (playerFill) playerFill.style.width = '0%';
    if (playerTime) playerTime.textContent = '00:00';
  };

  // Helper: Parse & Format Release Drop Date for Upcoming Releases (COMING SOON / PRE-SAVE)
  const getReleaseDropStatus = (release) => {
    const rawStatus = String(release?.status || 'OUT NOW').toUpperCase().trim();
    const isUpcoming = rawStatus === 'COMING SOON' || rawStatus === 'PRE-SAVE';
    const rawDate = String(release?.releaseDate || '').trim();

    let formattedDate = rawDate || 'TBA';
    let countdownLabel = rawStatus === 'PRE-SAVE' ? 'PRE-SAVE OPEN' : 'COMING SOON';

    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (!isNaN(dt.getTime())) {
        formattedDate = dt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((dt.getTime() - todayMidnight.getTime()) / 86400000);

        if (diffDays > 1) {
          countdownLabel = `IN ${diffDays} DAYS`;
        } else if (diffDays === 1) {
          countdownLabel = 'DROPS TOMORROW';
        } else if (diffDays === 0) {
          countdownLabel = 'DROPS TODAY';
        }
      }
    }

    return {
      isUpcoming,
      rawStatus,
      rawDate,
      formattedDate,
      countdownLabel
    };
  };

  // 7. Render Featured Release (Round Picture-Disc Vinyl -> 3D Pop-Out Cover + Streaming Carousel)
  const renderFeatured = (release) => {
    const mount = document.getElementById('latest-release-mount');
    if (!mount || !release) return;

    stopCurrentAudio();

    // Global Era Color from Studio Theme tab takes priority, falling back to release accentColor
    const activeColor = siteConfig.site?.activeEraColor || release.accentColor || '#FF5722';
    applyThemeColor(activeColor);

    const dropInfo = getReleaseDropStatus(release);

    const tracksHtml = (release.tracklist || []).map((t, idx) => `
      <div class="track-item" data-track-index="${idx}">
        <div class="track-play-trigger">
          <svg class="track-play-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        <div class="track-title-wrap">
          <span class="track-title">${t.number ? escapeHtml(t.number) + '. ' : ''}${escapeHtml(t.title)}</span>
          <span class="track-genre">${escapeHtml(t.genre || '')}</span>
        </div>
        <div class="track-meta-right">
          <span class="track-duration">${escapeHtml(t.duration || '')}</span>
        </div>
      </div>
    `).join('');

    const safeCover = sanitizeUrl(release.coverUrl, 'assets/Anxious Story.jpg');
    const safeSmartlink = sanitizeUrl(release.smartlink, 'https://band.link/anxious_story');
    const primaryCtaText = dropInfo.isUpcoming ? 'Pre-Save on BandLink' : 'Stream on BandLink';

    const featuredLoopList = [...STREAMING_PLATFORMS, ...STREAMING_PLATFORMS];
    const featuredPlatformsHtml = featuredLoopList.map((p, idx) => {
      const url = resolvePlatformUrl(p, release);
      const isClone = idx >= STREAMING_PLATFORMS.length;
      return `
        <a href="${escapeHtml(url)}"
           target="_blank"
           rel="noopener noreferrer"
           class="featured-stream-card"
           ${isClone ? 'aria-hidden="true" tabindex="-1"' : ''}>
          <img src="${escapeHtml(p.icon)}" alt="${escapeHtml(p.name)}" class="featured-stream-logo" loading="lazy">
          <div class="featured-stream-meta">
            <span class="featured-stream-tier stream-tier-badge">${escapeHtml(p.tierBadge)}</span>
            <span class="featured-stream-name">${escapeHtml(p.name)}</span>
          </div>
          <span class="featured-stream-arrow">↗</span>
        </a>
      `;
    }).join('');

    mount.innerHTML = `
      <article class="featured-card ${dropInfo.isUpcoming ? 'is-upcoming-release' : ''}">
        <!-- Left Column: Strictly 1:1 Round Vinyl with Album Cover -> 3D Close-Up Cover on Hover -->
        <div class="featured-cover-box" id="featured-cover-stage">
          <div class="cover-ambient-halo" aria-hidden="true"></div>

          <!-- Default State: Perfectly Round Grooved Vinyl Record with Album Cover Artwork -->
          <div class="vinyl-disc-stage">
            <div class="vinyl-platter">
              <div class="vinyl-grooves-overlay"></div>
              <div class="vinyl-art-circle">
                <img src="${escapeHtml(safeCover)}" alt="${escapeHtml(release.title)} Vinyl Artwork" loading="eager">
                <div class="vinyl-center-ring">
                  <div class="vinyl-spindle"></div>
                </div>
              </div>
            </div>
            <div class="vinyl-badge-top">${escapeHtml(release.status || 'OUT NOW')}</div>
          </div>

          <!-- Hover State: Full Square Album Cover Flying Out into 3D Close-Up with Glow -->
          <div class="cover-3d-popup" id="featured-cover-3d">
            <img src="${escapeHtml(safeCover)}" alt="${escapeHtml(release.title)} Full Cover" loading="eager">
            <div class="cover-3d-glare"></div>
            <div class="cover-badge-top">${escapeHtml(release.status || 'OUT NOW')}</div>
          </div>
        </div>

        <!-- Right Column: Release Details, Tracklist & Streaming Carousel -->
        <div class="featured-content">
          <div class="featured-header">
            <div class="meta-row">
              <span class="release-type-badge">${escapeHtml(release.type)} • ${escapeHtml(release.year)}</span>
              ${dropInfo.isUpcoming ? `
                <span class="release-date-upcoming-pill">
                  <span class="pulse-dot"></span>
                  <span>EXPECTED: ${escapeHtml(dropInfo.rawDate || 'SOON')}</span>
                </span>
              ` : (dropInfo.rawDate ? `
                <span class="release-date-text">${escapeHtml(dropInfo.rawDate)}</span>
              ` : '')}
            </div>
            <h3 class="featured-title">${escapeHtml(release.title)}</h3>
            <p class="featured-desc">${escapeHtml(release.tagline || '')}</p>

            ${dropInfo.isUpcoming ? `
              <div class="upcoming-drop-banner">
                <div class="upcoming-drop-left">
                  <div class="upcoming-calendar-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div class="upcoming-drop-info">
                    <span class="upcoming-drop-kicker">${escapeHtml(dropInfo.rawStatus)} // EXPECTED RELEASE DATE</span>
                    <span class="upcoming-drop-date">
                      Drops on <strong>${escapeHtml(dropInfo.formattedDate)}</strong>
                      ${dropInfo.rawDate && dropInfo.formattedDate !== dropInfo.rawDate ? `<span class="upcoming-iso-sub">(${escapeHtml(dropInfo.rawDate)})</span>` : ''}
                    </span>
                  </div>
                </div>
                <span class="upcoming-countdown-badge">${escapeHtml(dropInfo.countdownLabel)}</span>
              </div>
            ` : ''}

            ${release.craftSpec ? `
              <div class="craft-spec-box">
                <svg class="craft-spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <div class="craft-spec-info">
                  <span class="craft-spec-title">CRAFT SPEC: ${escapeHtml(release.craftSpec.badge || 'STUDIO MASTER')}</span>
                  <span class="craft-spec-text">${escapeHtml(release.craftSpec.summary || '')}</span>
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
            <div class="player-progress-bar" id="player-progress-wrap" title="Click to seek">
              <div class="player-progress-fill" id="player-progress-fill"></div>
            </div>
            <span class="player-time-display" id="player-time">00:00</span>
          </div>

          <!-- Release Streaming Hub: Smartlink + Animated Platform Carousel -->
          <div class="featured-streaming-hub">
            <div class="featured-streaming-top">
              <a href="${escapeHtml(safeSmartlink)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                <span>${escapeHtml(primaryCtaText)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z"/>
                </svg>
              </a>
              <div class="featured-strip-controls">
                <span class="featured-strip-label">1. GLOBAL • 2. RUSSIA • 3. OTHER</span>
                <button type="button" class="carousel-nav-btn carousel-nav-sm" id="feat-stream-prev" aria-label="Scroll platforms left">‹</button>
                <button type="button" class="carousel-nav-btn carousel-nav-sm" id="feat-stream-next" aria-label="Scroll platforms right">›</button>
              </div>
            </div>

            <div class="featured-streaming-viewport" id="featured-streaming-viewport">
              <div class="featured-streaming-track" id="featured-streaming-strip">
                ${featuredPlatformsHtml}
              </div>
            </div>
          </div>
        </div>
      </article>
    `;

    setupCover3DTilt();
    setupFeaturedStripControls();
    setupTracklistAudio(release);
  };

  // Interactive 3D Perspective Tilt + Dynamic Glare on the Popped-Out Cover
  const setupCover3DTilt = () => {
    const stage = document.getElementById('featured-cover-stage');
    if (!stage) return;

    stage.addEventListener('mousemove', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Tilt range: -11deg to +11deg
      const rotateY = ((x - 0.5) * 22).toFixed(2);
      const rotateX = ((0.5 - y) * 22).toFixed(2);
      const glareX = (x * 100).toFixed(1);
      const glareY = (y * 100).toFixed(1);

      stage.style.setProperty('--cover-rx', `${rotateX}deg`);
      stage.style.setProperty('--cover-ry', `${rotateY}deg`);
      stage.style.setProperty('--glare-x', `${glareX}%`);
      stage.style.setProperty('--glare-y', `${glareY}%`);
    });

    stage.addEventListener('mouseleave', () => {
      stage.style.setProperty('--cover-rx', '5deg');
      stage.style.setProperty('--cover-ry', '-6deg');
      stage.style.setProperty('--glare-x', '30%');
      stage.style.setProperty('--glare-y', '20%');
    });
  };

  let featCarouselRaf = null;
  let featCarouselOffset = 0;
  let featCarouselPaused = false;

  const setupFeaturedStripControls = () => {
    if (featCarouselRaf) {
      cancelAnimationFrame(featCarouselRaf);
      featCarouselRaf = null;
    }
    featCarouselOffset = 0;
    featCarouselPaused = false;

    const viewport = document.getElementById('featured-streaming-viewport');
    const track = document.getElementById('featured-streaming-strip');
    const prev = document.getElementById('feat-stream-prev');
    const next = document.getElementById('feat-stream-next');
    if (!viewport || !track) return;

    viewport.addEventListener('mouseenter', () => {
      featCarouselPaused = true;
    });
    viewport.addEventListener('mouseleave', () => {
      featCarouselPaused = false;
    });

    const stepFeatCarousel = (deltaPx) => {
      const halfWidth = track.scrollWidth / 2;
      if (halfWidth <= 0) return;
      featCarouselOffset += deltaPx;
      if (featCarouselOffset >= halfWidth) featCarouselOffset -= halfWidth;
      if (featCarouselOffset < 0) featCarouselOffset += halfWidth;
      track.style.transform = `translate3d(${-featCarouselOffset.toFixed(1)}px, 0, 0)`;
    };

    if (prev) {
      prev.addEventListener('click', () => stepFeatCarousel(-200));
    }
    if (next) {
      next.addEventListener('click', () => stepFeatCarousel(200));
    }

    const animateFeatStrip = () => {
      if (!featCarouselPaused) {
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          featCarouselOffset += 0.48;
          if (featCarouselOffset >= halfWidth) {
            featCarouselOffset -= halfWidth;
          }
          track.style.transform = `translate3d(${-featCarouselOffset.toFixed(2)}px, 0, 0)`;
        }
      }
      featCarouselRaf = requestAnimationFrame(animateFeatStrip);
    };

    featCarouselRaf = requestAnimationFrame(animateFeatStrip);
  };

  // 8. Setup Audio Engine & Streaming Redirect Modal
  const streamModal = document.getElementById('stream-picker-modal');
  const modalCloseBtn = document.getElementById('stream-modal-close');
  const modalTrackTitle = document.getElementById('modal-track-name');
  const modalPlatformLinks = document.getElementById('modal-platform-links');

  const openStreamModal = (trackTitle, release) => {
    if (!streamModal || !release) return;
    if (modalTrackTitle) modalTrackTitle.textContent = trackTitle || release.title || 'Track';

    const fallbackLink = sanitizeUrl(release.smartlink, 'https://band.link/anxious_story');

    if (modalPlatformLinks) {
      const smartlinkHtml = `
        <a href="${escapeHtml(fallbackLink)}" target="_blank" rel="noopener noreferrer" class="modal-platform-btn modal-smartlink-featured">
          <div class="modal-platform-left">
            <div class="modal-smartlink-badge">ALL</div>
            <div class="modal-platform-text-group">
              <span class="modal-platform-name">BandLink Smartlink</span>
              <span class="modal-platform-tier-sub">Universal Multi-Platform Hub</span>
            </div>
          </div>
          <span class="modal-platform-arrow">OPEN ↗</span>
        </a>
      `;

      const platformsHtml = STREAMING_PLATFORMS.map(p => {
        const url = resolvePlatformUrl(p, release);
        return `
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="modal-platform-btn">
            <div class="modal-platform-left">
              <img src="${escapeHtml(p.icon)}" alt="${escapeHtml(p.name)}" class="modal-platform-svg-logo" loading="lazy">
              <div class="modal-platform-text-group">
                <span class="modal-platform-name">${escapeHtml(p.name)}</span>
                <span class="modal-platform-tier-sub">${escapeHtml(p.tierBadge)}</span>
              </div>
            </div>
            <span class="modal-platform-arrow">PLAY ↗</span>
          </a>
        `;
      }).join('');

      modalPlatformLinks.innerHTML = smartlinkHtml + platformsHtml;
    }

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

  const setupTracklistAudio = (release) => {
    const trackItems = document.querySelectorAll('.track-item');
    const playerBar = document.getElementById('mini-player-bar');
    const playerTitle = document.getElementById('player-title');
    const playerWrap = document.getElementById('player-progress-wrap');
    const playerFill = document.getElementById('player-progress-fill');
    const playerTime = document.getElementById('player-time');

    if (playerWrap) {
      playerWrap.addEventListener('click', (e) => {
        if (!currentAudio || !currentAudio.duration) return;
        const rect = playerWrap.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const ratio = clickX / rect.width;
        currentAudio.currentTime = ratio * currentAudio.duration;
      });
    }

    trackItems.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.trackIndex, 10);
        const trackObj = (release.tracklist || [])[index];
        if (!trackObj) return;

        const title = trackObj.title || 'Track';
        const previewUrl = (trackObj.previewUrl || '').trim();

        // If track has an actual uploaded audio file
        if (previewUrl !== '') {
          const safeAudioUrl = sanitizeUrl(previewUrl, '');
          if (!safeAudioUrl) {
            openStreamModal(title, release);
            return;
          }

          if (currentTrackIndex === index && currentAudio) {
            stopCurrentAudio();
            return;
          }

          stopCurrentAudio();
          currentTrackIndex = index;

          item.classList.add('active');
          const playTrigger = item.querySelector('.track-play-trigger');
          if (playTrigger) {
            playTrigger.innerHTML = `
              <div class="track-equalizer" aria-label="Playing">
                <span class="eq-bar eq-bar-1"></span>
                <span class="eq-bar eq-bar-2"></span>
                <span class="eq-bar eq-bar-3"></span>
              </div>
            `;
          }

          if (playerBar) playerBar.classList.add('active');
          if (playerTitle) playerTitle.textContent = title;

          const audio = new Audio(safeAudioUrl);
          currentAudio = audio;

          audio.addEventListener('timeupdate', () => {
            if (currentAudio !== audio) return;
            const pct = (audio.currentTime / audio.duration) * 100 || 0;
            if (playerFill) playerFill.style.width = `${pct}%`;
            if (playerTime) {
              const m = Math.floor(audio.currentTime / 60);
              const s = Math.floor(audio.currentTime % 60);
              playerTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
          });

          audio.addEventListener('ended', stopCurrentAudio);
          audio.addEventListener('error', () => {
            stopCurrentAudio();
            openStreamModal(title, release);
          });

          audio.play().catch(() => {
            stopCurrentAudio();
            openStreamModal(title, release);
          });
        } else {
          // Zero-Server-Load: Elegant Streaming Platform Redirect Modal
          stopCurrentAudio();
          openStreamModal(title, release);
        }
      });
    });
  };

  // 9. Render Discography Grid
  const renderDiscography = (items) => {
    const mount = document.getElementById('discography-grid-mount');
    if (!mount) return;

    if (!items || items.length === 0) {
      mount.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No releases found in this category.</div>`;
      return;
    }

    mount.innerHTML = items.map(item => {
      const safeCover = sanitizeUrl(item.coverUrl, 'assets/Anxious Story.jpg');
      const safeSmartlink = sanitizeUrl(item.smartlink, 'https://band.link/anxious_story');
      const dropInfo = getReleaseDropStatus(item);
      return `
        <article class="release-card" data-category="${escapeHtml(item.category || 'ep')}">
          <div class="release-card-cover">
            <img src="${escapeHtml(safeCover)}" alt="${escapeHtml(item.title)}" loading="lazy">
            ${dropInfo.isUpcoming ? `<div class="cover-badge-top">${escapeHtml(dropInfo.rawStatus)}</div>` : ''}
          </div>
          <div class="release-card-meta">
            <span class="release-card-type">${escapeHtml(item.type)}</span>
            <span class="release-card-year">${escapeHtml(item.year)}${item.releaseDate ? ' • ' + escapeHtml(item.releaseDate) : ''}</span>
          </div>
          <h4 class="release-card-title">${escapeHtml(item.title)}</h4>
          <div class="release-card-craft">
            <span>•</span>
            <span>${escapeHtml(dropInfo.isUpcoming ? `Expected: ${dropInfo.formattedDate}` : (item.craftSpec ? item.craftSpec.badge : 'Studio Engineering'))}</span>
          </div>
          <div class="release-card-action">
            <a href="${escapeHtml(safeSmartlink)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm ${dropInfo.isUpcoming ? 'btn-outline' : 'btn-ghost'}" style="width: 100%;">
              ${dropInfo.isUpcoming ? 'Pre-Save / Preview' : 'Open Release'}
            </a>
          </div>
        </article>
      `;
    }).join('');
  };

  const applyFilter = (category) => {
    activeFilterCategory = category || 'all';
    if (activeFilterCategory === 'all') {
      renderDiscography(releases);
    } else {
      const filtered = releases.filter(r => r.category === activeFilterCategory);
      renderDiscography(filtered);
    }
  };

  // 10. Setup Catalog Filter Tabs
  const setupFilters = () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter(btn.getAttribute('data-filter'));
      });
    });
  };

  // 11. Mobile Navigation Drawer Toggle (Class-based, cleans up on resize & link click)
  const setupMobileNav = () => {
    const toggle = document.getElementById('mobile-nav-toggle');
    const nav = document.querySelector('.desktop-nav');
    if (!toggle || !nav) return;

    const closeNav = () => {
      nav.classList.remove('mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = nav.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('click', (e) => {
      if (nav.classList.contains('mobile-open') && !nav.contains(e.target) && e.target !== toggle) {
        closeNav();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeNav();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeStreamModal();
        closeNav();
      }
    });
  };

  // 12. Hydrate All Dynamic Sections (Hero, Bio, Documentary)
  const hydrateDynamicContent = (cfg) => {
    if (!cfg) return;

    if (cfg.site?.title) {
      document.title = cfg.site.title;
    }

    // Hero Section
    if (cfg.hero) {
      const heroBadge = document.getElementById('hero-badge');
      const heroTitle = document.getElementById('hero-title');
      const heroSubtitle = document.getElementById('hero-subtitle');
      const heroCtaPrimary = document.getElementById('hero-cta-primary');
      const heroCtaSecondary = document.getElementById('hero-cta-secondary');

      if (heroBadge && cfg.hero.badge) heroBadge.textContent = cfg.hero.badge;
      if (heroTitle && cfg.hero.title) heroTitle.textContent = cfg.hero.title;
      if (heroSubtitle && cfg.hero.subtitle) {
        const escapedSub = escapeHtml(cfg.hero.subtitle);
        heroSubtitle.innerHTML = escapedSub.replace(/Daniel Belyaev/g, '<strong>Daniel Belyaev</strong>');
      }
      if (heroCtaPrimary) {
        if (cfg.hero.ctaPrimaryText) {
          const span = heroCtaPrimary.querySelector('span');
          if (span) span.textContent = cfg.hero.ctaPrimaryText;
        }
        if (cfg.hero.ctaPrimaryLink) {
          heroCtaPrimary.href = sanitizeUrl(cfg.hero.ctaPrimaryLink, '#latest');
        }
      }
      if (heroCtaSecondary) {
        if (cfg.hero.ctaSecondaryText) {
          const span = heroCtaSecondary.querySelector('span');
          if (span) span.textContent = cfg.hero.ctaSecondaryText;
        }
        if (cfg.hero.ctaSecondaryLink) {
          heroCtaSecondary.href = sanitizeUrl(cfg.hero.ctaSecondaryLink, '#about');
        }
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

      if (bioPhoto && cfg.bio.photoUrl) {
        bioPhoto.src = sanitizeUrl(cfg.bio.photoUrl, 'assets/BGM Daniel Belyaev Photo.png');
      }
      if (bioCapName && cfg.bio.captionName) bioCapName.textContent = cfg.bio.captionName;
      if (bioCapRole && cfg.bio.captionRole) bioCapRole.textContent = cfg.bio.captionRole;
      if (bioLead && cfg.bio.lead) bioLead.textContent = cfg.bio.lead;
      if (bioP1 && cfg.bio.paragraph1) bioP1.textContent = cfg.bio.paragraph1;
      if (bioP2 && cfg.bio.paragraph2) bioP2.textContent = cfg.bio.paragraph2;
      if (bioQuote && cfg.bio.quote) {
        const cleanQuote = cfg.bio.quote.replace(/^["«]|["»]$/g, '').trim();
        bioQuote.textContent = `"${cleanQuote}"`;
      }
      if (bioQuoteAuthor && cfg.bio.quoteAuthor) {
        const cleanAuthor = cfg.bio.quoteAuthor.replace(/^[—\-]\s*/, '').trim();
        bioQuoteAuthor.textContent = `— ${cleanAuthor}`;
      }

      if (bioStatsMount && Array.isArray(cfg.bio.stats)) {
        bioStatsMount.innerHTML = cfg.bio.stats.map(s => `
          <div class="stat-item">
            <span class="stat-kicker">${escapeHtml(s.kicker)}</span>
            <span class="stat-value-text">${escapeHtml(s.value)}</span>
          </div>
        `).join('');
      }
    }

    // Documentary Section (16:9 Cinema Poster Showcase + Built-in YouTube Player)
    const filmSection = document.getElementById('film');
    const filmNavLink = document.querySelector('.desktop-nav a[href="#film"]');
    if (filmSection) {
      if (cfg.documentary && cfg.documentary.enabled === false) {
        filmSection.style.display = 'none';
        if (filmNavLink) filmNavLink.style.display = 'none';
      } else if (cfg.documentary) {
        filmSection.style.display = 'block';
        if (filmNavLink) filmNavLink.style.display = '';
        const docBadge = document.getElementById('doc-badge');
        const docSpecMeta = document.getElementById('doc-spec-meta');
        const docPlatformBadge = document.getElementById('doc-platform-badge');
        const docPosterImg = document.getElementById('doc-poster-img');
        const docTitle = document.getElementById('doc-title');
        const docDesc = document.getElementById('doc-desc');
        const docBtn = document.getElementById('doc-btn');
        const docBtnText = document.getElementById('doc-btn-text');
        const docBtnIcon = document.getElementById('doc-btn-icon');
        const docLinkPlay = document.getElementById('doc-link-play');
        const docPlayCaption = document.getElementById('doc-play-caption');
        const docPlayerOverlay = document.getElementById('doc-player-overlay');
        const docIframeMount = document.getElementById('doc-iframe-mount');
        const docPlayerClose = document.getElementById('doc-player-close');
        const docPlayerExternal = document.getElementById('doc-player-external');

        const rawLink = String(cfg.documentary.link || '').trim();
        const rawBtnText = String(cfg.documentary.buttonText || 'Watch Documentary on YouTube').trim();
        const lowerLink = rawLink.toLowerCase();
        const lowerBtnText = rawBtnText.toLowerCase();

        // Detect intended platform from URL or button text (fixes mismatch if user edited button text to YouTube)
        const mentionsYouTube = lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be') || lowerBtnText.includes('youtube') || lowerBtnText.includes('ютуб');
        const mentionsVk = lowerLink.includes('vk.com') || lowerLink.includes('vkvideo') || lowerBtnText.includes('vk') || lowerBtnText.includes('вк');
        const mentionsTelegram = (lowerLink.includes('t.me') || lowerLink.includes('telegram') || lowerBtnText.includes('telegram') || lowerBtnText.includes('телеграм')) && !mentionsYouTube;

        // If user set button text to YouTube while link was still the old default Telegram URL, resolve to YouTube channel
        let resolvedLink = rawLink;
        if (mentionsYouTube && (!rawLink || lowerLink === 'https://t.me/belgray_music')) {
          resolvedLink = (cfg.socials && cfg.socials.youtube) ? cfg.socials.youtube : 'https://youtube.com/@belgray_music';
        }
        const safeDocUrl = sanitizeUrl(resolvedLink, 'https://youtube.com/@belgray_music');

        // Extract YouTube Video ID if the link points to a specific YouTube video
        const ytMatch = safeDocUrl.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        const ytVideoId = ytMatch ? ytMatch[1] : null;

        if (docBadge && cfg.documentary.badge) docBadge.textContent = cfg.documentary.badge;
        if (docSpecMeta) {
          docSpecMeta.textContent = (cfg.documentary.spec && cfg.documentary.spec.trim())
            ? cfg.documentary.spec.trim()
            : '4K • STUDIO BREAKDOWN';
        }
        if (docTitle) {
          // Auto-upgrade legacy default title "Behind The Storm" -> "Behind The Anxious Story"
          const rawTitle = (cfg.documentary.title || '').trim();
          docTitle.textContent = (!rawTitle || rawTitle === 'Behind The Storm')
            ? 'Behind The Anxious Story'
            : rawTitle;
        }
        if (docDesc && cfg.documentary.description) docDesc.textContent = cfg.documentary.description;
        if (docBtnText) docBtnText.textContent = rawBtnText;

        // Set platform badge & matching SVG button icon (no more Telegram icon on YouTube button!)
        const platformIcons = {
          youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z"/></svg>`,
          telegram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>`,
          vk: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.78 19.55c-5.46 0-8.58-3.75-8.71-9.99h2.74c.09 4.58 2.11 6.52 3.71 6.92V9.56h2.58v3.95c1.58-.17 3.24-1.97 3.8-3.95h2.58c-.43 2.44-2.23 4.24-3.51 4.98 1.28.6 3.33 2.17 4.11 5.01h-2.84c-.61-1.9-2.13-3.37-4.14-3.57v3.57h-.32z"/></svg>`,
          external: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
        };

        let platformKey = 'external';
        let platformLabel = 'DOCUMENTARY FILM';
        if (mentionsYouTube) {
          platformKey = 'youtube';
          platformLabel = ytVideoId ? 'YOUTUBE • INLINE PLAYER' : 'YOUTUBE FILM';
        } else if (mentionsTelegram) {
          platformKey = 'telegram';
          platformLabel = 'TELEGRAM PREMIERE';
        } else if (mentionsVk) {
          platformKey = 'vk';
          platformLabel = 'VK VIDEO';
        }

        if (docBtnIcon) docBtnIcon.innerHTML = platformIcons[platformKey];
        if (docPlatformBadge) docPlatformBadge.textContent = platformLabel;
        if (docPlayCaption) {
          docPlayCaption.textContent = ytVideoId
            ? 'PLAY IN BUILT-IN CINEMA PLAYER'
            : 'PRESS TO WATCH DOCUMENTARY';
        }

        // Poster image: custom poster -> YouTube maxresdefault (if video ID) -> fallback studio portrait
        if (docPosterImg) {
          const customPoster = (cfg.documentary.posterUrl || '').trim();
          const defaultPortrait = 'assets/BGM Daniel Belyaev Photo.png';
          if (ytVideoId && (!customPoster || customPoster === defaultPortrait)) {
            docPosterImg.src = `https://i.ytimg.com/vi/${ytVideoId}/maxresdefault.jpg`;
            docPosterImg.onerror = () => {
              docPosterImg.onerror = null;
              docPosterImg.src = defaultPortrait;
            };
          } else {
            docPosterImg.src = sanitizeUrl(customPoster || defaultPortrait, defaultPortrait);
            docPosterImg.onerror = () => {
              docPosterImg.onerror = null;
              docPosterImg.src = defaultPortrait;
            };
          }
        }

        if (docBtn) docBtn.href = safeDocUrl;
        if (docLinkPlay) docLinkPlay.href = safeDocUrl;
        if (docPlayerExternal) docPlayerExternal.href = safeDocUrl;

        // Close inline player helper
        const closeInlineDocPlayer = () => {
          if (!docPlayerOverlay || !docIframeMount) return;
          docPlayerOverlay.classList.remove('active');
          docPlayerOverlay.setAttribute('aria-hidden', 'true');
          docIframeMount.innerHTML = '';
        };

        // Open inline 16:9 YouTube player when a YouTube video ID is available
        const openInlineDocPlayer = (e) => {
          if (!ytVideoId || !docPlayerOverlay || !docIframeMount) return;
          e.preventDefault();
          stopCurrentAudio();
          docIframeMount.innerHTML = `
            <iframe
              src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytVideoId)}?autoplay=1&rel=0&modestbranding=1"
              title="${escapeHtml(docTitle ? docTitle.textContent : 'Bel Gray Documentary')}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          `;
          docPlayerOverlay.classList.add('active');
          docPlayerOverlay.setAttribute('aria-hidden', 'false');
        };

        if (docLinkPlay) {
          docLinkPlay.onclick = ytVideoId ? openInlineDocPlayer : null;
        }
        if (docBtn) {
          docBtn.onclick = ytVideoId ? openInlineDocPlayer : null;
        }
        if (docPlayerClose) {
          docPlayerClose.onclick = closeInlineDocPlayer;
        }
        if (!window.__docEscBound) {
          window.__docEscBound = true;
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              const activeOverlay = document.getElementById('doc-player-overlay');
              const mount = document.getElementById('doc-iframe-mount');
              if (activeOverlay && activeOverlay.classList.contains('active')) {
                activeOverlay.classList.remove('active');
                activeOverlay.setAttribute('aria-hidden', 'true');
                if (mount) mount.innerHTML = '';
              }
            }
          });
        }
      }
    }

    // Dynamic Footer (Brand, Ecosystem Social Links, Direct Links & Email, Copyright & Year)
    const footerBrandTitle = document.getElementById('footer-brand-title');
    const footerBrandDesc = document.getElementById('footer-brand-desc');
    const footerEcosystemLinks = document.getElementById('footer-ecosystem-links');
    const footerSmartlink = document.getElementById('footer-smartlink');
    const footerEmailLink = document.getElementById('footer-email-link');
    const footerCopyrightText = document.getElementById('footer-copyright-text');
    const footerTaglineText = document.getElementById('footer-tagline-text');

    const foot = cfg.footer || defaultConfig.footer;
    if (footerBrandTitle) {
      footerBrandTitle.textContent = (foot.brandTitle || 'BEL GRAY').trim();
    }
    if (footerBrandDesc) {
      footerBrandDesc.textContent = (foot.brandDesc || '').trim();
    }

    if (footerEcosystemLinks) {
      const linksArray = (Array.isArray(foot.links) && foot.links.length > 0)
        ? foot.links
        : [
            { title: 'Telegram Channel', url: cfg.socials?.telegram || 'https://t.me/belgray_music' },
            { title: 'YouTube', url: cfg.socials?.youtube || 'https://youtube.com/@belgray_music' },
            { title: 'VK Community', url: cfg.socials?.vk || 'https://vk.com/belgray_music' },
            { title: 'TikTok', url: cfg.socials?.tiktok || 'https://tiktok.com/@belgray_music' }
          ];

      footerEcosystemLinks.innerHTML = linksArray.map(l => {
        const safeUrl = sanitizeUrl(l.url || '#', '#');
        const safeTitle = escapeHtml(l.title || 'Link');
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>`;
      }).join('');
    }

    if (footerSmartlink) {
      const smartUrl = foot.smartlinkUrl || cfg.socials?.smartlink || 'https://band.link/anxious_story';
      footerSmartlink.href = sanitizeUrl(smartUrl, 'https://band.link/anxious_story');
      footerSmartlink.textContent = foot.smartlinkLabel || 'BandLink Smartlink';
    }

    if (footerEmailLink) {
      const emailVal = (foot.email || cfg.socials?.email || 'contact@belgray.com').trim();
      const emailLbl = (foot.emailLabel || 'Inquiries & Booking').trim();
      if (emailVal) {
        footerEmailLink.style.display = '';
        footerEmailLink.href = `mailto:${encodeURIComponent(emailVal)}`;
        footerEmailLink.textContent = emailLbl || emailVal;
      } else {
        footerEmailLink.style.display = 'none';
      }
    }

    if (footerCopyrightText) {
      const year = (foot.copyrightYear || '2026').trim();
      const owner = (foot.copyrightOwner || 'Bel Gray (Daniel Belyaev). All rights reserved.').trim();
      footerCopyrightText.textContent = `© ${year} ${owner}`;
    }

    if (footerTaglineText && foot.bottomTagline) {
      footerTaglineText.textContent = foot.bottomTagline.trim();
    }
  };

  const renderAll = () => {
    if (siteConfig.announcement) {
      updateAnnouncement(siteConfig.announcement);
    }
    hydrateDynamicContent(siteConfig);
    const latestRelease = releases.find(r => r.isLatest) || releases[0];
    renderHeroStreamingCarousel(latestRelease);
    setupHeroCarouselEngine();
    renderFeatured(latestRelease);
    applyFilter(activeFilterCategory);
  };

  // 13. Ambient Dynamic Cursor Glow
  const setupAmbientSpotlight = () => {
    const spotlight = document.getElementById('ambient-spotlight');
    if (!spotlight) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let curX = mouseX;
    let curY = mouseY;
    let isMoving = false;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isMoving) {
        isMoving = true;
        requestAnimationFrame(updateSpotlight);
      }
    }, { passive: true });

    function updateSpotlight() {
      curX += (mouseX - curX) * 0.12;
      curY += (mouseY - curY) * 0.12;
      spotlight.style.left = `${curX.toFixed(1)}px`;
      spotlight.style.top = `${curY.toFixed(1)}px`;

      if (Math.abs(mouseX - curX) > 0.4 || Math.abs(mouseY - curY) > 0.4) {
        requestAnimationFrame(updateSpotlight);
      } else {
        isMoving = false;
      }
    }
  };

  // 14. Initialize & Listen for Live Admin Updates Across Browser Tabs
  await loadStateData();
  renderAll();
  setupFilters();
  setupMobileNav();
  setupAmbientSpotlight();

  window.addEventListener('storage', async (e) => {
    if (e.key === 'belgray_site_config' || e.key === 'belgray_releases') {
      await loadStateData();
      renderAll();
    }
  });
});
