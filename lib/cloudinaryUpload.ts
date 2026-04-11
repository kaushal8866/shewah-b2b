export async function uploadToCloudinary(file: File): Promise<string> {
  // Mock upload for now until Cloudinary credentials are set up.
  // We return a placeholder base64 URL or standard URL so the UI doesn't crash.
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}
