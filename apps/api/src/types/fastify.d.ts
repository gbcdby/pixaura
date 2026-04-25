import "fastify";

interface CustomRequest {
  user?: {
    sub: string;
    username: string;
    type: "access" | "refresh";
  };
}

declare module "fastify" {
  interface FastifyRequest extends CustomRequest {}
  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: {
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "strict" | "lax" | "none";
        path?: string;
        maxAge?: number;
      },
    ): void;
    clearCookie(name: string, options?: { path?: string }): void;
  }
}
