const authConfig = {
  providers: [
    {
      domain:
        process.env.CLERK_FRONTEND_API_URL ??
        "https://sweeping-monarch-32.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
