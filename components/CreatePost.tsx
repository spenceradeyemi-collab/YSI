import React from 'react';
import { Member } from '../types';

interface CreatePostProps {
  currentUser?: Member;
  onPostCreated?: () => void;
}

export const CreatePost: React.FC<CreatePostProps> = ({ currentUser, onPostCreated }) => {
  return <div className="p-4">Create Post</div>;
};

export default CreatePost;
