import React from 'react';
import { ImportResult } from '@/types';
import { countRealReviews } from '@/utils/reviews';
import { formatRating } from '@/utils/format';
import { MapPinIcon } from '@/components/icons';
import { Badge, RatingStars } from '@/components/ui';

export interface LeadPreviewTableProps {
  result: ImportResult;
}

export const LeadPreviewTable: React.FC<LeadPreviewTableProps> = ({ result }) => {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Business Name</th>
            <th>Category</th>
            <th>Location</th>
            <th>Phone</th>
            <th>Rating</th>
            <th>Reviews</th>
          </tr>
        </thead>
        <tbody>
          {result.leads.slice(0, 10).map((lead, i) => {
            const realReviews = countRealReviews(lead.reviews);
            return (
              <tr key={i}>
                <td className="td-index">{i + 1}</td>
                <td className="td-name">{lead.business_name}</td>
                <td>{lead.category}</td>
                <td>
                  <span className="td-city">
                    <MapPinIcon />
                    {lead.location || lead.city || lead.address || '—'}
                  </span>
                </td>
                <td className="td-phone">
                  {lead.phone || lead.phone_number || <span className="empty-text-muted">—</span>}
                </td>
                <td>
                  <RatingStars rating={lead.rating} />
                </td>
                <td>
                  {realReviews > 0 ? (
                    <Badge variant="review-count">
                      {realReviews} / 20
                    </Badge>
                  ) : <span className="empty-text-muted">none</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {result.leads.length > 10 && (
        <div className="table-meta">
          <span>Showing 10 of {result.leads.length} leads</span>
          <span style={{ color: 'var(--color-primary-light)' }}>+{result.leads.length - 10} more will be imported</span>
        </div>
      )}
    </div>
  );
};
