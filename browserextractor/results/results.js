document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('tableBody');
    const leadCount = document.getElementById('leadCount');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    // Fetch leads from storage
    const { extractedLeads } = await chrome.storage.local.get(['extractedLeads']);
    const leads = extractedLeads || [];

    leadCount.textContent = leads.length;

    if (leads.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No leads extracted yet. Go back to Google Maps and start an extraction.</td></tr>`;
    } else {
        leads.forEach(lead => {
            const tr = document.createElement('tr');
            
            // Limit reviews count display
            const reviewText = lead.reviews_count ? `${lead.rating} ⭐ (${lead.reviews_count})` : 'N/A';
            const webLink = lead.website ? `<a href="${lead.website}" target="_blank" style="color: #8b5cf6;">Website</a>` : '-';
            
            tr.innerHTML = `
                <td style="font-weight: 500; color: #fff;">${lead.business_name || 'Unknown'}</td>
                <td>${lead.category || '-'}</td>
                <td>${lead.rating || '-'}</td>
                <td>${lead.reviews_count || '-'}</td>
                <td>${lead.phone || '-'}</td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${lead.location}">${lead.location || '-'}</td>
                <td>${webLink}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Export functionality (delegates to background script just like popup)
    exportJsonBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "EXPORT_LOCAL", format: "json" });
    });
});
