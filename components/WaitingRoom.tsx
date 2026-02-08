import React from 'react';

interface WaitingRoomProps {
  onLogout?: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ onLogout }) => {
  return <div className="p-4">Waiting Room</div>;
};

export default WaitingRoom;
