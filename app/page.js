'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Share2,
  Copy,
  Check,
  Clipboard,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Settings,
  History,
  Sparkles,
  Info,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  FolderArchive,
  Smartphone,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import JSZip from 'jszip';

export default function Home() {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  // Clipboard toast
  const [clipboardUrl, setClipboardUrl] = useState('');
  const [showClipboardToast, setShowClipboardToast] = useState(false);

  // Download progress feedback state
  const [downloadProgress, setDownloadProgress] = useState({
    active: false,
    percent: 0,
    loadedMB: '0.0',
    totalMB: '0.0',
    status: 'idle', // 'idle' | 'downloading' | 'packaging' | 'completed' | 'error'
    text: '',
    error: null
  });

  // Settings & History modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [cobaltInstance, setCobaltInstance] = useState('');
  const [history, setHistory] = useState([]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const videoRef = useRef(null);

  // 1. Initial Load: Load local storage & parse share target query params
  useEffect(() => {
    // Load settings & history
    try {
      const savedSession = localStorage.getItem('instagrab_session_id') || '';
      const savedCobalt = localStorage.getItem('instagrab_cobalt_instance') || '';
      const savedHistory = JSON.parse(localStorage.getItem('instagrab_history') || '[]');
      setSessionId(savedSession);
      setCobaltInstance(savedCobalt);
      setHistory(savedHistory);
    } catch {}

    // Check if launched as PWA standalone
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    // Capture PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Read query params from Web Share Target (e.g. /?text=... or /?url=...)
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text') || params.get('url') || params.get('title') || '';
    if (sharedText) {
      const foundMatch = sharedText.match(/https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i);
      if (foundMatch) {
        const urlToFetch = foundMatch[0];
        setInputUrl(urlToFetch);
        // Automatically start grabbing when shared
        triggerExtract(urlToFetch);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // 2. Clipboard watcher on window focus
  useEffect(() => {
    const checkClipboard = async () => {
      if (!navigator.clipboard?.readText) return;
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.includes('instagram.com/') && text !== inputUrl && (!result || result.url !== text)) {
          setClipboardUrl(text.trim());
          setShowClipboardToast(true);
        }
      } catch {
        // Clipboard read permission might be denied
      }
    };

    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [inputUrl, result]);

  // Extract function
  const triggerExtract = async (url) => {
    const targetUrl = url || inputUrl;
    if (!targetUrl.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentMediaIndex(0);
    setShowClipboardToast(false);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl.trim(),
          sessionId: sessionId.trim() || undefined,
          cobaltInstance: cobaltInstance.trim() || undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to extract media from this Instagram link.');
      }

      setResult(json.data);

      // Save to History
      const newHistoryItem = {
        id: json.data.shortcode,
        shortcode: json.data.shortcode,
        url: json.data.url,
        type: json.data.type,
        caption: json.data.caption?.slice(0, 100) || '',
        author: json.data.author?.username || 'instagram_user',
        thumbnail: json.data.media?.[0]?.thumbnail || json.data.media?.[0]?.url || '',
        timestamp: Date.now()
      };

      setHistory((prev) => {
        const filtered = prev.filter((item) => item.shortcode !== newHistoryItem.shortcode);
        const updated = [newHistoryItem, ...filtered].slice(0, 30);
        try {
          localStorage.setItem('instagrab_history', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Celebration confetti
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#ff2e78', '#6b2bff', '#ffa53a']
        });
      } catch {}
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while grabbing media.');
    } finally {
      setLoading(false);
    }
  };

  // Paste action
  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputUrl(text);
          triggerExtract(text);
          return;
        }
      }
    } catch {}
    // Fallback: focus input
    document.getElementById('ig-url-input')?.focus();
  };

  // PWA Install handler
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Check if iOS
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        setShowIosInstallModal(true);
      } else {
        alert('To install InstaGrab, open your browser menu (⋮) and tap "Install app" or "Add to Home screen".');
      }
    }
  };

  // Save Settings
  const handleSaveSettings = () => {
    try {
      localStorage.setItem('instagrab_session_id', sessionId.trim());
      localStorage.setItem('instagrab_cobalt_instance', cobaltInstance.trim());
    } catch {}
    setShowSettingsModal(false);
  };

  // Clear History
  const handleClearHistory = () => {
    if (confirm('Clear your download history?')) {
      setHistory([]);
      try {
        localStorage.removeItem('instagrab_history');
      } catch {}
    }
  };

  // Download Single Media with Real-Time Progress Bar
  const downloadWithProgress = async (mediaUrl, filename, label = 'media') => {
    if (!mediaUrl || downloadProgress.active) return;

    setDownloadProgress({
      active: true,
      percent: 0,
      loadedMB: '0.0',
      totalMB: '...',
      status: 'downloading',
      text: `Preparing ${label}...`,
      error: null
    });

    try {
      const proxyUrl = `/api/download?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }

      const contentLengthHeader = res.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      const totalMB = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(1) : null;

      const reader = res.body?.getReader();
      const chunks = [];
      let receivedBytes = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedBytes += value.length;

          const loadedMB = (receivedBytes / (1024 * 1024)).toFixed(1);
          let percent = 0;
          if (totalBytes > 0) {
            percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
          }

          setDownloadProgress({
            active: true,
            percent,
            loadedMB,
            totalMB: totalMB || '?',
            status: 'downloading',
            text: totalBytes > 0
              ? `Downloading ${label}... ${percent}% (${loadedMB} / ${totalMB} MB)`
              : `Downloading ${label}... (${loadedMB} MB)`,
            error: null
          });
        }
      } else {
        const blob = await res.blob();
        chunks.push(blob);
      }

      // Concatenate chunks into a single Blob
      const contentType = res.headers.get('content-type') || (filename.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4');
      const finalBlob = chunks[0] instanceof Blob ? chunks[0] : new Blob(chunks, { type: contentType });

      // Trigger automatic save to device
      const blobUrl = URL.createObjectURL(finalBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

      // Complete feedback
      const finalSizeMB = (finalBlob.size / (1024 * 1024)).toFixed(1);
      setDownloadProgress({
        active: true,
        percent: 100,
        loadedMB: finalSizeMB,
        totalMB: finalSizeMB,
        status: 'completed',
        text: `Saved ${filename} to your device! 🎉`,
        error: null
      });

      confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });

      // Auto-hide progress bar after 3.5s
      setTimeout(() => {
        setDownloadProgress((prev) => (prev.status === 'completed' ? { ...prev, active: false } : prev));
      }, 3500);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadProgress({
        active: true,
        percent: 0,
        loadedMB: '0.0',
        totalMB: '0.0',
        status: 'error',
        text: 'Download failed',
        error: err.message || 'Network error during download.'
      });
      setTimeout(() => {
        setDownloadProgress((prev) => ({ ...prev, active: false }));
      }, 4000);
    }
  };

  // Download All as ZIP for Carousels with live multi-file progress
  const handleDownloadAllZip = async () => {
    if (!result?.media || result.media.length === 0 || downloadProgress.active) return;
    setDownloadingZip(true);
    setDownloadProgress({
      active: true,
      percent: 0,
      loadedMB: '0',
      totalMB: `${result.media.length}`,
      status: 'downloading',
      text: `Starting album download (0 of ${result.media.length})...`,
      error: null
    });

    try {
      const zip = new JSZip();
      const folder = zip.folder(`instagrab_${result.shortcode}`);
      const totalItems = result.media.length;

      for (let i = 0; i < totalItems; i++) {
        const item = result.media[i];
        setDownloadProgress({
          active: true,
          percent: Math.round((i / totalItems) * 85),
          loadedMB: `${i + 1}`,
          totalMB: `${totalItems}`,
          status: 'downloading',
          text: `Fetching item ${i + 1} of ${totalItems} (${item.type})...`,
          error: null
        });

        const proxyUrl = `/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.filename)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Failed to fetch item ${i + 1}`);
        const blob = await res.blob();
        folder.file(item.filename, blob);
      }

      setDownloadProgress({
        active: true,
        percent: 88,
        loadedMB: `${totalItems}`,
        totalMB: `${totalItems}`,
        status: 'packaging',
        text: 'Packaging ZIP album archive...',
        error: null
      });

      const zipBlob = await zip.generateAsync(
        { type: 'blob' },
        (metadata) => {
          setDownloadProgress((prev) => ({
            ...prev,
            percent: 88 + Math.round((metadata.percent / 100) * 11),
            text: `Packaging ZIP archive: ${Math.round(metadata.percent)}%`
          }));
        }
      );

      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = `instagrab_${result.shortcode}_album.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      const zipSizeMB = (zipBlob.size / (1024 * 1024)).toFixed(1);
      setDownloadProgress({
        active: true,
        percent: 100,
        loadedMB: zipSizeMB,
        totalMB: zipSizeMB,
        status: 'completed',
        text: `Album ZIP saved (${zipSizeMB} MB)! 🎉`,
        error: null
      });

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

      setTimeout(() => {
        setDownloadProgress((prev) => (prev.status === 'completed' ? { ...prev, active: false } : prev));
      }, 4000);
    } catch (err) {
      setDownloadProgress({
        active: true,
        percent: 0,
        loadedMB: '0.0',
        totalMB: '0.0',
        status: 'error',
        text: 'Failed to package album ZIP',
        error: err.message
      });
      setTimeout(() => {
        setDownloadProgress((prev) => ({ ...prev, active: false }));
      }, 4000);
    } finally {
      setDownloadingZip(false);
    }
  };

  // Share using Web Share API
  const handleShareMedia = async (mediaItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `InstaGrab - Instagram Media`,
          text: result?.caption ? result.caption.slice(0, 100) : 'Instagram Post',
          url: result?.url || window.location.href
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  // Copy Direct Link
  const handleCopyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currentMedia = result?.media?.[currentMediaIndex];

  return (
    <div className="app-wrapper">
      <div className="ambient-glow" />

      {/* Header */}
      <header className="header">
        <a href="/" className="logo-container">
          <img src="/icon-rounded.svg" alt="InstaGrab" className="logo-icon" />
          <span className="logo-text">
            Insta<span className="logo-text-gradient">Grab</span>
          </span>
        </a>

        <div className="header-actions">
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="btn-install-header"
              title="Install app on mobile"
            >
              <Smartphone size={15} />
              <span>Install</span>
            </button>
          )}

          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn-icon"
            title="Download history"
            aria-label="History"
          >
            <History size={18} />
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-icon"
            title="App settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Floating Clipboard Notification Pill */}
      {showClipboardToast && (
        <div
          className="clipboard-toast"
          onClick={() => {
            setInputUrl(clipboardUrl);
            triggerExtract(clipboardUrl);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Clipboard size={16} color="#ff2e78" />
            <span className="clipboard-toast-text">
              Found link: {clipboardUrl}
            </span>
          </div>
          <button className="clipboard-toast-btn">Paste & Grab</button>
        </div>
      )}

      {/* Hero Header */}
      <section className="hero">
        <div className="hero-badge">
          <Sparkles size={13} />
          <span>Mobile-Ready PWA & Web Share</span>
        </div>
        <h1 className="hero-title">
          Download Instagram <br />
          <span>Reels, Photos & Videos</span>
        </h1>
        <p className="hero-subtitle">
          Paste any post link or use Instagram&apos;s Share button to automatically grab media in original resolution.
        </p>
      </section>

      {/* Input Card */}
      <div className="input-card">
        <div className="input-row">
          <span className="input-icon">
            <ExternalLink size={18} />
          </span>
          <input
            id="ig-url-input"
            type="text"
            className="input-field"
            placeholder="Paste Instagram link (post, reel, carousel)..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') triggerExtract();
            }}
          />
          {inputUrl && (
            <button
              onClick={() => setInputUrl('')}
              className="btn-clear"
              aria-label="Clear input"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="input-actions">
          <button onClick={handlePaste} className="btn-paste">
            <Clipboard size={16} />
            <span>Paste Link</span>
          </button>

          <button
            onClick={() => triggerExtract()}
            disabled={loading || !inputUrl.trim()}
            className="btn-grab"
          >
            {loading ? (
              <>
                <div
                  className="spinner"
                  style={{ width: '18px', height: '18px', margin: 0, borderWidth: '2px' }}
                />
                <span>Grabbing...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Grab Media</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Box */}
      {loading && (
        <div className="loading-box">
          <div className="spinner" />
          <h3 className="loading-text">Extracting High-Quality Media</h3>
          <p className="loading-subtext">Connecting to Instagram servers & parsing media stream...</p>
        </div>
      )}

      {/* Error Box */}
      {error && !loading && (
        <div className="error-box">
          <AlertCircle size={22} color="#ff4d73" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 className="error-title">Couldn&apos;t Grab Media</h4>
            <p className="error-message">{error}</p>
            <button onClick={() => setShowSettingsModal(true)} className="error-action">
              <Settings size={14} />
              <span>Configure Instagram Session in Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Media Result Card */}
      {result && !loading && (
        <div className="result-card">
          {/* Result Header */}
          <div className="result-header">
            <div className="result-author">
              {result.author?.avatar ? (
                <img
                  src={result.author.avatar}
                  alt={result.author.username}
                  className="author-avatar"
                />
              ) : (
                <div
                  className="author-avatar"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>IG</span>
                </div>
              )}
              <div>
                <div className="author-username">@{result.author?.username || 'instagram_user'}</div>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="author-link"
                >
                  <span>View Original Post</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="media-badge">
              {result.type === 'carousel'
                ? `Album (${result.media.length})`
                : result.type}
            </div>
          </div>

          {/* Media Showcase Area */}
          <div className="media-preview-area">
            {currentMedia?.type === 'video' ? (
              <video
                ref={videoRef}
                src={currentMedia.url}
                poster={currentMedia.thumbnail || undefined}
                className="media-video"
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={currentMedia?.url}
                alt="Instagram preview"
                className="media-image"
              />
            )}

            {/* Carousel navigation buttons */}
            {result.media?.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : result.media.length - 1))
                  }
                  className="carousel-nav-btn carousel-prev"
                  aria-label="Previous media"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={() =>
                    setCurrentMediaIndex((prev) => (prev < result.media.length - 1 ? prev + 1 : 0))
                  }
                  className="carousel-nav-btn carousel-next"
                  aria-label="Next media"
                >
                  <ChevronRight size={22} />
                </button>

                <div className="carousel-indicator">
                  {currentMediaIndex + 1} / {result.media.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail Grid for Carousel Albums */}
          {result.media?.length > 1 && (
            <div style={{ padding: '10px 16px 0 16px' }}>
              <div className="carousel-grid">
                {result.media.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentMediaIndex(idx)}
                    className={`carousel-thumb-item ${currentMediaIndex === idx ? 'active' : ''}`}
                  >
                    <img
                      src={item.thumbnail || item.url}
                      alt={`Item ${idx + 1}`}
                      className="carousel-thumb-img"
                    />
                    <span className="carousel-thumb-badge">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result Body */}
          <div className="result-body">
            {result.caption && (
              <div>
                <p className={`result-caption ${!captionExpanded ? 'collapsed' : ''}`}>
                  {result.caption}
                </p>
                {result.caption.length > 90 && (
                  <button
                    onClick={() => setCaptionExpanded(!captionExpanded)}
                    className="btn-caption-toggle"
                  >
                    {captionExpanded ? 'Show less' : 'Read more...'}
                  </button>
                )}
              </div>
            )}

            <div className="result-buttons">
              {/* Real-Time Download Progress Feedback Card */}
              {downloadProgress.active && (
                <div className={`download-progress-card status-${downloadProgress.status}`}>
                  <div className="progress-header">
                    <div className="progress-info">
                      {downloadProgress.status === 'downloading' || downloadProgress.status === 'packaging' ? (
                        <Loader2 size={16} className="progress-spinner" />
                      ) : downloadProgress.status === 'completed' ? (
                        <CheckCircle2 size={16} className="progress-icon-success" />
                      ) : (
                        <AlertCircle size={16} className="progress-icon-error" />
                      )}
                      <span className="progress-title">{downloadProgress.text}</span>
                    </div>
                    {downloadProgress.percent > 0 && downloadProgress.status !== 'completed' && (
                      <span className="progress-percentage-badge">{downloadProgress.percent}%</span>
                    )}
                  </div>

                  {/* Animated Progress Track */}
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${downloadProgress.percent}%`,
                        transition: downloadProgress.percent === 0 ? 'none' : 'width 0.25s ease-out'
                      }}
                    >
                      <div className="progress-shimmer" />
                    </div>
                  </div>

                  <div className="progress-footer">
                    <span>
                      {downloadProgress.status === 'completed'
                        ? 'Saved directly to device files'
                        : downloadProgress.status === 'error'
                        ? (downloadProgress.error || 'Download failed')
                        : downloadProgress.status === 'packaging'
                        ? 'Packaging ZIP archive...'
                        : `${downloadProgress.loadedMB} of ${downloadProgress.totalMB} MB`}
                    </span>
                    {downloadProgress.status === 'downloading' && (
                      <span className="progress-live-pulse">Streaming direct</span>
                    )}
                  </div>
                </div>
              )}

              {/* Primary Download Button with real-time stream feedback */}
              <button
                onClick={() =>
                  downloadWithProgress(
                    currentMedia?.url,
                    currentMedia?.filename || `instagrab_${result.shortcode}_${currentMediaIndex + 1}.${currentMedia?.type === 'video' ? 'mp4' : 'jpg'}`,
                    currentMedia?.type === 'video' ? 'Video' : 'Photo'
                  )
                }
                disabled={downloadProgress.active}
                className="btn-download-primary"
                title="Download directly to your device storage"
              >
                {downloadProgress.active && downloadProgress.status === 'downloading' ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>
                      Downloading... {downloadProgress.percent > 0 ? `${downloadProgress.percent}%` : ''}
                    </span>
                  </>
                ) : downloadProgress.active && downloadProgress.status === 'completed' ? (
                  <>
                    <CheckCircle2 size={20} color="#fff" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>
                      Download {currentMedia?.type === 'video' ? 'Video' : 'Photo'} ({currentMediaIndex + 1} of {result.media?.length || 1})
                    </span>
                  </>
                )}
              </button>

              {/* Download All as ZIP for Carousels */}
              {result.media?.length > 1 && (
                <button
                  onClick={handleDownloadAllZip}
                  disabled={downloadProgress.active}
                  className="btn-action-secondary"
                  style={{ width: '100%' }}
                >
                  <FolderArchive size={17} />
                  <span>
                    {downloadProgress.active && downloadProgress.status === 'packaging'
                      ? 'Packaging Album ZIP...'
                      : `Download All ${result.media.length} Items (ZIP)`}
                  </span>
                </button>
              )}

              <div className="result-secondary-actions">
                <button onClick={() => handleShareMedia(currentMedia)} className="btn-action-secondary">
                  <Share2 size={16} />
                  <span>Share</span>
                </button>

                <button onClick={handleCopyLink} className="btn-action-secondary">
                  {copiedLink ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How to use 3-Step Guide */}
      <section className="guide-section">
        <h2 className="guide-title">
          <HelpCircle size={18} color="#ffa53a" />
          <span>How to Download on Mobile</span>
        </h2>
        <div className="guide-steps">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 className="step-header">Copy or Share</h3>
            <p className="step-desc">
              In Instagram, tap the Share icon on any Reel or Post, then tap <strong>Share</strong> or <strong>Copy link</strong>.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3 className="step-header">Open InstaGrab</h3>
            <p className="step-desc">
              Select <strong>InstaGrab</strong> from the share sheet, or open the app and tap <strong>Paste Link</strong>.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3 className="step-header">Save to Gallery</h3>
            <p className="step-desc">
              Tap <strong>Download</strong> to save the original high-resolution MP4 or JPG directly to your device storage.
            </p>
          </div>
        </div>
      </section>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Settings size={20} color="#ff2e78" />
                <span>InstaGrab Settings</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="modal-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">
                Instagram Session ID (Optional)
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="e.g. 54321%3ABcD1234..."
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
              <p className="form-hint">
                <ShieldCheck size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Stored only in your browser. Providing your sessionid lets you download from accounts you follow and prevents Instagram rate limits.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Custom Cobalt Instance (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. https://cobalt.yourdomain.com"
                value={cobaltInstance}
                onChange={(e) => setCobaltInstance(e.target.value)}
              />
              <p className="form-hint">
                If you self-host a Cobalt instance, enter its URL to use as an additional high-speed backend resolver.
              </p>
            </div>

            <button onClick={handleSaveSettings} className="btn-save-settings">
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <History size={20} color="#ffa53a" />
                <span>Recent Grabs</span>
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="modal-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {history.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
                No recent downloads yet. Links you grab will show up here for fast access.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                  <button onClick={handleClearHistory} className="history-clear">
                    Clear History
                  </button>
                </div>
                <div className="history-list">
                  {history.map((item) => (
                    <div
                      key={item.id + item.timestamp}
                      className="history-item"
                      onClick={() => {
                        setInputUrl(item.url);
                        triggerExtract(item.url);
                        setShowHistoryModal(false);
                      }}
                    >
                      <div className="history-item-left">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="history-thumb" />
                        ) : (
                          <div className="history-thumb" />
                        )}
                        <div className="history-meta">
                          <div className="history-author">@{item.author}</div>
                          <div className="history-date">
                            {new Date(item.timestamp).toLocaleDateString()} • {item.type}
                          </div>
                        </div>
                      </div>
                      <div className="history-actions">
                        <button className="btn-icon" style={{ width: '32px', height: '32px' }}>
                          <Download size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* iOS PWA Install Modal */}
      {showIosInstallModal && (
        <div className="modal-overlay" onClick={() => setShowIosInstallModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Smartphone size={20} color="#6b2bff" />
                <span>Install on iPhone / iPad</span>
              </h3>
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="modal-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ lineHeight: '1.6', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              <p style={{ marginBottom: '12px' }}>
                Install InstaGrab to appear in your share menu and use it like a native iOS app:
              </p>
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  Tap the <strong>Share</strong> button in Safari&apos;s toolbar (the square with an arrow pointing up).
                </li>
                <li>
                  Scroll down the share sheet and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> in the top-right corner.
                </li>
              </ol>
            </div>
            <button
              onClick={() => setShowIosInstallModal(false)}
              className="btn-save-settings"
              style={{ marginTop: '20px' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>
          InstaGrab &copy; {new Date().getFullYear()} &bull; Fast Instagram Media Downloader
        </p>
        <p style={{ marginTop: '4px', fontSize: '0.75rem' }}>
          Not affiliated with Instagram or Meta. For personal archiving only.
        </p>
      </footer>
    </div>
  );
}
