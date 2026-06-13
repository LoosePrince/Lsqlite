declare module 'express-serve-static-core' {
  interface Request {
    session?: unknown | null;
  }
}

export {};