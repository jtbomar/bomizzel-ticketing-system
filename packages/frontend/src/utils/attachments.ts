import { apiService } from '../services/api';

/**
 * Attachment helpers shared by the agent dashboard and the customer portal.
 * Files are served only to signed-in users (GET /files/:id with the token),
 * so they're fetched as a blob rather than linked to directly.
 */

/** Open an attachment in a new tab (images, PDFs) or save it (anything else). */
export const openAttachment = async (fileId: string, fileName: string, mimeType = '') => {
  const blob = await apiService.downloadFile(fileId);
  const url = URL.createObjectURL(blob);
  if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
    window.open(url, '_blank', 'noopener');
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * Files from a paste (Ctrl+V / Cmd+V). A pasted screenshot has no useful
 * name ("image.png"), so it gets a dated one.
 */
export const pastedFiles = (event: React.ClipboardEvent): File[] => {
  const files: File[] = [];
  for (const item of Array.from(event.clipboardData?.items || [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (!file) continue;
    if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const ext = file.type.split('/')[1] || 'png';
      files.push(new File([file], `screenshot-${stamp}.${ext}`, { type: file.type }));
    } else {
      files.push(file);
    }
  }
  return files;
};

/** Files dropped onto an element. */
export const droppedFiles = (event: React.DragEvent): File[] =>
  Array.from(event.dataTransfer?.files || []);
