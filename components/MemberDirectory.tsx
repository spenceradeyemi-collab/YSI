import React from 'react';

interface MemberDirectoryProps {
  onNavigateToDM?: () => void;
}

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({ onNavigateToDM }) => {
  return <div className="p-4">Member Directory</div>;
};

export default MemberDirectory;
