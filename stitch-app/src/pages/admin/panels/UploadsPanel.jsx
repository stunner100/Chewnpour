import React from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatBytes, formatDateTime, formatFileTypeLabel } from '../../../lib/admin/formatters';

export const UploadsPanel = ({ snapshot }) => {
    const uploads = Array.isArray(snapshot?.uploads?.recent) ? snapshot.uploads.recent : [];

    return (
        <SectionCard title="Recent uploads" badge={`${uploads.length} shown`}>
            {uploads.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                        <caption className="sr-only">Recent uploads</caption>
                        <thead>
                            <tr className="border-b border-border-subtle text-text-muted">
                                <th className="py-2 pr-3 font-medium">File</th>
                                <th className="py-2 pr-3 font-medium">Type</th>
                                <th className="py-2 pr-3 font-medium">Status</th>
                                <th className="py-2 pr-3 font-medium">Size</th>
                                <th className="py-2 font-medium">Uploaded</th>
                            </tr>
                        </thead>
                        <tbody>
                            {uploads.map((upload) => (
                                <tr key={upload.id} className="border-b border-border-subtle last:border-0">
                                    <td className="py-2.5 pr-3 font-medium text-text-primary">
                                        {upload.fileName}
                                    </td>
                                    <td className="py-2.5 pr-3 text-text-secondary">
                                        {formatFileTypeLabel(upload.fileType)}
                                    </td>
                                    <td className="py-2.5 pr-3 text-text-secondary">
                                        {(upload.status || '').replace(/_/g, ' ')}
                                    </td>
                                    <td className="py-2.5 pr-3 text-text-secondary">
                                        {formatBytes(upload.fileSize)}
                                    </td>
                                    <td className="py-2.5 text-text-secondary">
                                        {formatDateTime(upload.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-sm text-text-secondary">No uploads yet.</p>
            )}
        </SectionCard>
    );
};
