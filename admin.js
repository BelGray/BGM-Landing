/**
 * BEL GRAY STUDIO CONTROL — ADMIN CONTROLLER
 * Security-Hardened & Fully Pre-Populated Studio Engine
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Security & Sanitization Helpers
  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const sanitizeUrl = (url, fallback = '') => {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith('#') || trimmed.startsWith('assets/') || trimmed.startsWith('./assets/') || trimmed.startsWith('/assets/')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return trimmed;
      }
    } catch (_) {
      // Invalid URL
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

  // Pure-JS SHA-256 (Works reliably on both file:// and https:// without exposing plaintext PIN)
  const sha256Salted = (pin) => {
    const ascii = unescape(encodeURIComponent(`belgray_studio_salt_v1:${pin}`));
    const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = '';
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    let msg = ascii + '\x80';
    while ((msg.length % 64) - 56) msg += '\x00';
    for (let i = 0; i < msg.length; i++) {
      const j = msg.charCodeAt(i);
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : '') + b.toString(16);
      }
    }
    return result;
  };

  // Salted SHA-256 hash of default Studio PIN (no plaintext stored in source)
  const DEFAULT_PIN_HASH = '33dfc76212c6e91cfbbee310e77c5953f1c4f68714529410bf1f5ebbd7266388';
  const MAX_AUTH_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 30000;

  // 1. PIN Auth Handling with Brute-Force Rate Limiting
  const authGate = document.getElementById('admin-auth-gate');
  const dashboard = document.getElementById('admin-dashboard');
  const authForm = document.getElementById('auth-form');
  const pinInput = document.getElementById('admin-pin-input');
  const authHint = document.getElementById('auth-status-hint');
  const btnLock = document.getElementById('btn-lock');

  // Migrate any legacy plaintext PIN in localStorage to hashed format
  const legacyPlainPin = localStorage.getItem('belgray_admin_pin');
  if (legacyPlainPin) {
    localStorage.setItem('belgray_admin_pin_hash', sha256Salted(legacyPlainPin));
    localStorage.removeItem('belgray_admin_pin');
  }

  const isUnlocked = sessionStorage.getItem('belgray_admin_unlocked');
  if (isUnlocked === 'true') {
    authGate.style.display = 'none';
    dashboard.style.display = 'grid';
  }

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const lockoutUntil = parseInt(sessionStorage.getItem('belgray_auth_lockout') || '0', 10);
    const now = Date.now();
    if (lockoutUntil > now) {
      const waitSec = Math.ceil((lockoutUntil - now) / 1000);
      showToast(`Too many failed attempts. Wait ${waitSec}s.`);
      return;
    }

    const enteredPin = pinInput.value.trim();
    const enteredHash = sha256Salted(enteredPin);
    const expectedHash = localStorage.getItem('belgray_admin_pin_hash') || DEFAULT_PIN_HASH;

    if (enteredHash === expectedHash) {
      sessionStorage.removeItem('belgray_auth_attempts');
      sessionStorage.removeItem('belgray_auth_lockout');
      sessionStorage.setItem('belgray_admin_unlocked', 'true');
      pinInput.value = '';
      authGate.style.display = 'none';
      dashboard.style.display = 'grid';
    } else {
      const attempts = parseInt(sessionStorage.getItem('belgray_auth_attempts') || '0', 10) + 1;
      sessionStorage.setItem('belgray_auth_attempts', String(attempts));
      pinInput.value = '';
      pinInput.style.borderColor = '#FF3B30';

      if (attempts >= MAX_AUTH_ATTEMPTS) {
        sessionStorage.setItem('belgray_auth_lockout', String(now + LOCKOUT_DURATION_MS));
        sessionStorage.setItem('belgray_auth_attempts', '0');
        if (authHint) authHint.textContent = 'Temporarily locked for 30s due to failed attempts';
        showToast('Too many failed attempts. Locked for 30 seconds.');
      } else {
        const remaining = MAX_AUTH_ATTEMPTS - attempts;
        if (authHint) authHint.textContent = `Invalid PIN (${remaining} attempts remaining)`;
        showToast('Incorrect PIN. Please try again.');
      }
    }
  });

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      sessionStorage.removeItem('belgray_admin_unlocked');
      location.reload();
    });
  }

  // Update Studio PIN handler
  const newPinInput = document.getElementById('cfg-new-pin');
  const btnUpdatePin = document.getElementById('btn-update-pin');
  if (btnUpdatePin && newPinInput) {
    btnUpdatePin.addEventListener('click', () => {
      const val = newPinInput.value.trim();
      if (val.length < 4 || val.length > 12) {
        showToast('PIN must be between 4 and 12 characters.');
        return;
      }
      localStorage.setItem('belgray_admin_pin_hash', sha256Salted(val));
      newPinInput.value = '';
      showToast('Studio PIN updated and hashed!');
    });
  }

  // 2. Complete Default State (Works 100% offline & over file:// protocol)
  const defaultSiteConfig = {
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

  let siteConfig = JSON.parse(JSON.stringify(defaultSiteConfig));
  let releases = JSON.parse(JSON.stringify(defaultReleases));

  // Helper to merge non-empty values so blank strings never overwrite defaults
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

  try {
    const savedConfig = localStorage.getItem('belgray_site_config');
    const savedReleases = localStorage.getItem('belgray_releases');

    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      siteConfig = {
        ...defaultSiteConfig,
        ...parsed,
        site: mergeNonEmpty(defaultSiteConfig.site, parsed.site),
        hero: mergeNonEmpty(defaultSiteConfig.hero, parsed.hero),
        announcement: mergeNonEmpty(defaultSiteConfig.announcement, parsed.announcement),
        bio: mergeNonEmpty(defaultSiteConfig.bio, parsed.bio),
        documentary: mergeNonEmpty(defaultSiteConfig.documentary, parsed.documentary),
        socials: mergeNonEmpty(defaultSiteConfig.socials, parsed.socials),
        footer: parsed.footer ? {
          ...defaultSiteConfig.footer,
          ...parsed.footer,
          links: Array.isArray(parsed.footer.links) ? parsed.footer.links : defaultSiteConfig.footer.links
        } : defaultSiteConfig.footer
      };
    } else {
      const res = await fetch('data/site-config.json');
      if (res.ok) siteConfig = await res.json();
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
      const res = await fetch('data/releases.json');
      if (res.ok) {
        const jsonReleases = await res.json();
        if (Array.isArray(jsonReleases) && jsonReleases.length > 0) {
          releases = jsonReleases;
        }
      }
    }
  } catch (err) {
    console.info('Loaded admin with embedded default data:', err.message);
  }

  // 3. Tab Switching
  const navItems = document.querySelectorAll('.admin-nav-item');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');
  const activeTitle = document.getElementById('tab-active-title');

  const tabTitles = {
    'tab-announcement': 'Hot Announcement Banner',
    'tab-hero': 'Hero Section & Mission',
    'tab-releases': 'Discography & Releases Manager',
    'tab-bio': 'The Producer — Bio & Portrait',
    'tab-media': 'Documentary & Media Hub',
    'tab-theme': 'Era Theme & Visual Styling',
    'tab-footer': 'Footer, Socials & Copyright',
    'tab-sync': 'Cloud & Security Settings'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      navItems.forEach(i => i.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');
      if (activeTitle) activeTitle.textContent = tabTitles[targetTab] || 'Studio Settings';
    });
  });

  // 4. Form Binding: Announcement
  const bannerEnabled = document.getElementById('cfg-banner-enabled');
  const bannerBadge = document.getElementById('cfg-banner-badge');
  const bannerBtnText = document.getElementById('cfg-banner-btn-text');
  const bannerText = document.getElementById('cfg-banner-text');
  const bannerLink = document.getElementById('cfg-banner-link');

  const prevBadge = document.getElementById('prev-banner-badge');
  const prevText = document.getElementById('prev-banner-text');
  const prevBtn = document.getElementById('prev-banner-btn');

  const populateBannerForm = () => {
    const ann = siteConfig.announcement || defaultSiteConfig.announcement;
    bannerEnabled.checked = ann.enabled !== false;
    bannerBadge.value = ann.badge || defaultSiteConfig.announcement.badge;
    bannerBtnText.value = ann.buttonText || defaultSiteConfig.announcement.buttonText;
    bannerText.value = ann.text || defaultSiteConfig.announcement.text;
    bannerLink.value = ann.link || defaultSiteConfig.announcement.link;
    updateBannerPreview();
  };

  const updateBannerPreview = () => {
    if (prevBadge) prevBadge.textContent = bannerBadge.value || 'OUT NOW';
    if (prevText) prevText.textContent = bannerText.value || '';
    if (prevBtn) prevBtn.textContent = bannerBtnText.value || 'Listen';
  };

  [bannerBadge, bannerBtnText, bannerText].forEach(el => {
    if (el) el.addEventListener('input', updateBannerPreview);
  });

  // 4B. Form Binding: Hero
  const heroBadge = document.getElementById('cfg-hero-badge');
  const heroTitle = document.getElementById('cfg-hero-title');
  const heroSubtitle = document.getElementById('cfg-hero-subtitle');
  const heroCta1 = document.getElementById('cfg-hero-cta1');
  const heroCta2 = document.getElementById('cfg-hero-cta2');

  const populateHeroForm = () => {
    const h = siteConfig.hero || defaultSiteConfig.hero;
    if (heroBadge) heroBadge.value = h.badge || defaultSiteConfig.hero.badge;
    if (heroTitle) heroTitle.value = h.title || defaultSiteConfig.hero.title;
    if (heroSubtitle) heroSubtitle.value = h.subtitle || defaultSiteConfig.hero.subtitle;
    if (heroCta1) heroCta1.value = h.ctaPrimaryText || defaultSiteConfig.hero.ctaPrimaryText;
    if (heroCta2) heroCta2.value = h.ctaSecondaryText || defaultSiteConfig.hero.ctaSecondaryText;
  };

  // 4C. Form Binding: Bio & Portrait
  const bioPhoto = document.getElementById('cfg-bio-photo');
  const bioCapName = document.getElementById('cfg-bio-cap-name');
  const bioLead = document.getElementById('cfg-bio-lead');
  const bioP1 = document.getElementById('cfg-bio-p1');
  const bioP2 = document.getElementById('cfg-bio-p2');
  const bioQuote = document.getElementById('cfg-bio-quote');
  const bioQuoteAuthor = document.getElementById('cfg-bio-quote-author');

  const populateBioForm = () => {
    const b = siteConfig.bio || defaultSiteConfig.bio;
    if (bioPhoto) bioPhoto.value = b.photoUrl || defaultSiteConfig.bio.photoUrl;
    if (bioCapName) bioCapName.value = b.captionName || defaultSiteConfig.bio.captionName;
    if (bioLead) bioLead.value = b.lead || defaultSiteConfig.bio.lead;
    if (bioP1) bioP1.value = b.paragraph1 || defaultSiteConfig.bio.paragraph1;
    if (bioP2) bioP2.value = b.paragraph2 || defaultSiteConfig.bio.paragraph2;
    if (bioQuote) bioQuote.value = b.quote || defaultSiteConfig.bio.quote;
    if (bioQuoteAuthor) bioQuoteAuthor.value = b.quoteAuthor || defaultSiteConfig.bio.quoteAuthor;
  };

  // 4D. Form Binding: Documentary / Media
  const docEnabled = document.getElementById('cfg-doc-enabled');
  const docBadge = document.getElementById('cfg-doc-badge');
  const docTitle = document.getElementById('cfg-doc-title');
  const docSpec = document.getElementById('cfg-doc-spec');
  const docPoster = document.getElementById('cfg-doc-poster');
  const docDesc = document.getElementById('cfg-doc-desc');
  const docBtnText = document.getElementById('cfg-doc-btn-text');
  const docLink = document.getElementById('cfg-doc-link');

  const populateDocForm = () => {
    const d = siteConfig.documentary || defaultSiteConfig.documentary;
    if (docEnabled) docEnabled.checked = d.enabled !== false;
    if (docBadge) docBadge.value = d.badge || defaultSiteConfig.documentary.badge;
    if (docTitle) docTitle.value = d.title || defaultSiteConfig.documentary.title;
    if (docSpec) docSpec.value = d.spec || defaultSiteConfig.documentary.spec;
    if (docPoster) docPoster.value = d.posterUrl !== undefined ? d.posterUrl : defaultSiteConfig.documentary.posterUrl;
    if (docDesc) docDesc.value = d.description || defaultSiteConfig.documentary.description;
    if (docBtnText) docBtnText.value = d.buttonText || defaultSiteConfig.documentary.buttonText;
    if (docLink) docLink.value = d.link || defaultSiteConfig.documentary.link;
  };

  // 4E. Form Binding: Supabase Config
  const supabaseUrlInput = document.getElementById('cfg-supabase-url');
  const supabaseKeyInput = document.getElementById('cfg-supabase-key');
  const syncStatusText = document.getElementById('sync-status-text');

  const populateSupabaseForm = () => {
    try {
      const savedSb = JSON.parse(localStorage.getItem('belgray_supabase_cfg') || '{}');
      if (supabaseUrlInput && savedSb.url) supabaseUrlInput.value = savedSb.url;
      if (supabaseKeyInput && savedSb.key) supabaseKeyInput.value = savedSb.key;
      if (syncStatusText && savedSb.url && savedSb.key) {
        syncStatusText.textContent = 'CLOUD + LOCAL SYNC READY';
      }
    } catch (_) {}
  };

  // 4F. Form Binding: Footer, Socials & Copyright
  const footerEmailInput = document.getElementById('cfg-footer-email');
  const footerEmailLabelInput = document.getElementById('cfg-footer-email-label');
  const footerSmartlinkUrlInput = document.getElementById('cfg-footer-smartlink-url');
  const footerSmartlinkLabelInput = document.getElementById('cfg-footer-smartlink-label');
  const footerYearInput = document.getElementById('cfg-footer-year');
  const footerOwnerInput = document.getElementById('cfg-footer-owner');
  const footerBrandTitleInput = document.getElementById('cfg-footer-brand-title');
  const footerBrandDescInput = document.getElementById('cfg-footer-brand-desc');
  const footerBottomTaglineInput = document.getElementById('cfg-footer-bottom-tagline');
  const footerLinksRowsMount = document.getElementById('footer-links-rows');
  const btnAddFooterLink = document.getElementById('btn-add-footer-link');

  let editingFooterLinks = [];

  const renderFooterLinksRows = () => {
    if (!footerLinksRowsMount) return;
    if (editingFooterLinks.length === 0) {
      footerLinksRowsMount.innerHTML = `
        <div style="padding: 14px; background: #0B0B10; border: 1px dashed var(--border-medium); border-radius: var(--radius-sm); text-align: center; color: var(--text-muted); font-size: 13px;">
          No social links configured yet. Click <strong>+ Add Social Link</strong> to add one.
        </div>
      `;
      return;
    }

    footerLinksRowsMount.innerHTML = editingFooterLinks.map((link, idx) => `
      <div class="footer-link-edit-row" data-idx="${idx}" style="display: grid; grid-template-columns: 200px 1fr 38px; gap: 8px; align-items: center; background: #0C0C12; border: 1px solid var(--border-subtle); padding: 8px 12px; border-radius: var(--radius-sm);">
        <input type="text" class="admin-input flink-title" data-idx="${idx}" value="${escapeHtml(link.title || '')}" placeholder="e.g. Telegram Channel, YouTube, VK">
        <input type="text" class="admin-input flink-url" data-idx="${idx}" value="${escapeHtml(link.url || '')}" placeholder="https://...">
        <button type="button" class="btn btn-sm btn-ghost btn-remove-flink" data-idx="${idx}" title="Delete Link" style="color: #FF453A; padding: 6px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
    `).join('');

    footerLinksRowsMount.querySelectorAll('.btn-remove-flink').forEach(btn => {
      btn.addEventListener('click', () => {
        syncFooterLinksFromDOM();
        const i = parseInt(btn.dataset.idx, 10);
        editingFooterLinks.splice(i, 1);
        renderFooterLinksRows();
      });
    });
  };

  const syncFooterLinksFromDOM = () => {
    if (!footerLinksRowsMount) return;
    const rows = footerLinksRowsMount.querySelectorAll('.footer-link-edit-row');
    if (rows.length === 0 && editingFooterLinks.length === 0) return;
    editingFooterLinks = Array.from(rows).map(row => ({
      title: row.querySelector('.flink-title')?.value.trim() || 'Link',
      url: sanitizeUrl(row.querySelector('.flink-url')?.value.trim() || '#', '#')
    }));
  };

  if (btnAddFooterLink) {
    btnAddFooterLink.addEventListener('click', () => {
      syncFooterLinksFromDOM();
      editingFooterLinks.push({
        title: 'New Social',
        url: 'https://'
      });
      renderFooterLinksRows();
    });
  }

  const populateFooterForm = () => {
    const f = siteConfig.footer || defaultSiteConfig.footer;
    if (footerEmailInput) footerEmailInput.value = f.email !== undefined ? f.email : defaultSiteConfig.footer.email;
    if (footerEmailLabelInput) footerEmailLabelInput.value = f.emailLabel || defaultSiteConfig.footer.emailLabel;
    if (footerSmartlinkUrlInput) footerSmartlinkUrlInput.value = f.smartlinkUrl || defaultSiteConfig.footer.smartlinkUrl;
    if (footerSmartlinkLabelInput) footerSmartlinkLabelInput.value = f.smartlinkLabel || defaultSiteConfig.footer.smartlinkLabel;
    if (footerYearInput) footerYearInput.value = f.copyrightYear || defaultSiteConfig.footer.copyrightYear;
    if (footerOwnerInput) footerOwnerInput.value = f.copyrightOwner || defaultSiteConfig.footer.copyrightOwner;
    if (footerBrandTitleInput) footerBrandTitleInput.value = f.brandTitle || defaultSiteConfig.footer.brandTitle;
    if (footerBrandDescInput) footerBrandDescInput.value = f.brandDesc || defaultSiteConfig.footer.brandDesc;
    if (footerBottomTaglineInput) footerBottomTaglineInput.value = f.bottomTagline || defaultSiteConfig.footer.bottomTagline;

    if (Array.isArray(f.links) && f.links.length > 0) {
      editingFooterLinks = JSON.parse(JSON.stringify(f.links));
    } else {
      editingFooterLinks = JSON.parse(JSON.stringify(defaultSiteConfig.footer.links));
    }
    renderFooterLinksRows();
  };

  // 5. Theme Studio Binding with Dynamic Contrast Calculation
  const colorPicker = document.getElementById('cfg-theme-picker');
  const colorInput = document.getElementById('cfg-theme-color');
  const presetPills = document.querySelectorAll('.preset-pill');

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

  const applyColorAdmin = (rawHex) => {
    const hex = normalizeHexColor(rawHex, '#FF5722');
    const contrastColor = getContrastColor(hex);
    const hoverColor = getHoverColor(hex);
    document.documentElement.style.setProperty('--accent-color', hex);
    document.documentElement.style.setProperty('--accent-hover', hoverColor);
    document.documentElement.style.setProperty('--accent-contrast', contrastColor);
    document.documentElement.style.setProperty('--accent-glow', `${hex}38`);
    document.documentElement.style.setProperty('--accent-subtle', `${hex}18`);
    document.documentElement.style.setProperty('--accent-border', `${hex}66`);
    if (colorPicker) colorPicker.value = hex;
    if (colorInput) colorInput.value = hex;

    presetPills.forEach(p => {
      const pillHex = normalizeHexColor(p.dataset.color, '');
      p.classList.toggle('active', pillHex === hex);
    });
  };

  const initialColor = siteConfig.site?.activeEraColor || '#FF5722';
  applyColorAdmin(initialColor);

  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      applyColorAdmin(e.target.value);
    });
  }

  if (colorInput) {
    colorInput.addEventListener('change', (e) => {
      applyColorAdmin(e.target.value);
    });
  }

  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      applyColorAdmin(pill.dataset.color);
    });
  });

  // 6. Releases Management (Add, Edit with Pre-filled Fields, Feature, Delete)
  const releasesListMount = document.getElementById('releases-admin-list');
  const btnToggleAdd = document.getElementById('btn-toggle-add-release');
  const addPanel = document.getElementById('add-release-panel');
  const btnCancelAdd = document.getElementById('btn-cancel-add-release');
  const btnSaveNewRelease = document.getElementById('btn-save-new-release');
  const formHeading = document.getElementById('release-form-heading');
  const editRelIndexInput = document.getElementById('edit-rel-index');
  const btnSaveReleaseLabel = document.getElementById('btn-save-release-label');

  const relTitleInput = document.getElementById('new-rel-title');
  const relTypeSelect = document.getElementById('new-rel-type');
  const relYearInput = document.getElementById('new-rel-year');
  const relDateInput = document.getElementById('new-rel-date');
  const relDatePicker = document.getElementById('new-rel-date-picker');
  const relCoverInput = document.getElementById('new-rel-cover');
  const relStatusSelect = document.getElementById('new-rel-status');
  const relTaglineInput = document.getElementById('new-rel-tagline');
  const relCraftSelect = document.getElementById('new-rel-craft');
  const relCraftSummaryInput = document.getElementById('new-rel-craft-summary');
  const relSmartlinkInput = document.getElementById('new-rel-smartlink');
  const relFeaturedCheckbox = document.getElementById('new-rel-featured');
  const tracklistRowsMount = document.getElementById('admin-tracklist-rows');
  const btnAddTrackRow = document.getElementById('btn-add-track-row');

  if (relDatePicker && relDateInput) {
    relDatePicker.addEventListener('change', () => {
      if (relDatePicker.value) {
        relDateInput.value = relDatePicker.value;
        const pickedYear = relDatePicker.value.split('-')[0];
        if (pickedYear && /^\d{4}$/.test(pickedYear) && relYearInput) {
          relYearInput.value = pickedYear;
        }
      }
    });
    relDateInput.addEventListener('input', () => {
      const val = relDateInput.value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        relDatePicker.value = val;
      }
    });
  }

  let editingTracks = [];

  const renderTrackEditorRows = () => {
    if (!tracklistRowsMount) return;
    tracklistRowsMount.innerHTML = editingTracks.map((t, idx) => `
      <div class="track-edit-row" style="display: grid; grid-template-columns: 56px 1.5fr 1fr 76px 1.2fr 36px; gap: 8px; align-items: center;">
        <input type="text" class="admin-input trk-num" data-idx="${idx}" value="${escapeHtml(t.number || String(idx + 1).padStart(2, '0'))}" placeholder="01">
        <input type="text" class="admin-input trk-title" data-idx="${idx}" value="${escapeHtml(t.title || '')}" placeholder="Track Title">
        <input type="text" class="admin-input trk-genre" data-idx="${idx}" value="${escapeHtml(t.genre || '')}" placeholder="Genre">
        <input type="text" class="admin-input trk-dur" data-idx="${idx}" value="${escapeHtml(t.duration || '03:00')}" placeholder="03:00">
        <input type="text" class="admin-input trk-prev" data-idx="${idx}" value="${escapeHtml(t.previewUrl || '')}" placeholder="Audio URL (optional)">
        <button type="button" class="btn btn-sm btn-ghost btn-remove-trk" data-idx="${idx}" style="color: #FF453A; padding: 6px;">✕</button>
      </div>
    `).join('');

    tracklistRowsMount.querySelectorAll('.btn-remove-trk').forEach(btn => {
      btn.addEventListener('click', () => {
        syncEditingTracksFromDOM();
        const i = parseInt(btn.dataset.idx, 10);
        editingTracks.splice(i, 1);
        renderTrackEditorRows();
      });
    });
  };

  const syncEditingTracksFromDOM = () => {
    if (!tracklistRowsMount) return;
    const rows = tracklistRowsMount.querySelectorAll('.track-edit-row');
    editingTracks = Array.from(rows).map((row, idx) => ({
      number: row.querySelector('.trk-num')?.value.trim() || String(idx + 1).padStart(2, '0'),
      title: row.querySelector('.trk-title')?.value.trim() || `Track ${idx + 1}`,
      genre: row.querySelector('.trk-genre')?.value.trim() || 'Electronic',
      duration: row.querySelector('.trk-dur')?.value.trim() || '03:00',
      previewUrl: sanitizeUrl(row.querySelector('.trk-prev')?.value.trim() || '', '')
    }));
  };

  if (btnAddTrackRow) {
    btnAddTrackRow.addEventListener('click', () => {
      syncEditingTracksFromDOM();
      const nextNum = String(editingTracks.length + 1).padStart(2, '0');
      editingTracks.push({
        number: nextNum,
        title: `Track ${nextNum}`,
        genre: 'Melodic Electronic',
        duration: '03:00',
        previewUrl: ''
      });
      renderTrackEditorRows();
    });
  }

  const craftSpecDefaults = {
    'pure': { badge: 'Pure Studio Craft', type: 'pure', summary: '100% Handcrafted Acoustic Piano Suite & FL Studio Master' },
    'hybrid': { badge: 'Hybrid Concept', type: 'hybrid', summary: 'Piano Harmony by Daniel Belyaev • Neural Vocal Synthesis • FL Studio DAW Engineering' },
    'acoustic': { badge: 'Acoustic Piano Suite', type: 'acoustic', summary: 'Acoustic Grand Piano Master' }
  };

  if (relCraftSelect && relCraftSummaryInput) {
    relCraftSelect.addEventListener('change', () => {
      const selected = craftSpecDefaults[relCraftSelect.value];
      if (selected) relCraftSummaryInput.value = selected.summary;
    });
  }

  const openReleaseFormForAdd = () => {
    const todayIso = new Date().toISOString().split('T')[0];
    if (editRelIndexInput) editRelIndexInput.value = '-1';
    if (formHeading) formHeading.textContent = 'Add New Release';
    if (btnSaveReleaseLabel) btnSaveReleaseLabel.textContent = 'Save New Release';

    if (relTitleInput) relTitleInput.value = 'New Single';
    if (relTypeSelect) relTypeSelect.value = 'Single';
    if (relYearInput) relYearInput.value = todayIso.split('-')[0] || '2026';
    if (relDateInput) relDateInput.value = todayIso;
    if (relDatePicker) relDatePicker.value = todayIso;
    if (relCoverInput) relCoverInput.value = 'assets/Anxious Story.jpg';
    if (relStatusSelect) relStatusSelect.value = 'OUT NOW';
    if (relTaglineInput) relTaglineInput.value = 'Solo piano touch meeting the energy of melodic progressive house.';
    if (relCraftSelect) relCraftSelect.value = 'pure';
    if (relCraftSummaryInput) relCraftSummaryInput.value = craftSpecDefaults['pure'].summary;
    if (relSmartlinkInput) relSmartlinkInput.value = 'https://band.link/anxious_story';
    if (relFeaturedCheckbox) relFeaturedCheckbox.checked = true;

    editingTracks = [
      { number: "01", title: "New Single", duration: "03:00", genre: "Melodic Progressive House", previewUrl: "" }
    ];
    renderTrackEditorRows();

    addPanel.style.display = 'block';
  };

  const openReleaseFormForEdit = (index) => {
    const rel = releases[index];
    if (!rel) return;

    if (editRelIndexInput) editRelIndexInput.value = String(index);
    if (formHeading) formHeading.textContent = `Edit Release: ${rel.title}`;
    if (btnSaveReleaseLabel) btnSaveReleaseLabel.textContent = 'Update Release';

    if (relTitleInput) relTitleInput.value = rel.title || '';
    if (relTypeSelect) relTypeSelect.value = rel.type || 'EP';
    if (relYearInput) relYearInput.value = rel.year || '2026';
    if (relDateInput) relDateInput.value = rel.releaseDate || '';
    if (relDatePicker && /^\d{4}-\d{2}-\d{2}$/.test(rel.releaseDate || '')) {
      relDatePicker.value = rel.releaseDate;
    }
    if (relCoverInput) relCoverInput.value = rel.coverUrl || 'assets/Anxious Story.jpg';
    if (relStatusSelect) relStatusSelect.value = rel.status || 'OUT NOW';
    if (relTaglineInput) relTaglineInput.value = rel.tagline || '';

    const craftType = rel.craftSpec?.type && craftSpecDefaults[rel.craftSpec.type] ? rel.craftSpec.type : 'hybrid';
    if (relCraftSelect) relCraftSelect.value = craftType;
    if (relCraftSummaryInput) relCraftSummaryInput.value = rel.craftSpec?.summary || craftSpecDefaults[craftType].summary;
    if (relSmartlinkInput) relSmartlinkInput.value = rel.smartlink || 'https://band.link/anxious_story';
    if (relFeaturedCheckbox) relFeaturedCheckbox.checked = Boolean(rel.isLatest);

    editingTracks = Array.isArray(rel.tracklist) && rel.tracklist.length > 0
      ? JSON.parse(JSON.stringify(rel.tracklist))
      : [{ number: "01", title: rel.title || "Track 01", duration: "03:00", genre: "Melodic Electronic", previewUrl: "" }];
    renderTrackEditorRows();

    addPanel.style.display = 'block';
  };

  if (btnToggleAdd) {
    btnToggleAdd.addEventListener('click', () => {
      if (addPanel.style.display === 'block' && editRelIndexInput?.value === '-1') {
        addPanel.style.display = 'none';
      } else {
        openReleaseFormForAdd();
      }
    });
  }

  if (btnCancelAdd) {
    btnCancelAdd.addEventListener('click', () => {
      addPanel.style.display = 'none';
      if (editRelIndexInput) editRelIndexInput.value = '-1';
    });
  }

  const persistReleasesImmediate = () => {
    if (releases.length > 0 && !releases.some(r => r.isLatest)) {
      releases[0].isLatest = true;
    }
    localStorage.setItem('belgray_releases', JSON.stringify(releases));
  };

  const renderReleasesAdmin = () => {
    if (!releasesListMount) return;

    if (releases.length === 0) {
      releasesListMount.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No releases in catalog. Click "+ Add New Release" above.</div>`;
      return;
    }

    releasesListMount.innerHTML = releases.map((rel, index) => {
      const safeCover = sanitizeUrl(rel.coverUrl, 'assets/Anxious Story.jpg');
      return `
        <div class="release-admin-row">
          <div class="release-row-left">
            <img src="${escapeHtml(safeCover)}" alt="${escapeHtml(rel.title)}" class="release-row-thumb">
            <div class="release-row-info">
              <span class="release-row-title">${escapeHtml(rel.title)} ${rel.isLatest ? ' <span style="color: var(--accent-color);">[FEATURED HERO]</span>' : ''}</span>
              <span class="release-row-meta">${escapeHtml(rel.type)} • ${escapeHtml(rel.year)}${rel.releaseDate ? ' (' + escapeHtml(rel.releaseDate) + ')' : ''} • ${escapeHtml(rel.status || 'OUT NOW')} • ${escapeHtml(rel.craftSpec ? rel.craftSpec.badge : 'Studio')}</span>
            </div>
          </div>
          <div class="release-row-actions">
            <button type="button" class="btn btn-sm btn-ghost btn-edit-release" data-index="${index}">
              Edit
            </button>
            ${!rel.isLatest ? `
              <button type="button" class="btn btn-sm btn-outline btn-make-featured" data-index="${index}">
                Feature on Hero
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-ghost btn-delete-release" data-index="${index}" style="color: #FF453A;">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Edit action
    document.querySelectorAll('.btn-edit-release').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        openReleaseFormForEdit(idx);
      });
    });

    // Feature action
    document.querySelectorAll('.btn-make-featured').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (!releases[idx]) return;
        releases.forEach(r => r.isLatest = false);
        releases[idx].isLatest = true;
        persistReleasesImmediate();
        renderReleasesAdmin();
        showToast(`'${releases[idx].title}' set as Featured on Hero!`);
      });
    });

    // Delete action
    document.querySelectorAll('.btn-delete-release').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (!releases[idx]) return;
        const targetTitle = releases[idx].title;
        if (confirm(`Delete release '${targetTitle}'?`)) {
          releases.splice(idx, 1);
          // Close edit form if open so stale index is never saved
          if (addPanel) addPanel.style.display = 'none';
          if (editRelIndexInput) editRelIndexInput.value = '-1';
          persistReleasesImmediate();
          renderReleasesAdmin();
          showToast(`'${targetTitle}' deleted and saved!`);
        }
      });
    });
  };

  if (btnSaveNewRelease) {
    btnSaveNewRelease.addEventListener('click', () => {
      const title = relTitleInput.value.trim();
      if (!title) {
        alert('Please enter a title');
        return;
      }

      const editIdx = parseInt(editRelIndexInput?.value || '-1', 10);
      const type = relTypeSelect.value;
      const year = relYearInput.value.trim() || '2026';
      const releaseDate = relDateInput ? relDateInput.value.trim() : new Date().toISOString().split('T')[0];
      const coverUrl = sanitizeUrl(relCoverInput.value.trim(), 'assets/Anxious Story.jpg');
      const status = relStatusSelect.value;
      const tagline = relTaglineInput.value.trim();
      const craft = relCraftSelect.value;
      const craftSummary = relCraftSummaryInput?.value.trim() || craftSpecDefaults[craft]?.summary || '';
      const smartlink = sanitizeUrl(relSmartlinkInput.value.trim(), 'https://band.link/anxious_story');
      const isFeatured = relFeaturedCheckbox.checked;

      const selectedCraftBadge = craftSpecDefaults[craft]?.badge || 'Pure Studio Craft';

      syncEditingTracksFromDOM();
      const finalTracks = editingTracks.length > 0
        ? editingTracks.map((t, i) => ({
            number: t.number || String(i + 1).padStart(2, '0'),
            title: t.title || title,
            duration: t.duration || '03:00',
            genre: t.genre || 'Melodic Electronic',
            previewUrl: sanitizeUrl(t.previewUrl || '', '')
          }))
        : [{ number: "01", title: title, duration: "03:00", genre: "Melodic Electronic", previewUrl: "" }];

      if (isFeatured) {
        releases.forEach(r => r.isLatest = false);
      }

      if (editIdx >= 0 && releases[editIdx]) {
        const existing = releases[editIdx];
        existing.title = title;
        existing.type = type;
        existing.category = type.toLowerCase() === 'single' ? 'single' : 'ep';
        existing.year = year;
        existing.releaseDate = releaseDate;
        existing.coverUrl = coverUrl;
        existing.status = status;
        existing.tagline = tagline;
        existing.smartlink = smartlink;
        existing.isLatest = isFeatured;
        existing.craftSpec = {
          badge: selectedCraftBadge,
          type: craft,
          summary: craftSummary
        };
        existing.tracklist = finalTracks;
        persistReleasesImmediate();
        renderReleasesAdmin();
        addPanel.style.display = 'none';
        if (editRelIndexInput) editRelIndexInput.value = '-1';
        showToast(`'${title}' updated and saved!`);
      } else {
        const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'release';
        const newReleaseObj = {
          id: `${slugBase}-${Date.now().toString().slice(-4)}`,
          title,
          type,
          category: type.toLowerCase() === 'single' ? 'single' : 'ep',
          year,
          releaseDate,
          coverUrl,
          accentColor: normalizeHexColor(colorInput?.value, '#FF5722'),
          tagline: tagline || `New ${type} by Bel Gray.`,
          isLatest: isFeatured,
          status,
          smartlink,
          craftSpec: {
            badge: selectedCraftBadge,
            type: craft,
            summary: craftSummary
          },
          tracklist: finalTracks,
          links: {
            yandex: "https://music.yandex.ru/artist/belgray",
            vk: "https://vk.com/artist/belgray",
            spotify: "https://open.spotify.com/artist/belgray",
            apple: "https://music.apple.com/artist/belgray",
            youtube: "https://youtube.com/@belgray_music"
          }
        };

        releases.unshift(newReleaseObj);
        persistReleasesImmediate();
        renderReleasesAdmin();
        addPanel.style.display = 'none';
        if (editRelIndexInput) editRelIndexInput.value = '-1';
        showToast(`'${title}' added to catalog and saved!`);
      }
    });
  }

  // 7. Supabase SQL Copy & JSON Backup Exports
  const btnCopySql = document.getElementById('btn-copy-sql');
  if (btnCopySql) {
    btnCopySql.addEventListener('click', () => {
      const sql = `-- 1. Create tables for Bel Gray releases & site config
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT,
  category TEXT,
  year TEXT,
  releaseDate TEXT,
  coverUrl TEXT,
  accentColor TEXT,
  tagline TEXT,
  isLatest BOOLEAN DEFAULT false,
  status TEXT,
  smartlink TEXT,
  craftSpec JSONB,
  tracklist JSONB,
  links JSONB
);

CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL
);

-- 2. Enable Row Level Security (RLS) so public visitors can only READ
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Releases" ON releases FOR SELECT USING (true);
CREATE POLICY "Public Read Config" ON site_config FOR SELECT USING (true);

-- 3. Restrict INSERT/UPDATE/DELETE strictly to authenticated admin user
CREATE POLICY "Admin Write Releases" ON releases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin Write Config" ON site_config FOR ALL TO authenticated USING (true) WITH CHECK (true);`;
      navigator.clipboard.writeText(sql).then(() => {
        showToast('RLS-Protected SQL Schema copied!');
      });
    });
  }

  const downloadJsonFile = (dataObj, filename) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Exported ${filename} successfully!`);
  };

  const btnDownloadJson = document.getElementById('btn-download-json');
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      downloadJsonFile(releases, 'releases.json');
    });
  }

  const btnDownloadConfigJson = document.getElementById('btn-download-config-json');
  if (btnDownloadConfigJson) {
    btnDownloadConfigJson.addEventListener('click', () => {
      downloadJsonFile(siteConfig, 'site-config.json');
    });
  }

  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Reset all studio settings and catalog to factory defaults?')) {
        localStorage.removeItem('belgray_site_config');
        localStorage.removeItem('belgray_releases');
        location.reload();
      }
    });
  }

  // 8. Global Save Button
  const btnSaveAll = document.getElementById('btn-save-all');
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', () => {
      // Gather siteConfig: Announcement
      siteConfig.announcement = {
        enabled: bannerEnabled.checked,
        badge: bannerBadge.value.trim() || defaultSiteConfig.announcement.badge,
        buttonText: bannerBtnText.value.trim() || defaultSiteConfig.announcement.buttonText,
        text: bannerText.value.trim() || defaultSiteConfig.announcement.text,
        link: sanitizeUrl(bannerLink.value.trim(), defaultSiteConfig.announcement.link)
      };

      // Gather siteConfig: Hero
      siteConfig.hero = {
        badge: heroBadge.value.trim() || defaultSiteConfig.hero.badge,
        title: heroTitle.value.trim() || defaultSiteConfig.hero.title,
        subtitle: heroSubtitle.value.trim() || defaultSiteConfig.hero.subtitle,
        ctaPrimaryText: heroCta1.value.trim() || defaultSiteConfig.hero.ctaPrimaryText,
        ctaPrimaryLink: '#latest',
        ctaSecondaryText: heroCta2.value.trim() || defaultSiteConfig.hero.ctaSecondaryText,
        ctaSecondaryLink: '#about'
      };

      // Gather siteConfig: Bio & Photo
      siteConfig.bio = siteConfig.bio || {};
      siteConfig.bio.photoUrl = sanitizeUrl(bioPhoto.value.trim(), defaultSiteConfig.bio.photoUrl);
      siteConfig.bio.captionName = bioCapName.value.trim() || defaultSiteConfig.bio.captionName;
      siteConfig.bio.captionRole = siteConfig.bio.captionRole || defaultSiteConfig.bio.captionRole;
      siteConfig.bio.lead = bioLead.value.trim() || defaultSiteConfig.bio.lead;
      siteConfig.bio.paragraph1 = bioP1.value.trim() || defaultSiteConfig.bio.paragraph1;
      siteConfig.bio.paragraph2 = bioP2.value.trim() || defaultSiteConfig.bio.paragraph2;
      siteConfig.bio.quote = bioQuote.value.trim() || defaultSiteConfig.bio.quote;
      siteConfig.bio.quoteAuthor = bioQuoteAuthor.value.trim() || defaultSiteConfig.bio.quoteAuthor;
      siteConfig.bio.stats = Array.isArray(siteConfig.bio.stats) ? siteConfig.bio.stats : defaultSiteConfig.bio.stats;

      // Gather siteConfig: Documentary
      siteConfig.documentary = {
        enabled: docEnabled.checked,
        badge: docBadge.value.trim() || defaultSiteConfig.documentary.badge,
        title: docTitle.value.trim() || defaultSiteConfig.documentary.title,
        spec: docSpec ? (docSpec.value.trim() || defaultSiteConfig.documentary.spec) : defaultSiteConfig.documentary.spec,
        posterUrl: docPoster ? sanitizeUrl(docPoster.value.trim(), '') : defaultSiteConfig.documentary.posterUrl,
        description: docDesc.value.trim() || defaultSiteConfig.documentary.description,
        buttonText: docBtnText.value.trim() || defaultSiteConfig.documentary.buttonText,
        link: sanitizeUrl(docLink.value.trim(), defaultSiteConfig.documentary.link)
      };

      // Gather siteConfig: Footer, Socials & Copyright
      syncFooterLinksFromDOM();
      siteConfig.footer = {
        brandTitle: footerBrandTitleInput ? (footerBrandTitleInput.value.trim() || defaultSiteConfig.footer.brandTitle) : defaultSiteConfig.footer.brandTitle,
        brandDesc: footerBrandDescInput ? (footerBrandDescInput.value.trim() || defaultSiteConfig.footer.brandDesc) : defaultSiteConfig.footer.brandDesc,
        copyrightYear: footerYearInput ? (footerYearInput.value.trim() || defaultSiteConfig.footer.copyrightYear) : defaultSiteConfig.footer.copyrightYear,
        copyrightOwner: footerOwnerInput ? (footerOwnerInput.value.trim() || defaultSiteConfig.footer.copyrightOwner) : defaultSiteConfig.footer.copyrightOwner,
        bottomTagline: footerBottomTaglineInput ? (footerBottomTaglineInput.value.trim() || defaultSiteConfig.footer.bottomTagline) : defaultSiteConfig.footer.bottomTagline,
        email: footerEmailInput ? footerEmailInput.value.trim() : defaultSiteConfig.footer.email,
        emailLabel: footerEmailLabelInput ? (footerEmailLabelInput.value.trim() || defaultSiteConfig.footer.emailLabel) : defaultSiteConfig.footer.emailLabel,
        smartlinkLabel: footerSmartlinkLabelInput ? (footerSmartlinkLabelInput.value.trim() || defaultSiteConfig.footer.smartlinkLabel) : defaultSiteConfig.footer.smartlinkLabel,
        smartlinkUrl: footerSmartlinkUrlInput ? sanitizeUrl(footerSmartlinkUrlInput.value.trim(), defaultSiteConfig.footer.smartlinkUrl) : defaultSiteConfig.footer.smartlinkUrl,
        links: editingFooterLinks.length > 0 ? editingFooterLinks : defaultSiteConfig.footer.links
      };

      // Keep siteConfig.socials synced for backwards compatibility
      siteConfig.socials = siteConfig.socials || {};
      if (siteConfig.footer.email) siteConfig.socials.email = siteConfig.footer.email;
      if (siteConfig.footer.smartlinkUrl) siteConfig.socials.smartlink = siteConfig.footer.smartlinkUrl;
      editingFooterLinks.forEach(l => {
        const t = (l.title || '').toLowerCase();
        if (t.includes('telegram') || t.includes('телеграм')) siteConfig.socials.telegram = l.url;
        else if (t.includes('youtube') || t.includes('ютуб')) siteConfig.socials.youtube = l.url;
        else if (t.includes('vk') || t.includes('вк')) siteConfig.socials.vk = l.url;
        else if (t.includes('tiktok') || t.includes('тикток')) siteConfig.socials.tiktok = l.url;
      });

      // Gather & Sync Active Era Theme Color
      const validEraHex = normalizeHexColor(colorInput.value, '#FF5722');
      applyColorAdmin(validEraHex);
      siteConfig.site = siteConfig.site || {};
      siteConfig.site.activeEraColor = validEraHex;

      // Also sync featured release accentColor so there is zero conflict
      const featuredRel = releases.find(r => r.isLatest) || releases[0];
      if (featuredRel) {
        featuredRel.accentColor = validEraHex;
      }

      // Save Supabase credentials if entered
      if (supabaseUrlInput || supabaseKeyInput) {
        const sbUrl = sanitizeUrl(supabaseUrlInput?.value.trim() || '', '');
        const sbKey = supabaseKeyInput?.value.trim() || '';
        localStorage.setItem('belgray_supabase_cfg', JSON.stringify({ url: sbUrl, key: sbKey }));
        if (syncStatusText) {
          syncStatusText.textContent = sbUrl && sbKey ? 'CLOUD + LOCAL SYNC READY' : 'LOCAL SYNC READY';
        }
      }

      // Persist in localStorage
      localStorage.setItem('belgray_site_config', JSON.stringify(siteConfig));
      persistReleasesImmediate();

      showToast('All changes saved! Live site updated.');
    });
  }

  // Toast Helper
  const toast = document.getElementById('admin-toast');
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Initial populate
  populateBannerForm();
  populateHeroForm();
  populateBioForm();
  populateDocForm();
  populateFooterForm();
  populateSupabaseForm();
  renderReleasesAdmin();
});
