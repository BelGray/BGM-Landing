/**
 * BEL GRAY STUDIO CONTROL — ADMIN CONTROLLER
 */

document.addEventListener('DOMContentLoaded', async () => {
  const DEFAULT_PIN = '1999';

  // 1. PIN Auth Handling
  const authGate = document.getElementById('admin-auth-gate');
  const dashboard = document.getElementById('admin-dashboard');
  const authForm = document.getElementById('auth-form');
  const pinInput = document.getElementById('admin-pin-input');
  const btnLock = document.getElementById('btn-lock');

  const isUnlocked = sessionStorage.getItem('belgray_admin_unlocked');
  if (isUnlocked === 'true') {
    authGate.style.display = 'none';
    dashboard.style.display = 'grid';
  }

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPin = pinInput.value.trim();
    const storedPin = localStorage.getItem('belgray_admin_pin') || DEFAULT_PIN;

    if (enteredPin === storedPin) {
      sessionStorage.setItem('belgray_admin_unlocked', 'true');
      authGate.style.display = 'none';
      dashboard.style.display = 'grid';
    } else {
      pinInput.value = '';
      pinInput.style.borderColor = '#FF3B30';
      showToast('Incorrect PIN. Please try again.');
    }
  });

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      sessionStorage.removeItem('belgray_admin_unlocked');
      location.reload();
    });
  }

  // 2. State & Data Loading
  let siteConfig = {
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

  let releases = [
    {
      id: "anxious-story",
      title: "Anxious Story",
      type: "EP",
      category: "ep",
      year: "2026",
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
      }
    }
  ];

  try {
    const savedConfig = localStorage.getItem('belgray_site_config');
    const savedReleases = localStorage.getItem('belgray_releases');

    if (savedConfig) {
      siteConfig = JSON.parse(savedConfig);
    } else {
      const res = await fetch('data/site-config.json');
      if (res.ok) siteConfig = await res.json();
    }

    if (savedReleases) {
      releases = JSON.parse(savedReleases);
    } else {
      const res = await fetch('data/releases.json');
      if (res.ok) releases = await res.json();
    }
  } catch (err) {
    console.info('Loaded admin with default data:', err);
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
    'tab-sync': 'Cloud & Supabase Integration'
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
    const ann = siteConfig.announcement || {};
    bannerEnabled.checked = ann.enabled !== false;
    bannerBadge.value = ann.badge || 'OUT NOW';
    bannerBtnText.value = ann.buttonText || 'Listen Now';
    bannerText.value = ann.text || '';
    bannerLink.value = ann.link || '';
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
    const h = siteConfig.hero || {};
    if (heroBadge) heroBadge.value = h.badge || 'PIANIST & ELECTRONIC PRODUCER';
    if (heroTitle) heroTitle.value = h.title || 'BEL GRAY';
    if (heroSubtitle) heroSubtitle.value = h.subtitle || '';
    if (heroCta1) heroCta1.value = h.ctaPrimaryText || "Listen to 'Anxious Story'";
    if (heroCta2) heroCta2.value = h.ctaSecondaryText || 'Meet Daniel';
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
    const b = siteConfig.bio || {};
    if (bioPhoto) bioPhoto.value = b.photoUrl || 'assets/BGM Daniel Belyaev Photo.png';
    if (bioCapName) bioCapName.value = b.captionName || 'DANIEL BELYAEV';
    if (bioLead) bioLead.value = b.lead || '';
    if (bioP1) bioP1.value = b.paragraph1 || '';
    if (bioP2) bioP2.value = b.paragraph2 || '';
    if (bioQuote) bioQuote.value = b.quote || '';
    if (bioQuoteAuthor) bioQuoteAuthor.value = b.quoteAuthor || 'Bel Gray';
  };

  // 4D. Form Binding: Documentary / Media
  const docEnabled = document.getElementById('cfg-doc-enabled');
  const docBadge = document.getElementById('cfg-doc-badge');
  const docTitle = document.getElementById('cfg-doc-title');
  const docDesc = document.getElementById('cfg-doc-desc');
  const docBtnText = document.getElementById('cfg-doc-btn-text');
  const docLink = document.getElementById('cfg-doc-link');

  const populateDocForm = () => {
    const d = siteConfig.documentary || {};
    if (docEnabled) docEnabled.checked = d.enabled !== false;
    if (docBadge) docBadge.value = d.badge || 'CREATIVE ARCHIVE';
    if (docTitle) docTitle.value = d.title || 'Behind The Storm';
    if (docDesc) docDesc.value = d.description || '';
    if (docBtnText) docBtnText.value = d.buttonText || 'Watch Documentary on Telegram';
    if (docLink) docLink.value = d.link || 'https://t.me/belgray_music';
  };

  // 5. Theme Studio Binding
  const colorPicker = document.getElementById('cfg-theme-picker');
  const colorInput = document.getElementById('cfg-theme-color');
  const presetPills = document.querySelectorAll('.preset-pill');

  const applyColorAdmin = (hex) => {
    if (!hex) return;
    document.documentElement.style.setProperty('--accent-color', hex);
    document.documentElement.style.setProperty('--accent-glow', `${hex}38`);
    document.documentElement.style.setProperty('--accent-subtle', `${hex}18`);
    document.documentElement.style.setProperty('--accent-border', `${hex}66`);
    if (colorPicker) colorPicker.value = hex;
    if (colorInput) colorInput.value = hex;
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
      presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyColorAdmin(pill.dataset.color);
    });
  });

  // 6. Releases Management
  const releasesListMount = document.getElementById('releases-admin-list');
  const btnToggleAdd = document.getElementById('btn-toggle-add-release');
  const addPanel = document.getElementById('add-release-panel');
  const btnCancelAdd = document.getElementById('btn-cancel-add-release');
  const btnSaveNewRelease = document.getElementById('btn-save-new-release');

  if (btnToggleAdd) {
    btnToggleAdd.addEventListener('click', () => {
      addPanel.style.display = addPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (btnCancelAdd) {
    btnCancelAdd.addEventListener('click', () => {
      addPanel.style.display = 'none';
    });
  }

  const renderReleasesAdmin = () => {
    if (!releasesListMount) return;

    releasesListMount.innerHTML = releases.map((rel, index) => `
      <div class="release-admin-row">
        <div class="release-row-left">
          <img src="${rel.coverUrl}" alt="${rel.title}" class="release-row-thumb">
          <div class="release-row-info">
            <span class="release-row-title">${rel.title} ${rel.isLatest ? ' <span style="color: var(--accent-color);">[FEATURED HERO]</span>' : ''}</span>
            <span class="release-row-meta">${rel.type} • ${rel.year} • ${rel.status || 'OUT NOW'} • ${rel.craftSpec ? rel.craftSpec.badge : 'Studio'}</span>
          </div>
        </div>
        <div class="release-row-actions">
          ${!rel.isLatest ? `
            <button class="btn btn-sm btn-outline btn-make-featured" data-index="${index}">
              Feature on Hero
            </button>
          ` : ''}
          <button class="btn btn-sm btn-ghost btn-delete-release" data-index="${index}" style="color: #FF453A;">
            Delete
          </button>
        </div>
      </div>
    `).join('');

    // Attach actions
    document.querySelectorAll('.btn-make-featured').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        releases.forEach(r => r.isLatest = false);
        releases[idx].isLatest = true;
        renderReleasesAdmin();
        showToast(`'${releases[idx].title}' set as Featured on Hero!`);
      });
    });

    document.querySelectorAll('.btn-delete-release').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (confirm(`Delete release '${releases[idx].title}'?`)) {
          releases.splice(idx, 1);
          renderReleasesAdmin();
          showToast('Release deleted.');
        }
      });
    });
  };

  if (btnSaveNewRelease) {
    btnSaveNewRelease.addEventListener('click', () => {
      const title = document.getElementById('new-rel-title').value.trim();
      if (!title) {
        alert('Please enter a title');
        return;
      }

      const type = document.getElementById('new-rel-type').value;
      const year = document.getElementById('new-rel-year').value.trim() || '2026';
      const coverUrl = document.getElementById('new-rel-cover').value.trim() || 'assets/Anxious Story.jpg';
      const status = document.getElementById('new-rel-status').value;
      const tagline = document.getElementById('new-rel-tagline').value.trim();
      const craft = document.getElementById('new-rel-craft').value;
      const smartlink = document.getElementById('new-rel-smartlink').value.trim() || 'https://band.link/anxious_story';
      const isFeatured = document.getElementById('new-rel-featured').checked;

      const craftSpecMap = {
        'pure': { badge: 'Pure Studio Craft', type: 'pure', summary: '100% Handcrafted Acoustic Piano Suite & FL Studio Master' },
        'hybrid': { badge: 'Hybrid Concept', type: 'hybrid', summary: 'Acoustic Piano & Chords by Daniel Belyaev • Neural Vocal Synthesis • FL Studio Engineering' },
        'acoustic': { badge: 'Acoustic Piano Suite', type: 'pure', summary: 'Acoustic Grand Piano Master' }
      };

      if (isFeatured) {
        releases.forEach(r => r.isLatest = false);
      }

      const newReleaseObj = {
        id: title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        title,
        type,
        category: type.toLowerCase() === 'single' ? 'single' : 'ep',
        year,
        releaseDate: new Date().toISOString().split('T')[0],
        coverUrl,
        accentColor: colorInput.value || '#FF5722',
        tagline: tagline || `New ${type} by Bel Gray.`,
        isLatest: isFeatured,
        status,
        smartlink,
        craftSpec: craftSpecMap[craft] || craftSpecMap['pure'],
        tracklist: [
          { number: "01", title: title, duration: "03:00", genre: "Melodic Electronic", previewUrl: "" }
        ],
        links: {
          yandex: "https://music.yandex.ru/artist/belgray",
          vk: "https://vk.com/artist/belgray",
          spotify: "https://open.spotify.com/artist/belgray",
          apple: "https://music.apple.com/artist/belgray",
          youtube: "https://youtube.com/@belgray_music"
        }
      };

      releases.unshift(newReleaseObj);
      renderReleasesAdmin();
      addPanel.style.display = 'none';
      showToast(`'${title}' added to catalog!`);
    });
  }

  // 7. Supabase SQL Copy & Export
  const btnCopySql = document.getElementById('btn-copy-sql');
  if (btnCopySql) {
    btnCopySql.addEventListener('click', () => {
      const sql = `-- Create table for Bel Gray releases
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

-- Create table for Bel Gray site config
CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL
);`;
      navigator.clipboard.writeText(sql).then(() => {
        showToast('SQL Schema copied to clipboard!');
      });
    });
  }

  const btnDownloadJson = document.getElementById('btn-download-json');
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(releases, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "releases.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Exported releases.json successfully!');
    });
  }

  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Reset all admin settings to default?')) {
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
        badge: bannerBadge.value.trim() || 'OUT NOW',
        buttonText: bannerBtnText.value.trim() || 'Listen Now',
        text: bannerText.value.trim(),
        link: bannerLink.value.trim() || 'https://band.link/anxious_story'
      };

      // Gather siteConfig: Hero
      siteConfig.hero = {
        badge: heroBadge.value.trim() || 'PIANIST & ELECTRONIC PRODUCER',
        title: heroTitle.value.trim() || 'BEL GRAY',
        subtitle: heroSubtitle.value.trim(),
        ctaPrimaryText: heroCta1.value.trim() || "Listen to 'Anxious Story'",
        ctaPrimaryLink: '#latest',
        ctaSecondaryText: heroCta2.value.trim() || 'Meet Daniel',
        ctaSecondaryLink: '#about'
      };

      // Gather siteConfig: Bio & Photo
      siteConfig.bio = siteConfig.bio || {};
      siteConfig.bio.photoUrl = bioPhoto.value.trim() || 'assets/BGM Daniel Belyaev Photo.png';
      siteConfig.bio.captionName = bioCapName.value.trim() || 'DANIEL BELYAEV';
      siteConfig.bio.captionRole = 'Electronic Producer & Pianist';
      siteConfig.bio.lead = bioLead.value.trim();
      siteConfig.bio.paragraph1 = bioP1.value.trim();
      siteConfig.bio.paragraph2 = bioP2.value.trim();
      siteConfig.bio.quote = bioQuote.value.trim();
      siteConfig.bio.quoteAuthor = bioQuoteAuthor.value.trim() || 'Bel Gray';

      // Gather siteConfig: Documentary
      siteConfig.documentary = {
        enabled: docEnabled.checked,
        badge: docBadge.value.trim() || 'CREATIVE ARCHIVE',
        title: docTitle.value.trim() || 'Behind The Storm',
        description: docDesc.value.trim(),
        buttonText: docBtnText.value.trim() || 'Watch Documentary on Telegram',
        link: docLink.value.trim() || 'https://t.me/belgray_music'
      };

      siteConfig.site = siteConfig.site || {};
      siteConfig.site.activeEraColor = colorInput.value.trim() || '#FF5722';

      // Persist in localStorage
      localStorage.setItem('belgray_site_config', JSON.stringify(siteConfig));
      localStorage.setItem('belgray_releases', JSON.stringify(releases));

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
  renderReleasesAdmin();
});

