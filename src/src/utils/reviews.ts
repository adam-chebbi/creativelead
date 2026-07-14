import { Lead, ReviewRecord } from '@/types';

export function countRealReviews(reviews: Lead['reviews']): number {
  if (!reviews) return 0;
  return reviews.filter(r => r.reviewer_name || r.review_text).length;
}

export function filterRealReviews(reviews: Lead['reviews']): ReviewRecord[] {
  if (!reviews) return [];
  return reviews.filter(r => 
    r.reviewer_name !== null || 
    r.review_rating !== null || 
    r.review_date !== null || 
    r.review_relative_time !== null || 
    r.review_text !== null || 
    r.review_url !== null
  );
}
