import axios from "axios";

export const getInstanceId = async (): Promise<string | null> => {
  try {
    const response = await axios.get(
      "http://169.254.169.254/latest/meta-data/instance-id",
      {
        timeout: 1000,
      },
    );
    return response.data;
  } catch (err) {
    console.error("Failed to fetch instance ID from metadata", err);
    return null;
  }
};
