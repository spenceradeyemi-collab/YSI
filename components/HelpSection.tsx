import React from 'react';

const HelpSection: React.FC = () => {
  return (
    <div className="help-container">
      <h1>Help & Support</h1>
      <section>
        <h2>Getting Started</h2>
        <p>Welcome to YSI! Here are some tips to get you started:</p>
        <ul>
          <li>Create an account to get started</li>
          <li>Customize your settings in the preferences</li>
          <li>Enable notifications to stay updated</li>
        </ul>
      </section>
      <section>
        <h2>FAQ</h2>
        <details>
          <summary>How do I reset my password?</summary>
          <p>Contact support or use the password reset link on the login page.</p>
        </details>
        <details>
          <summary>Is my data secure?</summary>
          <p>Yes, we use industry-standard encryption to protect your data.</p>
        </details>
      </section>
    </div>
  );
};

export default HelpSection;
