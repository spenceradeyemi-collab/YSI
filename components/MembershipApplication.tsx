import React from 'react';
import { Member } from '../types';

interface MembershipApplicationProps {
  user: Member;
  onSubmitted?: (user: Member) => void;
  onLogout?: () => void;
}

export const MembershipApplication: React.FC<MembershipApplicationProps> = ({ user, onSubmitted, onLogout }) => {
  return <div className="p-4">Membership Application</div>;
};

export default MembershipApplication;
