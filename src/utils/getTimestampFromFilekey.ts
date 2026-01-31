export const getFileTimestampFromFileKey = (fileKey: string) => {
  const fileName = fileKey?.split("/")?.pop(); // Get the filename from path
  const recordedAt = fileName?.split("_")?.pop()?.split(".")[0]; // Extract timestamp from the end
  return Number(recordedAt) || 0; // Convert to number for sorting
};
