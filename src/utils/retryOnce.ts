export const retryOnceFn = async (
  fnc: () => Promise<any>,
  retries: number = 1,
) => {
  let attempts = 0;
  while (attempts <= retries) {
    try {
      return await fnc();
    } catch (error: any) {
      attempts++;
      if (attempts <= retries) {
        console.log("Retrying...");
      }
      if (attempts > retries) {
        throw new Error(
          `Function failed after ${attempts} attempts. Error: ${error?.message || error}`,
        );
      }
    }
  }
};
