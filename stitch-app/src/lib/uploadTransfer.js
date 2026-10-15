// Upload-row helpers shared by the upload page. Kept free of React so the
// regression scripts can exercise them directly in Node.

export const buildUploadOpenHref = ({ upload, course } = {}) => {
  const courseId = course?.id || upload?.courseId || null;
  if (courseId) {
    return `/dashboard/lessons?courseId=${encodeURIComponent(courseId)}`;
  }
  return '/dashboard/library';
};

export const describeUploadFailure = (upload) => {
  const message = String(upload?.errorMessage || '').trim();
  return message || 'We could not extract text from this file.';
};

// PUT the file to the signed storage URL with byte-level progress. fetch()
// exposes no upload progress, which leaves large files looking frozen.
export const putFileWithProgress = ({
  url,
  file,
  contentType,
  onProgress,
  createRequest = () => new XMLHttpRequest(),
}) => new Promise((resolve, reject) => {
  const request = createRequest();
  request.open('PUT', url);
  request.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
  if (request.upload && typeof onProgress === 'function') {
    request.upload.onprogress = (event) => {
      if (!event?.lengthComputable || !event.total) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
  }
  request.onload = () => {
    if (request.status >= 200 && request.status < 300) {
      onProgress?.(100);
      resolve();
      return;
    }
    reject(new Error(`Storage responded with ${request.status}`));
  };
  request.onerror = () => reject(new Error('Network error while uploading. Check your connection and try again.'));
  request.onabort = () => reject(new Error('Upload was cancelled.'));
  request.send(file);
});
