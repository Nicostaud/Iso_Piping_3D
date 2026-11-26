/** Web implementation of the platform contract (see ./index.js). */

/**
 * Downloads a file through a temporary <a download> element.
 * @param {{ name: string, mime?: string, data: string | Blob | Uint8Array }} f
 * @returns {Promise<boolean>} false when the browser refused the download
 */
async function saveFile({ name, mime, data }) {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], mime ? { type: mime } : undefined);
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Lets the user pick a project file and reads it as UTF-8 text.
 * @returns {Promise<{ name: string, text: string } | null>} null when cancelled
 */
function openProject() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return resolve(null);
      try {
        resolve({ name: f.name, text: await f.text() });
      } catch (e) {
        resolve({ name: f.name, text: '' });
      }
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export const webPlatform = {
  isDesktop: false,
  saveFile,
  openProject,
};
