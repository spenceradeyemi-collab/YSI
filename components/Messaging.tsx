import React from 'react';
import { Member } from '../types';

interface MessagingProps {
  currentUser?: Member;
}

export const Messaging: React.FC<MessagingProps> = ({ currentUser }) => {
  return <div className="p-4">Messaging</div>;
};

export default Messaging;
