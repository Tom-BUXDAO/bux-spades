import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Camera } from 'lucide-react';

interface ProfilePictureUploadProps {
  currentImage: string | null;
  onImageUpdate: () => void;
}

export default function ProfilePictureUpload({ currentImage, onImageUpdate }: ProfilePictureUploadProps) {
  const { data: session, update } = useSession();
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow images under 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image under 5MB');
      return;
    }

    try {
      setIsUploading(true);

      // Create FormData for image upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload to local API
      const updateResponse = await fetch('/api/user/update-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      // Update session with new image
      await update();
      onImageUpdate();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative group">
      <div className="w-8 h-8 rounded-full overflow-hidden">
        <Image
          src={currentImage || "/guest-avatar.png"}
          alt="Profile"
          width={32}
          height={32}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Only show upload option for non-Discord users */}
      {session?.user?.id && !/^\d+$/.test(session.user.id) && (
        <label
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          title="Change profile picture"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            disabled={isUploading}
          />
          <Camera className="w-4 h-4 text-white" />
        </label>
      )}
    </div>
  );
} 