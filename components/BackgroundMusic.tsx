import React from 'react';

interface BackgroundMusicProps {
  playOnMount?: boolean;
}

export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({ playOnMount }) => {
  return <div className="hidden" />;
};

export default BackgroundMusic;
