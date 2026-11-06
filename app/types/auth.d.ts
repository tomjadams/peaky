declare module "#app" {
  interface PageMeta {
    /** Set to true to opt this route out of the global auth middleware. */
    public?: boolean;
  }
}
