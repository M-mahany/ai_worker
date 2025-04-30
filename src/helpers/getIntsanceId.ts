import axios from "axios";

export const getInstanceId = async (): Promise<string | null> => {
  try {
    const token = await getInstanceToken();

    if (!token) throw new Error("No Token Provided!");

    const response = await axios.get(
      "http://169.254.169.254/latest/meta-data/instance-id",
      {
        headers: {
          "X-aws-ec2-metadata-token": token,
        },
        timeout: 1000,
      },
    );
    return response.data;
  } catch (err: any) {
    throw new Error(
      `Failed to fetch instance ID from metadata Error:${err?.message || err}`,
    );
  }
};

export const getInstanceToken = async () => {
  try {
    const response = await axios.put(
      "http://169.254.169.254/latest/api/token",
      {
        headers: {
          "X-aws-ec2-metadata-token-ttl-seconds": 21600,
        },
      },
    );
    const token = response.data;
    return token;
  } catch (error: any) {
    console.log("Failed Retriving AWS Token", error);
    return null;
  }
};
