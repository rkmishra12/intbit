import axiosInstance from "./axios";

/**
 * @param {string} language - programming language
 * @param {string} code - source code to executed
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code) {
  try {
    const response = await axiosInstance.post("/code/execute", { language, code });
    return response.data;
  } catch (error) {
    const apiError = error.response?.data?.message;
    const fallback = error.message || "Unknown error";
    return {
      success: false,
      error: apiError || `Failed to execute code: ${fallback}`,
    };
  }
}
