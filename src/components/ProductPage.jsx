import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ProductPage.css';

// Derive a display color from a variation label name.
// Priority: exact CSS color name match → known keyword map → hash-based HSL fallback.
const COLOR_KEYWORDS = {
  walnut: '#7B4F2E', brown: '#8B5E3C', oak: '#C8A96E', white: '#F0EDE8',
  black: '#2A2A2A', grey: '#8C8C8C', gray: '#8C8C8C', beige: '#C9B99A',
  cream: '#E8DEC8', gold: '#D4AF37', bronze: '#8C6240', ebony: '#3B2A1A',
  teak: '#A0522D', mahogany: '#4A1C0C', pine: '#D4A056', ivory: '#E8E0CC',
  blue: '#3B6EA5', navy: '#1B2F57', green: '#3A6B3A', sage: '#7A9B6A',
  olive: '#6B703A', red: '#8B2020', rose: '#B56B6B', blush: '#C49090',
  charcoal: '#3A3A3A', sand: '#C2A87A', linen: '#E0D4BE', slate: '#527080',
};

const getDotColor = (label) => {
  const lower = label.toLowerCase();
  for (const [kw, hex] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(kw)) return hex;
  }
  // Hash-based HSL fallback — deterministic per label
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 40%, 45%)`;
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────
const getDriveUrl = (url) => {
  if (!url) return '';
  if (typeof url !== 'string') return url;
  if (url.includes('drive.google.com')) {
    const m = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
    return m ? `/api/image?id=${m[1]}` : url;
  }
  return url;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT OPTIONS  ← change labels/order here freely
// ─────────────────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: '360',    label: '360° View', icon: '⟳' },
  { id: 'studio', label: 'Studio',    icon: '✦'  },
  { id: 'angles', label: 'Angles',    icon: '⊞'  },
  { id: 'sketch', label: 'Sketch',    icon: '✏'  },
];
const ANGLE_LABELS = ['Front', 'Side →', 'Back', '← Side'];

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA DISPLAY MODULE
// Swap this entire component if you want a different layout style.
// ─────────────────────────────────────────────────────────────────────────────
const MediaDisplay = ({ segment, studioUrl, rawImageUrl, angleGridUrl, videoUrl }) => {
  const [activeAngle, setActiveAngle] = useState(null);
  const videoRef = useRef(null);

  // When the segment changes, reset angle selection
  const prevSegment = useRef(segment);
  if (prevSegment.current !== segment) {
    prevSegment.current = segment;
    // defer state reset outside render
    setTimeout(() => setActiveAngle(null), 0);
  }

  // Main display frame
  const renderMain = () => {
    if (segment === '360') {
      return videoUrl ? (
        <div className="md-video-wrapper">
          <video
            ref={videoRef}
            src={videoUrl}
            className="md-video"
            autoPlay
            loop
            muted
            playsInline
            controlsList="nodownload"
          />
          <div className="md-video-badge">360°</div>
        </div>
      ) : (
        <div className="md-placeholder">
          <span className="md-placeholder-icon">⟳</span>
          <p>No 360° video for this variant yet</p>
        </div>
      );
    }

    if (segment === 'sketch') {
      return rawImageUrl ? (
        <div className="md-sketch-wrapper">
          <img src={rawImageUrl} alt="Blueprint Skeleton" className="md-img md-sketch" />
          <div className="md-sketch-badge">Blueprint</div>
        </div>
      ) : (
        <div className="md-placeholder">
          <span className="md-placeholder-icon">✏</span>
          <p>No skeleton image available</p>
        </div>
      );
    }

    // Studio: full render
    if (segment === 'studio') {
      return (
        <AnimatePresence mode="wait">
          <motion.img
            key={studioUrl}
            src={studioUrl}
            alt="Studio Render"
            className="md-img"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </AnimatePresence>
      );
    }

    // Angles: CSS-cropped grid — zoom into selected quadrant
    if (segment === 'angles') {
      const showCrop = activeAngle !== null && angleGridUrl;
      return (
        <div className={`md-angles-frame ${showCrop ? `active-q${activeAngle}` : ''}`}>
          {angleGridUrl ? (
            <img
              src={getDriveUrl(angleGridUrl)}
              alt="Angle View"
              className="md-grid-img"
            />
          ) : (
            <div className="md-placeholder">
              <span className="md-placeholder-icon">⊞</span>
              <p>No angle images for this variant yet</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="media-display">
      {/* ── Main Frame ── */}
      <div className="md-main-frame">
        {renderMain()}
      </div>

      {/* ── Angle Thumbnail Strip (only in Angles mode) ── */}
      {segment === 'angles' && angleGridUrl && (
        <div className="md-angle-strip">
          {ANGLE_LABELS.map((label, idx) => (
            <button
              key={idx}
              className={`md-angle-thumb quadrant-${idx} ${activeAngle === idx ? 'active' : ''}`}
              onClick={() => setActiveAngle(activeAngle === idx ? null : idx)}
              title={label}
            >
              <div className="md-thumb-crop">
                <img src={getDriveUrl(angleGridUrl)} alt={label} />
              </div>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ProductPage = ({ product }) => {
  const [selectedStyle, setSelectedStyle]   = useState(0);
  const [activeSegment, setActiveSegment]   = useState('360');

  if (!product) return null;

  const styleLabels = product.styleNames?.length
    ? product.styleNames
    : ['Default'];

  // Per-style data (all arrays aligned by style index)
  const studioImages = useMemo(() =>
    product.finishedImage ? product.finishedImage.split(',').map(u => getDriveUrl(u.trim())) : [],
  [product.finishedImage]);

  const angleGrids = useMemo(() =>
    product.angleViews || [],
  [product.angleViews]);

  const videos = useMemo(() =>
    product.videos || [],
  [product.videos]);

  const rawImageUrl   = getDriveUrl(product.rawImage);
  const studioUrl     = studioImages[selectedStyle] || studioImages[0] || '';
  const angleGridUrl  = angleGrids[selectedStyle]   || angleGrids[0]   || '';
  const videoUrl      = getDriveUrl(videos[selectedStyle] || videos[0] || '');

  // Hide segments that have no data at all
  const availableSegments = SEGMENTS.filter(seg => {
    if (seg.id === '360'    && !videos.some(Boolean))       return false;
    if (seg.id === 'sketch' && !rawImageUrl)                return false;
    if (seg.id === 'studio' && studioImages.length === 0)   return false;
    if (seg.id === 'angles' && angleGrids.length === 0)     return false;
    return true;
  });

  // If active segment is hidden, fall back to first available
  const currentSegment = availableSegments.find(s => s.id === activeSegment)
    ? activeSegment
    : (availableSegments[0]?.id || 'studio');

  return (
    <div className="product-page-container">
      <div className="product-grid-layout">

        {/* ── LEFT: Media ── */}
        <div className="product-media-section">

          {/* Segmented Control */}
          <div className="segment-control" role="tablist">
            {availableSegments.map(seg => (
              <button
                key={seg.id}
                role="tab"
                aria-selected={currentSegment === seg.id}
                className={`segment-btn ${currentSegment === seg.id ? 'active' : ''}`}
                onClick={() => setActiveSegment(seg.id)}
              >
                <span className="seg-icon">{seg.icon}</span>
                <span className="seg-label">{seg.label}</span>
              </button>
            ))}
            {/* Sliding active pill — pure CSS driven by :has() */}
          </div>

          {/* Media Display (swap this component for a different layout style) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSegment}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="media-motion-wrapper"
            >
              <MediaDisplay
                segment={currentSegment}
                studioUrl={studioUrl}
                rawImageUrl={rawImageUrl}
                angleGridUrl={angleGridUrl}
                videoUrl={videoUrl}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Details ── */}
        <div className="product-details-section">
          <p className="product-sku">SKU: {product.id}</p>
          <h1 className="product-title-large">{product.name}</h1>
          <p className="product-price-large">{product.price}</p>

          {/* Style / Finish Picker */}
          <div className="finish-picker-container">
            <h4 className="picker-title">Select Finish</h4>
            <div className="style-chips">
              {styleLabels.map((label, index) => (
                <button
                  key={label}
                  className={`style-chip ${selectedStyle === index ? 'active' : ''}`}
                  onClick={() => setSelectedStyle(index)}
                >
                  <div
                    className="color-dot"
                    style={{ background: getDotColor(label) }}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="product-description-container">
            <p className="product-description-text">{product.description}</p>
          </div>

          <div className="product-actions">
            <button
              className="apple-btn-primary"
              onClick={() => window.open('https://wa.me/923001234567', '_blank')}
            >
              Order Variant: {styleLabels[selectedStyle]}
            </button>
          </div>

          <div className="product-materials">
            <h3 className="materials-title">Specifications</h3>
            <ul className="materials-list">
              <li>Current Style: {styleLabels[selectedStyle]}</li>
              <li>Finish Profile: Luxury {styleLabels[selectedStyle]}</li>
              <li>Dimensions: 34"W × 36"D × 38"H</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductPage;
