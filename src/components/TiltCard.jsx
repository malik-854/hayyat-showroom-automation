import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';

const TiltCard = ({ product, onClick }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const getDirectImageUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const idMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
      return idMatch ? `/api/image?id=${idMatch[1]}` : url;
    }
    return url;
  };

  const images = product.finishedImage ? product.finishedImage.split(',').map(u => getDirectImageUrl(u.trim())) : [];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3500); // 3.5 seconds per image
    return () => clearInterval(interval);
  }, [images.length]);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  // Rotate based on mouse position within the card
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const isGridFallback = product.isGridFallback;

  return (
    <motion.div
      className={`tilt-card ${isGridFallback ? 'grid-fallback' : ''}`}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
    >
      <div 
        className="tilt-card-image"
        style={{ transform: "translateZ(50px)" }}
      >
        <AnimatePresence mode="popLayout">
          <motion.img 
            key={currentImageIndex}
            src={images[currentImageIndex] || ''} 
            alt={product.name}
            className={isGridFallback ? 'quadrant-0' : ''}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        </AnimatePresence>
      </div>
      <div className="tilt-card-content" style={{ transform: "translateZ(80px)" }}>
        <h3 className="tilt-card-title">{product.productName || product.name}</h3>
        <p className="tilt-card-price">{product.price}</p>
        <span className="tilt-card-category">{product.category || 'Luxury Collection'}</span>
      </div>
    </motion.div>
  );
};

export default TiltCard;
