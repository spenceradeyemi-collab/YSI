import React, { useState } from 'react';
import { Member } from '../types';

interface AuthProps {
  onLogin?: (user: Member, rememberMe: boolean) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Authentication logic here
      console.log('Login attempt:', { email, password });
      
      // Create a mock user for now
      const mockUser: Member = {
        id: '1',
        memberId: '1',
        name: 'User',
        email: email,
        status: 'active',
        role: 'MEMBER',
        adminRole: null,
        permissions: ['CREATE_POST', 'LIKE_POST'],
        isPaidMember: false,
        paymentHistory: [],
        dues: {},
        birthday: '',
        joinDate: Date.now(),
        lastActive: Date.now(),
      };
      
      if (onLogin) {
        onLogin(mockUser, rememberMe);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h1>Welcome to YSI</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
};

export default Auth;
