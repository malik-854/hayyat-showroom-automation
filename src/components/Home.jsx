import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { fetchProducts } from '../services/db';
import TiltCard from './TiltCard';

// The sentence to reveal word by word
const heroText = "Handcrafted Skeletons. AI-Perfected Finishes. Luxury Reimagined.";
const words = heroText.split(" ");

// Reusable featured row component
const FeaturedRow = ({ title, badge, products, onSelectProduct }) => {
  if (!products || products.length === 0) return null;

  return (
    <section className="featured-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="section-badge">{badge}</span>
        <div className="section-line" />
      </div>
      <div className="featured-grid">
        {products.slice(0, 3).map((p) => (
          <TiltCard
            key={p.id}
            product={p}
            onClick={() => onSelectProduct(p)}
          />
        ))}
      </div>
    </section>
  );
};

const Home = ({ onSelectProduct }) => {
  const [products, setProducts] = useState([]);
  const { scrollY } = useScroll();
  const yParallax = useTransform(scrollY, [0, 1000], [0, 300]);
  const opacityParallax = useTransform(scrollY, [0, 600], [0.6, 0]);

  // Use the best render for BG
  const bestRenderUrl = "https://storage.googleapis.com/hayyatfurniture.firebasestorage.app/renders/regal-walnut-chair.png?GoogleAccessId=antigravity-worker%40hayyat-store-automation.iam.gserviceaccount.com&Expires=16446999600&Signature=fy8t5AnKMrqXe6sMUQUlxmaiAiIPKG1vpiK7%2BICALLcdWClwB0p2ossOXQ%2F%2FBvbAb5NgLe1hGJTrSw5WY3OB%2FvOFqoCEYLeG9P0tt1kflZUSarIGekbOYNIXyk26SQuvqrPde15AR57mfoARsjZehRTiuoVzRfyEESSZVJZ8lRpabMsVhrexlKRF%2BXINIBjJAa1%2FlZYI5ztIh9S%2BP5fBPoNq2NP5Ly7wornWulj8Fl9k%2Bg19QeNHxjkveYLuv93QOmCS7SCCqVwlly%2FhhQkZI0Z4t%2BjjYULBxvMTdsODxsajzYXrSTe8TMgdDIPrbyzLF55v4lDjYeQXD3xChIPB8g%3D%3D";

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchProducts();
      setProducts(data);
    };
    loadData();
  }, []);

  // Filter products by tag (case-insensitive)
  const newArrivals  = products.filter(p => p.tag?.toLowerCase() === 'new');
  const bestSelling  = products.filter(p => p.tag?.toLowerCase() === 'best');
  const onSale       = products.filter(p => p.tag?.toLowerCase() === 'sale');

  // Animation variants for word reveal
  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.2 * i },
    }),
  };

  const child = {
    visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 100 } },
    hidden:  { opacity: 0, y: 40, transition: { type: "spring", damping: 12, stiffness: 100 } },
  };

  return (
    <motion.div
      className="home-page"
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Hero Section with Parallax */}
      <section className="luxury-hero">
        <motion.div
          className="hero-bg"
          style={{
            backgroundImage: `url(${bestRenderUrl})`,
            y: yParallax,
            opacity: opacityParallax
          }}
        />
        <div className="hero-overlay" />

        <div className="hero-content">
          <motion.h1
            className="hero-title-reveal"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {words.map((word, index) => (
              <motion.span variants={child} key={index} style={{ display: 'inline-block', marginRight: '8px' }}>
                {word}
              </motion.span>
            ))}
          </motion.h1>
          <motion.p
            className="hero-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            Scroll to explore the collection
          </motion.p>
        </div>
      </section>

      {/* Featured Sections */}
      <div className="featured-sections-wrapper">
        <FeaturedRow
          title="New Arrivals"
          badge="NEW"
          products={newArrivals}
          onSelectProduct={onSelectProduct}
        />
        <FeaturedRow
          title="Best Selling"
          badge="POPULAR"
          products={bestSelling}
          onSelectProduct={onSelectProduct}
        />
        <FeaturedRow
          title="On Sale"
          badge="SALE"
          products={onSale}
          onSelectProduct={onSelectProduct}
        />
      </div>
    </motion.div>
  );
};

export default Home;
