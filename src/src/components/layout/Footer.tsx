import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <img src="/logo.png" alt="Creative Lead" />
        <span className="footer-copy">© {new Date().getFullYear()} Creative Comet · CreativeLead</span>
      </div>
      <ul className="footer-links">
        <li><a href="#">Privacy</a></li>
        <li><a href="#">Terms</a></li>
        <li><a href="mailto:support@creativecomet.tn">Support</a></li>
      </ul>
    </footer>
  );
};
