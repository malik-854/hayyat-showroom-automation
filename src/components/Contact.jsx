import React from 'react';
import { motion } from 'framer-motion';

const Contact = () => {
  return (
    <motion.div 
      className="contact-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="container">
        <motion.h1 
          className="contact-title"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          Get in Touch
        </motion.h1>
        
        <div className="contact-grid">
          <motion.div 
            className="contact-card"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h3>Lahore Showroom</h3>
            <p>12-L, Gulberg II</p>
            <p>Lahore, Pakistan</p>
            <p className="contact-info">Phone: +92 300 1234567</p>
            <p className="contact-info">Email: showroom@hayyat.pk</p>
          </motion.div>

          <motion.div 
            className="contact-card"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h3>Business Hours</h3>
            <p>Monday - Saturday: 10:00 AM - 10:00 PM</p>
            <p>Sunday: By Appointment Only</p>
          </motion.div>
        </div>

        <motion.div 
          className="contact-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
        >
          <button className="apple-btn-primary" style={{ maxWidth: '400px', margin: '0 auto' }}>
            Book a Design Consultation
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Contact;
