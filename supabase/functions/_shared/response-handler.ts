export function handleError(error: any) {
  let errorMessage = "An unexpected error occurred.";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  // Redact sensitive headers
  errorMessage = errorMessage.replace(/Authorization: Bearer .*/g, "Authorization: Bearer [REDACTED]");

  return new Response(JSON.stringify({ error: errorMessage }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
