import React, { useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import './ProductPage.css';

const ProductPage = ({ product }) => {
  const [showCraftsmanshipMode, setShowCraftsmanshipMode] = useState(false);
  // Angle view: null means "show the finished render", a number = index into angleViews
  const [activeAngle, setActiveAngle] = useState(null);
  
  const getDirectImageUrl = (url) => {
    if (!url) return '';
    if (typeof url !== 'string') return url;
    if (url.includes('drive.google.com')) {
      const idMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
      return idMatch ? `/api/image?id=${idMatch[1]}` : url;
    }
    return url;
  };

  // Parse comma-separated images from the sheet
  const images = useMemo(() => {
    return product.finishedImage.split(',').map(u => getDirectImageUrl(u.trim()));
  }, [product.finishedImage]);

  const rawImageProcessed = useMemo(() => getDirectImageUrl(product.rawImage), [product.rawImage]);

  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);

  // Styles labels mapping dynamically from the DB or falling back to defaults
  const styleLabels = product.styleNames || ['Walnut / Cream', 'Oak / Forest Green', 'Black / Tan'];

  // angle-view URLs (could be one global grid or one per style)
  const angleViewsArray = product.angleViews || [];
  const currentAngleGrid = angleViewsArray[selectedStyleIndex] || angleViewsArray[0] || '';
  const angleViews = currentAngleGrid ? [currentAngleGrid] : [];
  
  const angleLabels = ['Front', 'Side →', 'Back', '← Side'];

  // 3D Tilt Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  if (!product) return null;

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  // Quadrant positions for the 2x2 grid image slicing
  // Each entry tells the image where to sit inside the overflow:hidden container
  const QUADRANT_STYLES = [
    { top: '0%',     left: '0%'    }, // 0: Front      (top-left)
    { top: '0%',     left: '-100%' }, // 1: Side →     (top-right)
    { top: '-100%',  left: '0%'    }, // 2: Back       (bottom-left)
    { top: '-100%',  left: '-100%' }, // 3: ← Side     (bottom-right)
  ];

  // Whether we are actively showing a cropped quadrant
  const isAngleCropActive = !showCraftsmanshipMode && activeAngle !== null && angleViews.length > 0;

  // Main image source: grid URL when angle active, AI render otherwise
  const currentImage = showCraftsmanshipMode
    ? rawImageProcessed
    : isAngleCropActive
      ? getDirectImageUrl(angleViews[0])
      : images[selectedStyleIndex];

  // Inline style for the main image box when a quadrant is selected
  const mainImageStyle = isAngleCropActive
    ? {
        width: '200%',
        height: '200%',
        objectFit: 'cover',
        position: 'absolute',
        maxWidth: 'none',
        top: QUADRANT_STYLES[activeAngle].top,
        left: QUADRANT_STYLES[activeAngle].left,
        transition: 'top 0.4s ease, left 0.4s ease',
      }
    : { width: '100%', height: '100%', objectFit: 'contain', position: 'relative' };

  return (
    <div className="product-page-container">
      <div className="product-grid-layout">
        
        <div className="product-media-section">
          <motion.div 
            className="main-image-container"
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { x.set(0); y.set(0); }}
          >
            <motion.img 
              key={`${currentImage}-${activeAngle}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={currentImage} 
              alt={product.name} 
              className={`main-product-image ${showCraftsmanshipMode ? 'is-raw' : 'is-finished'}`} 
              style={mainImageStyle}
            />
          </motion.div>

          {/* ── Angle View Thumbnail Strip ── */}
          {angleViews.length > 0 && (
            <div className={`angle-strip ${angleViews.length === 1 ? 'is-grid-mode' : 'is-split-mode'}`}>
              {(angleViews.length === 1 ? [0, 1, 2, 3] : angleViews).map((item, idx) => {
                const url = angleViews.length === 1 ? angleViews[0] : item;
                return (
                  <button
                    key={idx}
                    className={`angle-thumb ${activeAngle === idx ? 'active' : ''} quadrant-${idx}`}
                    onClick={() => {
                      setActiveAngle(activeAngle === idx ? null : idx);
                      setShowCraftsmanshipMode(false);
                    }}
                    title={angleLabels[idx]}
                  >
                    <div className="thumb-crop-box">
                      <img src={getDirectImageUrl(url)} alt={angleLabels[idx]} />
                    </div>
                    <span>{angleLabels[idx]}</span>
                  </button>
                );
              })}
            </div>
          )}
          
          <div className="craftsmanship-toggle-wrapper">
            <span className={`toggle-label ${!showCraftsmanshipMode ? 'active' : ''}`}>Finished</span>
            <button 
              className={`toggle-switch ${showCraftsmanshipMode ? 'on' : 'off'}`}
              onClick={() => setShowCraftsmanshipMode(!showCraftsmanshipMode)}
            >
              <span className="toggle-thumb"></span>
            </button>
            <span className={`toggle-label ${showCraftsmanshipMode ? 'active' : ''}`}>Craftsmanship</span>
          </div>
        </div>

        <div className="product-details-section">
          <p className="product-sku">SKU: {product.id}</p>
          <h1 className="product-title-large">{product.name}</h1>
          <p className="product-price-large">{product.price}</p>
          
          <div className="finish-picker-container">
            <h4 className="picker-title">Select Finish</h4>
            <div className="style-chips">
              {styleLabels.map((label, index) => (
                <button 
                  key={label}
                  className={`style-chip ${selectedStyleIndex === index ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedStyleIndex(index);
                    setShowCraftsmanshipMode(false);
                    setActiveAngle(null); // reset angle when switching style
                  }}
                >
                  <div className={`color-dot style-${index}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="product-description-container">
            <p className="product-description-text">{product.description}</p>
          </div>
          
          <div className="product-actions">
            <button className="apple-btn-primary" onClick={() => window.open(`https://wa.me/923001234567`, '_blank')}>
              Order Variant: {styleLabels[selectedStyleIndex]}
            </button>
          </div>
          
          <div className="product-materials">
            <h3 className="materials-title">Specifications</h3>
            <ul className="materials-list">
              <li>Current Style: {styleLabels[selectedStyleIndex]}</li>
              <li>Finish Profile: Luxury {styleLabels[selectedStyleIndex]}</li>
              <li>Dimensions: 34"W x 36"D x 38"H</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
