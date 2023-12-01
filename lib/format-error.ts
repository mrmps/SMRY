export function formatError(errorObj: any): string {
  // This function takes an error object and returns a string representation
  // You can customize this to extract the most relevant information
  if (typeof errorObj === "object" && errorObj !== null) {
    return errorObj.message || JSON.stringify(errorObj);
  } else {
    return "Unknown error";
  }
}
