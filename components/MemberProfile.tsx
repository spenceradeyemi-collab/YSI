import React from 'react';
import { Member } from '../types';

interface MemberProfileProps {
  profile?: Member;
  onUpdate?: (user: Member) => void;
  onLogout?: () => void;
}

export const MemberProfile: React.FC<MemberProfileProps> = ({ profile, onUpdate, onLogout }) => {
  return <div className="p-4">Member Profile</div>;
};

export default MemberProfile;
