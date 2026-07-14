import React from 'react';
import { StarIcon } from '@/components/icons';
import { formatRating } from '@/utils/format';

export interface RatingStarsProps {
  rating: number | null | undefined;
}

export const RatingStars: React.FC<RatingStarsProps> = ({ rating }) => {
  if (rating == null) {
    return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  }

  const rounded = Math.round(rating);
  const title = formatRating(rating);
  const stars = [];

  for (let i = 0; i < 5; i++) {
    stars.push(
      <StarIcon key={i} filled={i < rounded} style={{ opacity: i < rounded ? 1 : 0.4 }} />
    );
  }

  return (
    <span className="rating-stars" title={title} style={{ display: 'inline-flex', gap: '0.1rem' }}>
      {stars}
    </span>
  );
};
