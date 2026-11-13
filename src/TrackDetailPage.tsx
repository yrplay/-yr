import React from 'react';
import { TrackDetailView } from './TrackDetailView';
import { useApp } from '../context/AppContext';

interface TrackDetailPageProps {
  trackId?: string;
  onBack?: () => void;
  onNavigateBack?: () => void;
  onNavigateToSection?: (section: string) => void;
  onSelectCircle?: (circleId: string) => void;
  onNavigateToStudent?: (studentId: string) => void;
}

export const TrackDetailPage: React.FC<TrackDetailPageProps> = ({
  trackId,
  onBack,
  onNavigateBack,
  onNavigateToSection
}) => {
  const { tracks } = useApp();
  const activeTrackId = trackId || tracks[0]?.id || 't-1';
  const handleBack = onBack || onNavigateBack;

  return (
    <TrackDetailView
      trackId={activeTrackId}
      onBack={handleBack}
      onNavigateToSection={onNavigateToSection}
    />
  );
};
