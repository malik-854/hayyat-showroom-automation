import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProducts } from '../services/db';
import TiltCard from './TiltCard';
import './Showroom.css';

const Showroom = ({ onSelectProduct }) => {
  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const load = async () => {
      const data = await fetchProducts();
      setProducts(data);
      setLoading(false);
    };
    load();
  }, []);

  // Build unique category list dynamically from the sheet
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    return ['All', ...cats];
  }, [products]);

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter(p => p.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <motion.div
      className="showroom-page"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ── Page Header ── */}
      <div className="showroom-header">
        <p className="showroom-eyebrow">Hayyat Furnishes</p>
        <h1 className="showroom-title">The Showroom</h1>
        <p className="showroom-subtitle">
          Handcrafted pieces. Curated for the discerning.
        </p>
      </div>

      {/* ── Category Filter Bar ── */}
      {!loading && categories.length > 1 && (
        <div className="category-filter-bar">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-filter-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat !== 'All' && (
                <span className="cat-count">
                  {products.filter(p => p.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Product Grid ── */}
      {loading ? (
        <div className="showroom-loading">
          <div className="loading-spinner" />
          <p>Curating the collection…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="showroom-empty">
          <p>No pieces in this category yet.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            className="showroom-grid"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            {filtered.map(p => (
              <TiltCard
                key={p.id}
                product={p}
                onClick={() => onSelectProduct(p)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
};

export default Showroom;
