import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export const mainServerRequest = axios.create({
  baseURL: `${process.env.MAIN_SERVER_ENDPOINT}/worker`,
  headers: { "x-api-key": process.env.API_KEY },
});
