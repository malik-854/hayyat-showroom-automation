import React, { useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import './ProductPage.css';

const ProductPage = ({ product }) => {
  const [showCraftsmanshipMode, setShowCraftsmanshipMode] = useState(false);
  
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

  const currentImage = showCraftsmanshipMode ? rawImageProcessed : images[selectedStyleIndex];

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
              key={currentImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={currentImage} 
              alt={product.name} 
              className={`main-product-image ${showCraftsmanshipMode ? 'is-raw' : 'is-finished'}`} 
              style={{ transform: "translateZ(50px)" }}
            />
          </motion.div>
          
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
