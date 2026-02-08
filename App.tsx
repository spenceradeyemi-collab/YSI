import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Auth from './components/Auth';
import HelpSection from './components/HelpSection';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/help" element={<HelpSection />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
