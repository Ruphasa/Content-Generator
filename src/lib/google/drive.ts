

export interface DownloadTask {
  url: string;
  filename?: string;
}

export async function downloadFiles(tasks: DownloadTask[]): Promise<File[]> {
  const files: File[] = [];
  
  for (const task of tasks) {
    if (!task.url.trim()) continue;
    try {
      const response = await fetch(task.url, {
        redirect: 'follow',
      });

      if (!response.ok) {
        console.error(`Failed to download ${task.url}: ${response.statusText}`);
        continue;
      }

      const blob = await response.blob();
      let filename = task.filename;
      
      if (!filename) {
        filename = task.url.split('/').pop() || `downloaded_file_${Date.now()}`;
      }
      
      // Attempt to preserve or add an extension if we have mime type but no extension in filename
      if (filename && !filename.includes('.')) {
        if (blob.type.includes('video/mp4')) filename += '.mp4';
        else if (blob.type.includes('image/jpeg')) filename += '.jpg';
        else if (blob.type.includes('image/png')) filename += '.png';
      }

      // Create File with proper type (Node.js File)
      const file = new File([blob], filename, {
        type: blob.type || 'application/octet-stream',
        lastModified: Date.now(),
      });
      
      files.push(file);
    } catch (error: unknown) {
      console.error(`Error downloading ${task.url}:`, (error as Error).message);
    }
  }

  return files;
}
