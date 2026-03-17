import { tokenStorage } from '../utils/tokenStorage';

export async function downloadExport(path: string, filename: string): Promise<void> {
  const token = tokenStorage.getToken();
  const response = await fetch(`/api${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  const text = await response.text();
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
